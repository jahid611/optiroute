const db = require('./db');
const axios = require('axios');
const polyline = require('polyline'); 

// 👇 TA CLÉ API
const API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImExZWY5YzUwNzY3NzQwZTU5NDFhMzA2MGY3YWEyNGU0IiwiaCI6Im11cm11cjY0In0="; 

const TIME_WINDOWS = {
    morning: [28800, 43200],
    afternoon: [50400, 64800],
    any: [28800, 64800]
};

async function optimizeRoute() {
    console.log("🚀 Démarrage Optimisation Multi-Tech...");

    if (API_KEY.trim() === "") throw new Error("Clé API manquante.");
    
    // 1. Récupérer TOUS les techniciens (Pas de LIMIT 1)
    const [techs] = await db.query('SELECT * FROM technicians');
    if (techs.length === 0) throw new Error("Aucun technicien dans l'équipe !");

    // 2. Récupérer les missions
    const [missions] = await db.query("SELECT * FROM missions WHERE status IN ('pending', 'assigned')");
    if (missions.length === 0) return { message: "Aucune mission." };

    // 3. Préparation Jobs
    const jobs = missions.map(m => ({
        id: m.id,
        location: [parseFloat(m.lng), parseFloat(m.lat)],
        service: 1800, 
        time_windows: [ TIME_WINDOWS[m.time_slot] || TIME_WINDOWS.any ],
        description: m.client_name
    }));

    // 4. Préparation Véhicules (On mappe tous les techniciens)
    const vehicles = techs.map(tech => ({
        id: tech.id, // L'ID du véhicule = ID du technicien en BDD
        profile: "driving-car",
        start: [parseFloat(tech.start_lng), parseFloat(tech.start_lat)],
        end: [parseFloat(tech.start_lng), parseFloat(tech.start_lat)],
        capacity: [10],
        time_window: TIME_WINDOWS.any
    }));

    try {
        console.log(`📡 Envoi : ${jobs.length} missions pour ${vehicles.length} techniciens...`);
        
        const response = await axios.post(
            'https://api.openrouteservice.org/optimization', 
            { jobs, vehicles, options: { g: true } },
            { headers: { 'Authorization': API_KEY, 'Content-Type': 'application/json' } }
        );

        const responseData = response.data;
        if (responseData.code && responseData.code !== 0) throw new Error(`Erreur VROOM : ${responseData.code}`);

        // Traitement
        let formattedRoutes = [];
        let allPaths = []; // Pour stocker tous les tracés
        
        // On parcourt les routes (une route par technicien utilisé)
        for (const route of responseData.routes) {
            const techId = route.vehicle; // C'est l'ID du technicien qui fait cette tournée
            const steps = route.steps;
            let order = 1;

            // Décodage du tracé de ce véhicule
            if (route.geometry) {
                const points = polyline.decode(route.geometry);
                // Astuce : pour différencier les techniciens visuellement sur la carte,
                // le frontend devra gérer des couleurs, pour l'instant on fusionne tout.
                allPaths = [...allPaths, ...points]; 
            }

            for (let step of steps) {
                if (step.type === 'job') {
                    const m = missions.find(mis => mis.id === step.id);
                    
                    // On assigne la mission au BON technicien
                    await db.query(
                        'UPDATE missions SET technician_id=?, route_order=?, status="assigned" WHERE id=?', 
                        [techId, order, step.id]
                    );
                    
                    // On trouve le nom du technicien pour l'affichage
                    const techInfo = techs.find(t => t.id === techId);

                    formattedRoutes.push({
                        step: order,
                        client: m.client_name,
                        time_slot: m.time_slot,
                        address: m.address,
                        lat: parseFloat(m.lat),
                        lng: parseFloat(m.lng),
                        distance_km: (step.distance / 1000).toFixed(1),
                        technician_name: techInfo ? techInfo.name : "Inconnu" // On ajoute le nom du tech
                    });
                    order++;
                }
            }
        }

        // Gestion des rejets
        let unassignedMissions = [];
        if (responseData.unassigned) {
            for (let rejected of responseData.unassigned) {
                const m = missions.find(mis => mis.id === rejected.id);
                if (m) {
                    await db.query('UPDATE missions SET status="pending", technician_id=NULL, route_order=NULL WHERE id=?', [m.id]);
                    unassignedMissions.push({ client: m.client_name });
                }
            }
        }

        return { path: allPaths, route: formattedRoutes, unassigned: unassignedMissions }; 

    } catch (error) {
        console.error("❌ CRASH OPTIMIZER :", error.message);
        throw error;
    }
}

module.exports = optimizeRoute;