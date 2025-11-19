const optimizeRoute = require('./optimizer');

const express = require('express');
const cors = require('cors');
const db = require('./db'); // On importe notre connexion
require('dotenv').config();
const getCoordinates = require('./geocoder');

const app = express();
app.use(cors());
app.use(express.json()); // Pour que le serveur comprenne le JSON

// --- ROUTES DE TEST ---

// 1. Route simple pour voir si le serveur tourne
app.get('/', (req, res) => {
    res.send('Salut ! Le serveur OptiRoute est en ligne 🚀');
});

// 2. Route pour tester la connexion DB (affiche les techniciens)
app.get('/test-db', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM technicians');
        res.json({ message: "Connexion DB réussie", data: rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route temporaire pour tester le géocodage dans ton navigateur
app.get('/test-geo', async (req, res) => {
    const adresseTest = "Tour Eiffel, Paris"; // Tu peux changer l'adresse ici
    console.log(`🔍 Recherche GPS pour : ${adresseTest}`);

    const result = await getCoordinates(adresseTest);
    res.json(result);
});

// --- ROUTE POUR CRÉER DES DONNÉES DE TEST (SEED) ---
app.get('/init-data', async (req, res) => {
    try {
        // 1. On vide les tables (Attention, ça supprime tout !)
        await db.query('DELETE FROM missions');
        await db.query('DELETE FROM technicians');
        // On remet les compteurs d'ID à 0
        await db.query('ALTER TABLE missions AUTO_INCREMENT = 1');
        await db.query('ALTER TABLE technicians AUTO_INCREMENT = 1');

        console.log('🧹 Tables nettoyées.');

        // 2. On crée le Technicien (Départ : Place de la République, Paris)
        const depotAdresse = "Place de la République, Paris";
        const depotGPS = await getCoordinates(depotAdresse);
        
        if (!depotGPS.found) return res.status(500).send("Erreur géocodage dépôt");

        const [techResult] = await db.query(
            'INSERT INTO technicians (name, start_lat, start_lng) VALUES (?, ?, ?)',
            ['Thomas le Boss', depotGPS.lat, depotGPS.lng]
        );
        console.log('👤 Technicien créé.');

        // 3. On crée 3 Missions (Clients)
        const missionsData = [
            { client: "Boulangerie Jean", adresse: "10 Rue de Rivoli, Paris" },
            { client: "Pharmacie Centrale", adresse: "50 Boulevard Sébastopol, Paris" },
            { client: "Café des Amis", adresse: "20 Rue du Faubourg Saint-Antoine, Paris" }
        ];

        for (let m of missionsData) {
            const gps = await getCoordinates(m.adresse);
            if (gps.found) {
                await db.query(
                    'INSERT INTO missions (client_name, address, lat, lng) VALUES (?, ?, ?, ?)',
                    [m.client, m.adresse, gps.lat, gps.lng]
                );
                console.log(`📦 Mission créée : ${m.client}`);
            }
        }

        res.send("✅ Données de test créées avec succès ! Tu peux vérifier ta base de données.");

    } catch (error) {
        console.error(error);
        res.status(500).send("Erreur lors de l'initialisation : " + error.message);
    }
});

// --- AJOUTER UNE MISSION ---
// --- AJOUTER UNE MISSION (AVEC HORAIRE) ---
app.post('/missions', async (req, res) => {
    try {
        // On récupère aussi le time_slot
        const { client_name, address, time_slot } = req.body;

        if (!client_name || !address) {
            return res.status(400).json({ success: false, message: "Nom et adresse obligatoires" });
        }

        const gps = await getCoordinates(address);

        if (!gps.found) {
            return res.status(400).json({ success: false, message: "Adresse introuvable." });
        }

        // On insère avec le créneau horaire (ou 'any' par défaut)
        const creneau = time_slot || 'any';

        const [result] = await db.query(
            'INSERT INTO missions (client_name, address, lat, lng, status, time_slot) VALUES (?, ?, ?, ?, "pending", ?)',
            [client_name, address, gps.lat, gps.lng, creneau]
        );

        res.json({ success: true, message: "Mission ajoutée !", id: result.insertId });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

// Route pour lancer l'IA d'optimisation
app.get('/optimize', async (req, res) => {
    try {
        const result = await optimizeRoute();
        res.json({
            success: true,
            message: "Route calculée avec succès !",
            route: result
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Erreur algo : " + error.message);
    }
});

// --- LANCEMENT DU SERVEUR ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Serveur démarré sur http://0.0.0.0:${PORT}`);
});