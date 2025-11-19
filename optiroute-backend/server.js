const express = require('express');
const cors = require('cors');
const db = require('./db'); // Connexion MySQL
const getCoordinates = require('./geocoder'); // Outil de géocodage
const optimizeRoute = require('./optimizer'); // Moteur VROOM
require('dotenv').config();

const app = express();

// Configuration CORS
app.use(cors()); 
app.use(express.json()); 

// --- GESTION DES ROUTES API ---

// Route 1 : Réinitialisation des données (Bouton Reset)
app.get('/init-data', async (req, res) => {
    try {
        console.log("🚀 Démarrage de la réinitialisation complète...");

        // 1. SUPPRESSION (Ordre très important : Enfant 'missions' d'abord, Parent 'technicians' ensuite)
        await db.query('DROP TABLE IF EXISTS missions');
        await db.query('DROP TABLE IF EXISTS technicians');
        console.log("✅ Tables supprimées.");

        // 2. CRÉATION TABLE TECHNICIENS
        await db.query(`
            CREATE TABLE technicians (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                start_lat DECIMAL(10, 8) NOT NULL,
                start_lng DECIMAL(11, 8) NOT NULL,
                address VARCHAR(255),
                capacity INT DEFAULT 10
            )
        `);
        console.log("✅ Table TECHNICIANS créée.");

        // 3. CRÉATION TABLE MISSIONS (On force la structure)
        await db.query(`
            CREATE TABLE missions (
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
                FOREIGN KEY (technician_id) REFERENCES technicians(id) ON DELETE SET NULL
            )
        `);
        console.log("✅ Table MISSIONS créée.");

        // 4. INSERTION DU TECHNICIEN (Données en dur pour tester)
        // On récupère le résultat pour avoir l'ID
        const [techResult] = await db.query(
            'INSERT INTO technicians (name, start_lat, start_lng, address) VALUES (?, ?, ?, ?)',
            ['Thomas le Boss', 48.867196, 2.363607, 'Place de la République, Paris']
        );
        
        // Si ta config DB ne renvoie pas le format [result], utilise techResult.insertId directement
        const newTechId = techResult.insertId || 1; 
        console.log(`✅ Technicien inséré avec l'ID : ${newTechId}`);

        // 5. INSERTION D'UNE MISSION DE TEST (Liée au technicien créé juste avant)
        await db.query(
            `INSERT INTO missions (client_name, address, lat, lng, duration_minutes, status, time_slot, technician_id) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            ['Client Test', '10 Rue de Rivoli, Paris', 48.8556, 2.3522, 45, 'assigned', 'morning', newTechId]
        );
        console.log("✅ Mission de test insérée et liée au technicien.");

        res.send(`✅ SUCCÈS TOTAL : Tables créées, Technicien ID ${newTechId} créé, et Mission de test ajoutée !`);

    } catch (error) {
        console.error("❌ ERREUR FATALE :", error);
        res.status(500).send("Erreur : " + error.message);
    }
});

// Route 2 : Ajouter une mission
app.post('/missions', async (req, res) => {
    try {
        const { client_name, address, time_slot } = req.body;
        if (!client_name || !address) return res.status(400).json({ success: false, message: "Nom et adresse obligatoires" });
        
        const gps = await getCoordinates(address);
        if (!gps.found) return res.status(400).json({ success: false, message: "Impossible de trouver cette adresse." });

        const creneau = time_slot || 'any';

        const [result] = await db.query(
            'INSERT INTO missions (client_name, address, lat, lng, status, time_slot) VALUES (?, ?, ?, ?, "pending", ?)',
            [client_name, address, gps.lat, gps.lng, creneau]
        );

        res.json({ success: true, message: "Mission ajoutée !", id: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

// Route 3 : Lancer l'optimisation
app.get('/optimize', async (req, res) => {
    try {
        const result = await optimizeRoute(); 
        res.json({ 
            success: true, 
            message: "Route calculée avec succès !", 
            route: result.route, 
            path: result.path,
            unassigned: result.unassigned
        });
    } catch (error) {
        console.error("ERREUR OPTIMIZE :", error.message);
        res.status(500).json({ error: error.message });
    }
});

// --- ROUTES TECHNICIENS (Celles qui manquaient !) ---

// Route 4 : Lister les techniciens
app.get('/technicians', async (req, res) => {
    try {
        // On vérifie que la table existe avant de lire
        const [rows] = await db.query("SELECT * FROM technicians");
        res.json(rows);
    } catch (error) {
        // Si la table n'existe pas encore, on renvoie une liste vide au lieu de planter
        if (error.code === 'ER_NO_SUCH_TABLE') {
            return res.json([]);
        }
        res.status(500).json({ error: error.message });
    }
});

// Route 5 : Ajouter un technicien
app.post('/technicians', async (req, res) => {
    try {
        const { name, address } = req.body;
        const gps = await getCoordinates(address);
        
        if (!gps.found) return res.status(400).json({ success: false, message: "Adresse introuvable" });

        await db.query(
            'INSERT INTO technicians (name, address, start_lat, start_lng) VALUES (?, ?, ?, ?)', 
            [name, address, gps.lat, gps.lng]
        );
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// Route 6 : Supprimer un technicien
app.delete('/technicians/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM technicians WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- LANCEMENT DU SERVEUR ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Serveur démarré sur http://0.0.0.0:${PORT}`);
});