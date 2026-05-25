var express  = require('express');
var router   = express.Router();
var Usuario  = require('../models/Usuario');
var bcrypt   = require('bcrypt');

const SALT_ROUNDS = 10;

// ── Iniciar sesión ──
router.post('/login', async function(req, res) {
    const { usuario, contraseña } = req.body;

    try {
        const user = await Usuario.findOne({ usuario });
        if (!user) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }

        const coincide = await bcrypt.compare(contraseña, user.contraseña);
        if (!coincide) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }

        req.session.usuarioId     = user._id.toString();
        req.session.usuarioNombre = user.usuario;

        res.json({
            usuario: {
                _id:     user._id,
                usuario: user.usuario,
                nombre:  user.nombre,
                email:   user.email
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor', detalle: err.message });
    }
});

// ── Cerrar sesión ──
router.post('/logout', function(req, res) {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ error: 'No se pudo cerrar la sesión' });
        res.clearCookie('connect.sid');
        res.json({ mensaje: 'Sesión cerrada correctamente' });
    });
});

// ── Crear usuario ──
router.post('/crear', async function(req, res) {
    const { nombre, apellidos, email, usuario, contraseña } = req.body;

    try {
        const hash = await bcrypt.hash(contraseña, SALT_ROUNDS);
        const nuevoUsuario = new Usuario({ nombre, apellidos, email, usuario, contraseña: hash });
        await nuevoUsuario.save();
        res.status(201).json({ mensaje: 'Usuario creado correctamente' });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ error: 'El usuario o email ya existe' });
        }
        res.status(500).json({ error: 'Error del servidor', detalle: err.message });
    }
});

// ── Obtener datos de un usuario ──
router.get('/:id', async function(req, res) {
    try {
        const user = await Usuario.findById(req.params.id).select('-contraseña');
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor', detalle: err.message });
    }
});

// ── Modificar datos de un usuario ──
router.put('/:id', async function(req, res) {
    const { nombre, apellidos, email, usuario, contraseña } = req.body;

    try {
        const cambios = { nombre, apellidos, email, usuario };

        if (contraseña && contraseña.length >= 6) {
            cambios.contraseña = await bcrypt.hash(contraseña, SALT_ROUNDS);
        }

        const actualizado = await Usuario.findByIdAndUpdate(
            req.params.id,
            cambios,
            { new: true, runValidators: true }
        ).select('-contraseña');

        if (!actualizado) return res.status(404).json({ error: 'Usuario no encontrado' });

        req.session.usuarioNombre = actualizado.usuario;
        res.json(actualizado);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ error: 'El usuario o email ya existe' });
        }
        res.status(500).json({ error: 'Error del servidor', detalle: err.message });
    }
});

module.exports = router;