const express = require('express');
const cors = require('cors');
const db = require('./db'); 
const getCoordinates = require('./geocoder'); 
const optimizeRoute = require('./optimizer'); 
require('dotenv').config();

const app = express();

app.use(cors()); 
app.use(express.json()); 

// Route 1 : Test DB
app.get('/test-db', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM technicians');
        res.json({ message: "Connexion DB réussie", data: rows });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// Route 2 : Init Data
app.get('/init-data', async (req, res) => {
    try {
        await db.query('DELETE FROM missions');
        await db.query('DELETE FROM technicians');
        await db.query('ALTER TABLE missions AUTO_INCREMENT = 1');
        await db.query('ALTER TABLE technicians AUTO_INCREMENT = 1');

        const depotAdresse = "Place de la République, Paris";
        const depotGPS = await getCoordinates(depotAdresse);
        
        if (!depotGPS.found) return res.status(500).send("Erreur géocodage dépôt");

        await db.query(
            'INSERT INTO technicians (name, start_lat, start_lng) VALUES (?, ?, ?)',
            ['Thomas le Boss', depotGPS.lat, depotGPS.lng]
        );
        res.send("✅ Données remises à zéro.");
    } catch (error) { res.status(500).send(error.message); }
});

// Route 3 : Add Mission
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

// Route 4 : OPTIMIZE (MISE A JOUR)
app.get('/optimize', async (req, res) => {
    try {
        const result = await optimizeRoute(); 

        res.json({ 
            success: true, 
            message: "Calcul terminé.", 
            route: result.route, 
            path: result.path,
            unassigned: result.unassigned // 👈 ON RENVOIE LES REJETS
        });

    } catch (error) {
        console.error("ERREUR BACKEND :", error.message);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Serveur démarré sur http://0.0.0.0:${PORT}`);
});