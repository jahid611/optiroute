const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,  // <--- J'ai ajouté ça pour qu'il prenne le 3301
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Erreur de connexion à la base de données :', err.code);
        console.error('Détail:', err.message);
    } else {
        console.log('✅ Connecté à la base de données MySQL sur le port ' + process.env.DB_PORT + ' !');
        connection.release();
    }
});

module.exports = pool.promise();