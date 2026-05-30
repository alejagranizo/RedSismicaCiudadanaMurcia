#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Descarga terremotos del catálogo oficial del IGN entre 01/01/1980 y hoy,
descarga el fichero directamente en GeoJSON, recorta por el shapefile de Murcia
y guarda un GeoJSON final.

Requisitos:
    pip install geopandas shapely playwright
    python -m playwright install chromium
"""

from __future__ import annotations

import re
import datetime as dt
from datetime import datetime
from pathlib import Path

import geopandas as gpd
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


# ===========================================================
# CONFIGURACIÓN
# ===========================================================

IGN_FORM_URL = "https://www.ign.es/web/sis-catalogo-terremotos"  # [4](https://stackoverflow.com/questions/78832985/geopandas-read-file-is-confusing-me-when-used-with-sql-parameter)

FECHA_INICIO = "01/01/1980"
FECHA_FIN = datetime.now().strftime("%d/%m/%Y")

LAT_MIN = "26"
LAT_MAX = "45"
LON_MIN = "-20"
LON_MAX = "6"

SHAPE_MURCIA = Path("murcia.shp")

DOWNLOAD_DIR = Path("descargas_ign")

# SOLO UN RAW FIJO (se sobrescribe cada vez)
RAW_GEOJSON_IGN = DOWNLOAD_DIR / "terremotos_ign_raw.geojson"

OUTPUT_GEOJSON = Path("terremotos_murcia.geojson")

HEADLESS = True

DEBUG = True
DEBUG_DIR = Path("debug_ign")


# ===========================================================
# HELPERS PLAYWRIGHT
# ===========================================================

def _debug_dump(page, tag: str) -> None:
    if not DEBUG:
        return
    DEBUG_DIR.mkdir(parents=True, exist_ok=True)
    try:
        page.screenshot(path=DEBUG_DIR / f"{tag}.png", full_page=True)
    except Exception:
        pass
    try:
        (DEBUG_DIR / f"{tag}.html").write_text(page.content(), encoding="utf-8")
    except Exception:
        pass


def _force_fill(locator, value: str) -> None:
    locator.click(force=True, timeout=15_000)
    locator.press("Control+A")
    locator.type(value, delay=10)


def _accept_cookies_if_present(page) -> None:
    try:
        capa = page.locator("#capa_galleta")
        if capa.count() > 0 and capa.is_visible():
            page.locator("#acepto_galleta").click(force=True, timeout=3000)
            page.wait_for_timeout(500)
    except Exception:
        pass


def _select_geojson_in_results(page) -> None:
    """
    Selecciona GeoJSON en el selector que está justo después del texto 'Formato de descarga'. [1](https://github.com/geopandas/pyogrio)
    """
    select_descarga = page.locator(
        "xpath=//*[contains(normalize-space(.),'Formato de descarga')]/following::select[1]"
    ).first

    select_descarga.wait_for(timeout=30_000)

    options = select_descarga.evaluate(
        """(el) => Array.from(el.options).map(o => ({
            text: (o.textContent || '').trim().toLowerCase(),
            value: o.value
        }))"""
    )

    geo_opts = [o for o in options if "geojson" in o["text"] or "geo json" in o["text"]]
    if not geo_opts:
        raise RuntimeError(f"No encuentro opción GeoJSON en el selector de descarga. Opciones: {options}")

    select_descarga.select_option(value=geo_opts[0]["value"])


def _sanity_check_geojson(path: Path) -> None:
    """
    Verifica que lo descargado sea GeoJSON real (FeatureCollection).
    Si empieza por 'Evento;' es CSV; si empieza por '<' es HTML.
    """
    head = path.read_text(encoding="utf-8", errors="replace")[:250].lstrip()

    if head.startswith("{") and ("FeatureCollection" in head or '"features"' in head):
        return

    if head.lower().startswith("<"):
        raise RuntimeError("Lo descargado parece HTML (no GeoJSON). Revisa cookies/redirección.")

    if head.startswith("Evento;") or ";" in head[:100]:
        raise RuntimeError(
            "Lo descargado parece CSV/Texto (no GeoJSON). "
            "Eso significa que NO se seleccionó el formato GeoJSON correcto."
        )

    raise RuntimeError("Lo descargado no parece GeoJSON. Primeros caracteres:\n" + head)


# ===========================================================
# DESCARGA DIRECTA GEOJSON DESDE EL IGN
# ===========================================================

def descargar_geojson_ign() -> Path:
    print(">>> Entrando en descargar_geojson_ign()", flush=True)
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=HEADLESS)
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()
        page.set_default_timeout(60_000)

        try:
            print(">>> Abriendo catálogo IGN", flush=True)
            page.goto(IGN_FORM_URL, wait_until="domcontentloaded", timeout=90_000)  # [4](https://stackoverflow.com/questions/78832985/geopandas-read-file-is-confusing-me-when-used-with-sql-parameter)

            try:
                page.wait_for_load_state("networkidle", timeout=25_000)
            except Exception:
                pass

            _accept_cookies_if_present(page)

            page.wait_for_selector("#_IGNSISCatalogoTerremotos_WAR_IGNSISCatalogoTerremotosportlet_startDate")

            print(">>> Rellenando fechas", flush=True)
            _force_fill(
                page.locator("#_IGNSISCatalogoTerremotos_WAR_IGNSISCatalogoTerremotosportlet_startDate"),
                FECHA_INICIO
            )
            _force_fill(
                page.locator("#_IGNSISCatalogoTerremotos_WAR_IGNSISCatalogoTerremotosportlet_endDate"),
                FECHA_FIN
            )

            print(">>> Rellenando BBOX", flush=True)
            _force_fill(page.locator("#_IGNSISCatalogoTerremotos_WAR_IGNSISCatalogoTerremotosportlet_latMin"), LAT_MIN)
            _force_fill(page.locator("#_IGNSISCatalogoTerremotos_WAR_IGNSISCatalogoTerremotosportlet_latMax"), LAT_MAX)
            _force_fill(page.locator("#_IGNSISCatalogoTerremotos_WAR_IGNSISCatalogoTerremotosportlet_lonMin"), LON_MIN)
            _force_fill(page.locator("#_IGNSISCatalogoTerremotos_WAR_IGNSISCatalogoTerremotosportlet_lonMax"), LON_MAX)

            print(">>> Ejecutando búsqueda", flush=True)
            page.locator("#enviar").click(force=True)

            try:
                page.get_by_text(re.compile(r"Se han encontrado", re.I)).wait_for(timeout=60_000)  # [1](https://github.com/geopandas/pyogrio)
            except PlaywrightTimeoutError:
                pass

            print(">>> Seleccionando GeoJSON", flush=True)
            _select_geojson_in_results(page)

            print(">>> Descargando GeoJSON", flush=True)
            with page.expect_download(timeout=90_000) as dl:
                try:
                    page.get_by_role("button", name=re.compile("Descargar", re.I)).click(force=True)
                except Exception:
                    page.get_by_text(re.compile("Descargar", re.I)).click(force=True)

            download = dl.value


            download.save_as(RAW_GEOJSON_IGN)
            print(f">>> GeoJSON IGN guardado (sobrescrito): {RAW_GEOJSON_IGN}", flush=True)

            _sanity_check_geojson(RAW_GEOJSON_IGN)
            print(">>> GeoJSON IGN válido", flush=True)

            return RAW_GEOJSON_IGN

        except Exception:
            _debug_dump(page, "fallo")
            raise
        finally:
            context.close()
            browser.close()


# ===========================================================
# RECORTE POR MURCIA
# ===========================================================



def filtrar_geojson_por_murcia(geojson_path: Path, shape_murcia: Path) -> gpd.GeoDataFrame:
    print(">>> Leyendo GeoJSON del IGN", flush=True)

    gdf = gpd.read_file(geojson_path,engine="fiona")

    # CRS típico de GeoJSON: WGS84
    if gdf.crs is None:
        gdf = gdf.set_crs("EPSG:4326")
    else:
        gdf = gdf.to_crs("EPSG:4326")

    print(">>> Cargando shapefile de Murcia", flush=True)
    murcia = gpd.read_file(shape_murcia)
    if murcia.crs is None:
        raise ValueError("El shapefile de Murcia no tiene CRS definido.")
    murcia = murcia.to_crs(gdf.crs)

    murcia_union = murcia.geometry.union_all()
    filtrado = gdf[gdf.geometry.within(murcia_union)].copy()

    print(f">>> Terremotos dentro de Murcia: {len(filtrado)}", flush=True)

    # Convertir campos problemáticos como 'hora' a string antes de exportar


    return filtrado


# ===========================================================
# MAIN
# ===========================================================

def main() -> None:
    raw_geojson = descargar_geojson_ign()
    gdf_murcia = filtrar_geojson_por_murcia(raw_geojson, SHAPE_MURCIA)

    OUTPUT_GEOJSON.write_text(gdf_murcia.to_json(), encoding="utf-8-sig")

    print(f">>> Guardado GeoJSON final: {OUTPUT_GEOJSON}", flush=True)
    print(">>> Proceso completado ✅", flush=True)


if __name__ == "__main__":
    main()