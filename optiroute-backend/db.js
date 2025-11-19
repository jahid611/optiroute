const mysql = require('mysql2');
require('dotenv').config();

let pool;

// Si on a une variable DATABASE_URL (Mode Cloud)
if (process.env.DATABASE_URL) {
    console.log("☁️ Tentative de connexion au Cloud (Aiven)...");
    pool = mysql.createPool({
        uri: process.env.DATABASE_URL,
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
        // Important pour Aiven : on accepte la connexion sécurisée
        ssl: {
            rejectUnauthorized: false
        }
    });
} 
// Sinon on reste en mode local (Mode Dev classique)
else {
    console.log("🏠 Connexion locale...");
    pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
}

// Petit test de connexion au démarrage
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Erreur CRITIQUE de connexion DB :', err.message);
    } else {
        console.log('✅ Connecté avec succès à la Base de Données !');
        connection.release();
    }
});

module.exports = pool.promise();