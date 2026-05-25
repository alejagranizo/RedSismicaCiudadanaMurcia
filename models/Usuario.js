const mongoose = require('mongoose');
const usuarioSchema = new mongoose.Schema({
    nombre: {type: String, require:true},
    apellidos: {type: String, require:true},
    email: {type: String, require:true, unique:true},
    usuario: {type: String, require:true, unique:true},
    contraseña: {type: String, require:true}
}, {timestamps: true});

module.exports = mongoose.model('Usuario', usuarioSchema)