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
app.get('/init-data', async (req, res) => {
    try {
        await db.query('DELETE FROM missions');
        await db.query('DELETE FROM technicians');
        await db.query('ALTER TABLE missions AUTO_INCREMENT = 1');
        await db.query('ALTER TABLE technicians AUTO_INCREMENT = 1');

        // On crée un technicien par défaut pour ne pas être vide
        const depotGPS = await getCoordinates("Paris, France");
        if (depotGPS.found) {
            await db.query('INSERT INTO technicians (name, start_lat, start_lng, address) VALUES (?, ?, ?, ?)', ['Technicien 1', depotGPS.lat, depotGPS.lng, "Paris, France"]);
        }
        res.send("✅ Données remises à zéro.");
    } catch (error) { res.status(500).send(error.message); }
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