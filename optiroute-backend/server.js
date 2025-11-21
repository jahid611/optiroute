const express = require('express');
const cors = require('cors');
const db = require('./db'); 
const getCoordinates = require('./geocoder'); 
const optimizeRoute = require('./optimizer'); 
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken'); 
require('dotenv').config();

const app = express();
app.use(cors({
    origin: [
        "https://optiroute-green.vercel.app", // Ton site en production
        "http://localhost:3000"               // Ton site en local
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
}));
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json()); 

const JWT_SECRET = process.env.JWT_SECRET || 'secret_super_securise';

// --- MIDDLEWARE AUTH (Gère Admin et Tech) ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Accès refusé." });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ message: "Token invalide." });
        req.user = decoded; // Contient { id, role, company_id (si tech) }
        next();
    });
}

// --- ROUTES AUTH ---

// Login Unifié (Admin ou Tech)
app.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Essayer en tant qu'ADMIN (Table users)
        const [admins] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
        if (admins.length > 0) {
            const admin = admins[0];
            const valid = await bcrypt.compare(password, admin.password);
            if (valid) {
                const token = jwt.sign({ id: admin.id, role: 'admin', name: admin.company_name }, JWT_SECRET, { expiresIn: '24h' });
                return res.json({ success: true, token, role: 'admin', name: admin.company_name });
            }
        }

        // 2. Essayer en tant que TECHNICIEN (Table technicians)
        const [techs] = await db.query("SELECT * FROM technicians WHERE email = ?", [email]);
        if (techs.length > 0) {
            const tech = techs[0];
            const valid = await bcrypt.compare(password, tech.password);
            if (valid) {
                // Pour un tech, user_id est l'ID de son boss (company_id)
                const token = jwt.sign({ id: tech.id, role: 'tech', company_id: tech.user_id, name: tech.name }, JWT_SECRET, { expiresIn: '24h' });
                return res.json({ success: true, token, role: 'tech', name: tech.name });
            }
        }

        return res.status(400).json({ message: "Email ou mot de passe incorrect." });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/auth/register', async (req, res) => { // Inscription Admin seulement
    try {
        const { email, password, company_name } = req.body;
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        await db.query("INSERT INTO users (email, password, company_name) VALUES (?, ?, ?)", [email, hashedPassword, company_name]);
        res.status(201).json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- ROUTES MÉTIER ---

// Lister Techniciens (Admin voit tout, Tech voit ses collègues)
app.get('/technicians', authenticateToken, async (req, res) => {
    try {
        const companyId = req.user.role === 'admin' ? req.user.id : req.user.company_id;
        // On ne renvoie pas les mots de passe !
        const [rows] = await db.query("SELECT id, name, address, start_lat, start_lng, email, capacity FROM technicians WHERE user_id = ?", [companyId]);
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// Ajouter Technicien (ADMIN SEULEMENT)
app.post('/technicians', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "Seul l'administrateur peut ajouter un technicien." });
    try {
        const { name, address, email, password } = req.body;
        const gps = await getCoordinates(address);
        if (!gps.found) return res.status(400).json({ success: false, message: "Adresse introuvable" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await db.query(
            'INSERT INTO technicians (user_id, name, address, start_lat, start_lng, email, password) VALUES (?, ?, ?, ?, ?, ?, ?)', 
            [req.user.id, name, address, gps.lat, gps.lng, email, hashedPassword]
        );
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// Supprimer Technicien (ADMIN SEULEMENT)
app.delete('/technicians/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "Action interdite." });
    try {
        await db.query('DELETE FROM technicians WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// Lister Missions (Filtré par Rôle)
app.get('/optimize', authenticateToken, async (req, res) => {
    try {
        const companyId = req.user.role === 'admin' ? req.user.id : req.user.company_id;
        
        // Si c'est un tech, on filtre l'affichage (ou pas, selon ta règle. Ici je laisse l'optimisation globale mais on filtrera le rendu front)
        // Pour l'instant, l'optimisation recalcule tout pour l'entreprise.
        const result = await optimizeRoute(companyId);
        
        // Si c'est un Tech, on ne lui renvoie QUE sa route dans le résultat ? 
        // Pour l'instant on renvoie tout, le front filtrera l'affichage.
        res.json({ success: true, route: result.route, path: result.path, unassigned: result.unassigned });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// Ajouter Mission (Avec assignation forcée)
app.post('/missions', authenticateToken, async (req, res) => {
    try {
        const { client_name, address, time_slot, duration, technician_id } = req.body;
        const companyId = req.user.role === 'admin' ? req.user.id : req.user.company_id;

        // Sécurité : Si c'est un tech, il ne peut s'assigner qu'à lui-même
        let assignedTechId = technician_id;
        if (req.user.role === 'tech') {
            assignedTechId = req.user.id;
        }
        // Si c'est un admin, technician_id est obligatoire (sélectionné dans le front)
        if (req.user.role === 'admin' && !assignedTechId) {
            return res.status(400).json({ message: "Veuillez sélectionner un technicien." });
        }

        const gps = await getCoordinates(address);
        if (!gps.found) return res.status(400).json({ success: false, message: "Adresse introuvable" });

        const finalDuration = duration || 30;

        // On insère avec status 'assigned' car on a choisi le technicien
        const status = 'assigned'; 

        await db.query(
            `INSERT INTO missions (user_id, client_name, address, lat, lng, status, time_slot, duration_minutes, technician_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [companyId, client_name, address, gps.lat, gps.lng, status, time_slot || 'any', finalDuration, assignedTechId]
        );

        res.json({ success: true });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// RESET : Supprimer UNIQUEMENT les missions (Trash button)
app.delete('/missions/reset', authenticateToken, async (req, res) => {
    try {
        const companyId = req.user.role === 'admin' ? req.user.id : req.user.company_id;
        // On ne touche PAS à la table technicians
        await db.query('DELETE FROM missions WHERE user_id = ?', [companyId]);
        res.json({ success: true, message: "Toutes les missions ont été effacées." });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => { console.log(`🚀 Serveur Multi-Rôles démarré sur http://0.0.0.0:${PORT}`); });