const db = require('./db');
const axios = require('axios');
const polyline = require('polyline'); 

// Note : Idéalement, mets cette clé dans ton fichier .env
const API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImExZWY5YzUwNzY3NzQwZTU5NDFhMzA2MGY3YWEyNGU0IiwiaCI6Im11cm11cjY0In0="; 

const TIME_WINDOWS = {
    morning: [28800, 43200],   // 08h00 - 12h00
    afternoon: [50400, 64800], // 14h00 - 18h00
    any: [28800, 64800]        // 08h00 - 18h00
};

/**
 * Optimise la tournée pour UN utilisateur spécifique (userId)
 */
async function optimizeRoute(userId) {
    console.log(`🚀 Démarrage du Moteur V12 pour l'utilisateur ID: ${userId}...`);

    // 1. Récupérer TOUS les techniciens de cet utilisateur
    const [techs] = await db.query('SELECT * FROM technicians WHERE user_id = ?', [userId]);
    if (techs.length === 0) throw new Error("Aucun technicien configuré pour votre compte.");

    // 2. Récupérer les missions "pending" ou "assigned" de cet utilisateur
    // Correction : On utilise des single quotes pour être sûr
    const [missions] = await db.query("SELECT * FROM missions WHERE status IN ('pending', 'assigned') AND user_id = ?", [userId]);
    if (missions.length === 0) return { message: "Aucune mission à planifier.", route: [], path: [], unassigned: [] };

    // 3. Préparer les JOBS (Missions)
    const jobs = missions.map(m => ({
        id: m.id,
        location: [parseFloat(m.lng), parseFloat(m.lat)],
        type: 'service',
        service: 1800, // 30 min par défaut
        time_windows: [ TIME_WINDOWS[m.time_slot] || TIME_WINDOWS.any ],
        description: m.client_name
    }));

    // 4. Préparer les VÉHICULES (Techniciens)
    const vehicles = techs.map(t => ({
        id: t.id, 
        profile: "driving-car",
        start: [parseFloat(t.start_lng), parseFloat(t.start_lat)],
        end: [parseFloat(t.start_lng), parseFloat(t.start_lat)], 
        capacity: [t.capacity || 10],
        time_window: TIME_WINDOWS.any
    }));

    try {
        console.log(`📡 Envoi de ${jobs.length} missions et ${vehicles.length} techniciens à l'IA...`);
        
        const response = await axios.post(
            'https://api.openrouteservice.org/optimization', 
            { jobs: jobs, vehicles: vehicles, options: { g: true } },
            { headers: { 'Authorization': API_KEY, 'Content-Type': 'application/json' } }
        );

        if (response.data.code && response.data.code !== 0) {
            console.error("⚠️ REFUS DE L'IA :", response.data.error);
            throw new Error(`L'IA a refusé : ${response.data.error}`);
        }

        // 5. Traitement de la réponse
        let allPaths = [];
        let formattedRoute = [];
        
        if (response.data.routes && response.data.routes.length > 0) {
            
            for (const routeData of response.data.routes) {
                
                if (routeData.geometry) {
                    const decoded = polyline.decode(routeData.geometry);
                    allPaths = [...allPaths, ...decoded];
                }

                const assignedTechId = routeData.vehicle;
                const assignedTech = techs.find(t => t.id === assignedTechId);
                const techName = assignedTech ? assignedTech.name : "Inconnu";

                let order = 1;
                for (let step of routeData.steps) {
                    if (step.type === 'job') {
                        const m = missions.find(mis => mis.id === step.id);
                        
                        // MISE À JOUR BDD (Sécurisée avec paramètres)
                        await db.query(
                            'UPDATE missions SET technician_id=?, route_order=?, status=? WHERE id=? AND user_id=?',
                            [assignedTechId, order, 'assigned', step.id, userId]
                        );
                        
                        formattedRoute.push({
                            step: order,
                            client: m.client_name,
                            time_slot: m.time_slot,
                            address: m.address,
                            lat: parseFloat(m.lat),
                            lng: parseFloat(m.lng),
                            distance_km: (step.distance / 1000).toFixed(1),
                            technician_name: techName
                        });
                        order++;
                    }
                }
            }
        } else {
            console.warn("⚠️ L'IA a répondu succès mais sans aucune route active !");
        }

        // 6. Gérer les non-assignés (C'EST ICI QUE L'ERREUR SE PRODUISAIT)
        let unassignedList = [];
        if (response.data.unassigned) {
            for (let rej of response.data.unassigned) {
                const m = missions.find(mis => mis.id === rej.id);
                if (m) {
                    // CORRECTION MAJEURE ICI : status=? au lieu de status="pending"
                    await db.query(
                        'UPDATE missions SET status=?, technician_id=NULL WHERE id=? AND user_id=?', 
                        ['pending', m.id, userId]
                    );
                    unassignedList.push({ client: m.client_name });
                }
            }
        }

        console.log(`✅ Optimisation terminée : ${formattedRoute.length} missions assignées.`);

        return { 
            path: allPaths, 
            route: formattedRoute, 
            unassigned: unassignedList 
        }; 

    } catch (error) {
        console.error("❌ CRASH DANS OPTIMIZER :", error.message);
        if (error.response) {
            console.error("🔍 DÉTAILS API :", JSON.stringify(error.response.data, null, 2));
        }
        throw error;
    }
}

module.exports = optimizeRoute;