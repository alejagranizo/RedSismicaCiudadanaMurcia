var createError = require('http-errors');
var express     = require('express');
var path        = require('path');
var cookieParser = require('cookie-parser');
var logger      = require('morgan');
var mongoose    = require('mongoose');
var session     = require('express-session');

var indexRouter     = require('./routes/index');
var usersRouter     = require('./routes/users');
var registrosRouter = require('./routes/registros');

var app = express();
const cors = require('cors');
app.use(cors({ origin: true, credentials: true }));

// Conexión a MongoDB
require('dotenv').config();
console.log("MONGO_URI en Render:", process.env.MONGO_URI);
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Conectado a MongoDB'))
    .catch(err => console.error('Error al conectar a MongoDB:', err));

// View engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// ── Sesión ──
app.use(session({
    secret: process.env.SESSION_SECRET || 'murcia-sismica-secret-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,           // No accesible desde JS del cliente
        secure: false,            // Cambiar a true en producción con HTTPS
        maxAge: 1000 * 60 * 60 * 8  // 8 horas
    }
}));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/registros', registrosRouter);

// 404
app.use(function(req, res, next) {
    next(createError(404));
});

// Error handler
app.use(function(err, req, res, next) {
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;