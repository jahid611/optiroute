const express = require('express');
const cors = require('cors');
const db = require('./db'); 
const getCoordinates = require('./geocoder'); 
const optimizeRoute = require('./optimizer'); 
const bcrypt = require('bcryptjs'); // Hachage password
const jwt = require('jsonwebtoken'); // Gestion des Tokens
require('dotenv').config();

const app = express();
app.use(cors()); 
app.use(express.json()); 

const JWT_SECRET = process.env.JWT_SECRET || 'secret_par_defaut_dangereux';

// --- MIDDLEWARE D'AUTHENTIFICATION ---
// C'est le gardien. Il vérifie le Token avant de laisser passer.
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer LE_TOKEN"

    if (!token) return res.status(401).json({ message: "Accès refusé. Token manquant." });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: "Token invalide ou expiré." });
        req.user = user; // On colle l'info de l'utilisateur (son ID) dans la requête
        next(); // On passe à la suite
    });
}

// --- ROUTES PUBLIQUES (Pas besoin de token) ---

// 1. Inscription (Register)
app.post('/auth/register', async (req, res) => {
    try {
        const { email, password, company_name } = req.body;
        if (!email || !password) return res.status(400).json({ message: "Email et mot de passe requis." });

        // Vérifier si l'email existe déjà
        const [existing] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
        if (existing.length > 0) return res.status(400).json({ message: "Cet email est déjà utilisé." });

        // Hasher le mot de passe
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insérer l'utilisateur
        await db.query("INSERT INTO users (email, password, company_name) VALUES (?, ?, ?)", [email, hashedPassword, company_name]);
        
        res.status(201).json({ success: true, message: "Compte créé avec succès !" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Connexion (Login)
app.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Trouver l'utilisateur
        const [users] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
        if (users.length === 0) return res.status(400).json({ message: "Email ou mot de passe incorrect." });
        const user = users[0];

        // Vérifier le mot de passe
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ message: "Email ou mot de passe incorrect." });

        // Générer le Token (Contient l'ID de l'user)
        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });

        res.json({ success: true, token: token, company: user.company_name });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route "Ping" (Pour vérifier que le serveur tourne)
app.get('/', (req, res) => res.send("OptiRoute Backend V2 (Secure) is Running."));


// --- ROUTES PROTÉGÉES (Nécessitent un Token) ---
// Note l'ajout de 'authenticateToken' comme 2ème argument

// 3. Ajouter une mission (Protégé)
// 3. Ajouter une mission (Avec Durée personnalisée)
app.post('/missions', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id; 
        // On récupère 'duration' en plus
        const { client_name, address, time_slot, duration } = req.body;

        if (!client_name || !address) return res.status(400).json({ success: false, message: "Champs manquants" });

        const gps = await getCoordinates(address);
        if (!gps.found) return res.status(400).json({ success: false, message: "Adresse introuvable" });

        // Si pas de durée envoyée, on met 30 par défaut
        const finalDuration = duration || 30;

        // On ajoute duration_minutes dans la requête SQL
        const [result] = await db.query(
            `INSERT INTO missions (user_id, client_name, address, lat, lng, status, time_slot, duration_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, client_name, address, gps.lat, gps.lng, "pending", time_slot || 'any', finalDuration]
        );

        res.json({ success: true, id: result.insertId });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// 4. Lister les techniciens (Protégé & Filtré par User)
app.get('/technicians', authenticateToken, async (req, res) => {
    try {
        // On ne récupère QUE les techniciens de l'utilisateur connecté
        const [rows] = await db.query("SELECT * FROM technicians WHERE user_id = ?", [req.user.id]);
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// 5. Ajouter un technicien (Protégé)
app.post('/technicians', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, address } = req.body;
        const gps = await getCoordinates(address);
        if (!gps.found) return res.status(400).json({ success: false });

        await db.query(
            'INSERT INTO technicians (user_id, name, address, start_lat, start_lng) VALUES (?, ?, ?, ?, ?)', 
            [userId, name, address, gps.lat, gps.lng]
        );
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// 6. Supprimer un technicien (Protégé & Vérifié)
app.delete('/technicians/:id', authenticateToken, async (req, res) => {
    try {
        // Sécurité : On s'assure qu'on ne supprime qu'un technicien qui NOUS appartient
        await db.query('DELETE FROM technicians WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// 7. Optimisation (Doit être mise à jour pour gérer le multi-tenant)
app.get('/optimize', authenticateToken, async (req, res) => {
    try {
        // On passe l'ID utilisateur à la fonction d'optimisation pour qu'elle ne charge que les bonnes données
        const result = await optimizeRoute(req.user.id); 
        res.json({ success: true, route: result.route, path: result.path, unassigned: result.unassigned });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// 8. Reset des données (Pour l'utilisateur seulement)
app.get('/init-data', authenticateToken, async (req, res) => {
    try {
        // Supprime UNIQUEMENT les données de l'utilisateur connecté
        await db.query('DELETE FROM missions WHERE user_id = ?', [req.user.id]);
        await db.query('DELETE FROM technicians WHERE user_id = ?', [req.user.id]);
        res.send("✅ Vos données ont été réinitialisées.");
    } catch (error) { res.status(500).send(error.message); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => { console.log(`🚀 Serveur Sécurisé démarré sur http://0.0.0.0:${PORT}`); });