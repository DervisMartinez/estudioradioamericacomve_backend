const admin = require('firebase-admin');
const path = require('path');

// Ruta segura hacia tu archivo de credenciales (que no subiremos a Git)
// Asegúrate de que el archivo exista en la carpeta config con este nombre
const serviceAccount = require(path.join(__dirname, 'config', 'firebase-service-account.json'));

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://estudio-radio-america-default-rtdb.firebaseio.com'
});

// Exportar los servicios que necesites usar
const db = admin.database();
// const auth = admin.auth(); // Descomenta esto si vas a usar Firebase Authentication en el backend

module.exports = { admin, db };