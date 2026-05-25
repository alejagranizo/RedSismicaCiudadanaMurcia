const express = require('express');
const router  = express.Router();
const Registro = require('../models/Registro');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Crear carpeta de uploads si no existe
const UPLOADS_DIR = 'public/images/uploads';
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    console.log('Carpeta de uploads creada:', UPLOADS_DIR);
}

// CONFIGURACIÓN DE MULTER
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// POST - Guardar un nuevo registro
router.post('/', upload.array('fotos', 5), async (req, res) => {
    try {
        const { 
            usuarioId, ubicacion, latitud, longitud, 
            fuerza, fechaHora, descripcion, 
            lugarUsuario, danioEstructural, caidaElemento 
        } = req.body;

        const rutasFotos = req.files ? req.files.map(f => '/images/uploads/' + f.filename) : [];

        const registro = new Registro({
            usuario: usuarioId,
            ubicacion,
            latitud: parseFloat(latitud),
            longitud: parseFloat(longitud),
            fuerza,
            fechaHora,
            descripcion,
            lugarUsuario,
            danioEstructural: danioEstructural === 'true',
            caidaElemento: caidaElemento === 'true',
            fotos: rutasFotos
        });

        await registro.save();
        res.status(201).json({ mensaje: 'Registro guardado correctamente', registro });

    } catch (err) {
        res.status(500).json({ error: 'Error al guardar el registro', detalle: err.message });
    }
});

// GET - Todos los registros (para el Visor)
router.get('/', async (req, res) => {
    try {
        const registros = await Registro.find().sort({ fechaHora: -1 });
        res.json(registros);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ⚠️ GET /mios DEBE ir ANTES que /:id para que Express no confunda "mios" con un ID
// GET - Registros de un usuario concreto (para MisRegistros)
router.get('/mios', async (req, res) => {
    try {
        const { usuarioId } = req.query;
        if (!usuarioId) return res.status(400).json({ error: 'Falta usuarioId' });
        const registros = await Registro.find({ usuario: usuarioId }).sort({ fechaHora: -1 });
        res.json(registros);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET - Un registro por id
router.get('/:id', async (req, res) => {
    try {
        // Validar que el id tiene formato válido de ObjectId
        if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) {
            return res.status(400).json({ error: 'ID no válido' });
        }
        const registro = await Registro.findById(req.params.id);
        if (!registro) return res.status(404).json({ error: 'Registro no encontrado' });
        res.json(registro);
    } catch (err) {
        console.error('Error GET /registros/:id', err.message);
        res.status(500).json({ error: err.message });
    }
});

// PUT - Actualizar un registro
router.put('/:id', upload.array('fotos', 10), async (req, res) => {
    try {
        const {
            usuarioId, ubicacion, latitud, longitud,
            fuerza, fechaHora, descripcion,
            lugarUsuario, danioEstructural, caidaElemento,
            fotosExistentes
        } = req.body;

        const nuevasFotos = req.files ? req.files.map(f => '/images/uploads/' + f.filename) : [];
        const fotosAnteriores = fotosExistentes
            ? (Array.isArray(fotosExistentes) ? fotosExistentes : [fotosExistentes])
            : [];

        const cambios = {
            ubicacion,
            latitud: parseFloat(latitud),
            longitud: parseFloat(longitud),
            fuerza,
            fechaHora,
            descripcion,
            lugarUsuario,
            danioEstructural: danioEstructural === 'true',
            caidaElemento: caidaElemento === 'true',
            fotos: [...fotosAnteriores, ...nuevasFotos]
        };

        const actualizado = await Registro.findByIdAndUpdate(req.params.id, cambios, { new: true });
        if (!actualizado) return res.status(404).json({ error: 'Registro no encontrado' });
        res.json(actualizado);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE - Eliminar un registro
router.delete('/:id', async (req, res) => {
    try {
        await Registro.findByIdAndDelete(req.params.id);
        res.json({ mensaje: 'Eliminado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;