const mongoose = require('mongoose');
const registroSchema = new mongoose.Schema({
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    ubicacion: { type: String},
    latitud: {type: Number, required: true },
    longitud: {type: Number, required: true },
    fuerza: { type: Number, required: true, min: 1, max: 10 },
    fechaHora: { type: Date, required: true },
    descripcion: { type: String },
    lugarUsuario: { type: String, enum: ['interior', 'exterior'], required: true },
    danioEstructural: { type: Boolean, required: true },
    caidaElemento: { type: Boolean, required: true },
    fotos: [{type: String}]
}, { timestamps: true });

module.exports = mongoose.model('Registro', registroSchema);