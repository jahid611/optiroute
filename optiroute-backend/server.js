const express = require('express');
const cors = require('cors');
const db = require('./db'); 
const getCoordinates = require('./geocoder'); 
const optimizeRoute = require('./optimizer'); 
require('dotenv').config();

const app = express();
app.use(cors()); 
app.use(express.json()); 

// --- ROUTES ---

// 1. Init Data (Reset)
// Route 2 : Réinitialisation des données (Bouton Reset) - VERSION INITIALISATION 1ère FOIS
app.get('/init-data', async (req, res) => {
    try {
        // 1. On s'assure que les tables existent
        await db.query(`
            CREATE TABLE IF NOT EXISTS technicians (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                start_lat DECIMAL(10, 8) NOT NULL,
                start_lng DECIMAL(11, 8) NOT NULL,
                address VARCHAR(255),
                capacity INT DEFAULT 10
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS missions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                client_name VARCHAR(100),
                address VARCHAR(255) NOT NULL,
                lat DECIMAL(10, 8),
                lng DECIMAL(11, 8),
                duration_minutes INT DEFAULT 30,
                status ENUM('pending', 'assigned', 'done') DEFAULT 'pending',
                time_slot VARCHAR(20) DEFAULT 'any',
                technician_id INT,
                route_order INT,
                FOREIGN KEY (technician_id) REFERENCES technicians(id)
            )
        `);

        // 2. Maintenant on peut nettoyer sans erreur
        await db.query('DELETE FROM missions');
        await db.query('DELETE FROM technicians');
        
        // Reset des compteurs d'ID
        await db.query('ALTER TABLE missions AUTO_INCREMENT = 1');
        await db.query('ALTER TABLE technicians AUTO_INCREMENT = 1');

        // 3. Création du technicien par défaut
        const depotAdresse = "Place de la République, Paris";
        const depotGPS = await getCoordinates(depotAdresse);
        
        if (!depotGPS.found) return res.status(500).send("Erreur géocodage dépôt");

        await db.query(
            'INSERT INTO technicians (name, start_lat, start_lng, address) VALUES (?, ?, ?, ?)',
            ['Thomas le Boss', depotGPS.lat, depotGPS.lng, depotAdresse]
        );

        res.send("✅ Base de données Cloud initialisée avec succès !");

    } catch (error) {
        console.error(error);
        res.status(500).send("Erreur init : " + error.message);
    }
});

// 2. Ajouter une mission
app.post('/missions', async (req, res) => {
    try {
        const { client_name, address, time_slot } = req.body;
        if (!client_name || !address) return res.status(400).json({ success: false, message: "Champs manquants" });
        const gps = await getCoordinates(address);
        if (!gps.found) return res.status(400).json({ success: false, message: "Adresse introuvable" });
        
        const creneau = time_slot || 'any';
        const [result] = await db.query('INSERT INTO missions (client_name, address, lat, lng, status, time_slot) VALUES (?, ?, ?, ?, "pending", ?)', [client_name, address, gps.lat, gps.lng, creneau]);
        
        res.json({ success: true, message: "Mission ajoutée !", id: result.insertId });
    } catch (error) { res.status(500).json({ success: false, message: "Erreur serveur" }); }
});

// 3. Lancer l'optimisation
app.get('/optimize', async (req, res) => {
    try {
        const result = await optimizeRoute(); 
        res.json({ 
            success: true, 
            message: "Optimisation terminée !", 
            route: result.route, 
            path: result.path,
            unassigned: result.unassigned
        });
    } catch (error) {
        console.error("ERREUR BACKEND :", error.message);
        res.status(500).json({ error: error.message });
    }
});

// --- NOUVELLES ROUTES TEAM ---

// 4. Récupérer la liste des techniciens
app.get('/technicians', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM technicians');
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// 5. Ajouter un technicien
app.post('/technicians', async (req, res) => {
    try {
        const { name, address } = req.body;
        const gps = await getCoordinates(address);
        if (!gps.found) return res.status(400).json({ success: false, message: "Adresse introuvable" });

        await db.query('INSERT INTO technicians (name, address, start_lat, start_lng) VALUES (?, ?, ?, ?)', [name, address, gps.lat, gps.lng]);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// 6. Supprimer un technicien
app.delete('/technicians/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM technicians WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});


const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Serveur démarré sur http://0.0.0.0:${PORT}`);
});