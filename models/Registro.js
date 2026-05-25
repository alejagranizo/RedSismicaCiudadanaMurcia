const mongoose = require('mongoose');
const registroSchema = new mongoose.Schema({
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    ubicacion: { type: String, required: true },
    latitud: {type: Number},
    longitud: {type: Number},
    fuerza: { type: Number, required: true, min: 1, max: 10 },
    fechaHora: { type: Date, required: true },
    descripcion: { type: String },
    lugarUsuario: { type: String, enum: ['interior', 'exterior'] },
    danioEstructural: { type: Boolean },
    caidaElemento: { type: Boolean },
    fotos: [{type: String}]
}, { timestamps: true });

module.exports = mongoose.model('Registro', registroSchema);