const db = require('./db');
const axios = require('axios');
const polyline = require('polyline'); 

// 👇 TA CLÉ API
const API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImExZWY5YzUwNzY3NzQwZTU5NDFhMzA2MGY3YWEyNGU0IiwiaCI6Im11cm11cjY0In0="; 

const TIME_WINDOWS = {
    morning: [28800, 43200],   // 08h00 -> 12h00
    afternoon: [50400, 64800], // 14h00 -> 18h00
    any: [28800, 64800]        // 08h00 -> 18h00
};

async function optimizeRoute() {
    console.log("🚀 Démarrage du Moteur V12...");

    if (API_KEY.trim() === "") throw new Error("Clé API manquante.");
    
    const [techs] = await db.query('SELECT * FROM technicians LIMIT 1');
    const tech = techs[0];
    // On prend TOUTES les missions (pending et assigned) pour tout recalculer
    const [missions] = await db.query("SELECT * FROM missions WHERE status IN ('pending', 'assigned')");

    if (missions.length === 0) return { message: "Aucune mission." };

    const jobs = missions.map(m => ({
        id: m.id,
        location: [parseFloat(m.lng), parseFloat(m.lat)],
        service: 1800, 
        time_windows: [ TIME_WINDOWS[m.time_slot] || TIME_WINDOWS.any ],
        description: m.client_name
    }));

    const vehicle = {
        id: 1,
        profile: "driving-car",
        start: [parseFloat(tech.start_lng), parseFloat(tech.start_lat)],
        end: [parseFloat(tech.start_lng), parseFloat(tech.start_lat)],
        capacity: [10],
        time_window: TIME_WINDOWS.any
    };

    try {
        console.log(`📡 Envoi de ${jobs.length} missions à ORS...`);
        
        const response = await axios.post(
            'https://api.openrouteservice.org/optimization', 
            { 
                jobs: jobs, 
                vehicles: [vehicle],
                options: { g: true } 
            },
            { headers: { 'Authorization': API_KEY, 'Content-Type': 'application/json' } }
        );

        const responseData = response.data;

        if (responseData.code && responseData.code !== 0) {
            throw new Error(`Erreur VROOM : ${responseData.code}`);
        }

        // 1. GESTION DES ROUTES
        const routeData = responseData.routes ? responseData.routes[0] : null;
        let decodedPath = [];
        let formattedRoute = [];

        if (routeData) {
            if (routeData.geometry) decodedPath = polyline.decode(routeData.geometry);
            
            const steps = routeData.steps;
            let order = 1;
            
            for (let step of steps) {
                if (step.type === 'job') {
                    const m = missions.find(mis => mis.id === step.id);
                    
                    await db.query('UPDATE missions SET technician_id=?, route_order=?, status="assigned" WHERE id=?', [tech.id, order, step.id]);
                    
                    formattedRoute.push({
                        step: order,
                        client: m.client_name,
                        time_slot: m.time_slot,
                        address: m.address,
                        lat: parseFloat(m.lat),
                        lng: parseFloat(m.lng),
                        // 👇 CORRECTION DU NOM DE VARIABLE POUR LE FRONTEND
                        distance_km: (step.distance / 1000).toFixed(1) 
                    });
                    order++;
                }
            }
        }

        // 2. GESTION DES REJETS (UNASSIGNED)
        let unassignedMissions = [];
        if (responseData.unassigned && responseData.unassigned.length > 0) {
            console.log(`⚠️ ${responseData.unassigned.length} missions impossibles.`);
            
            // On remet ces missions en 'pending' dans la BDD pour dire qu'elles ne sont pas faites
            for (let rejected of responseData.unassigned) {
                const m = missions.find(mis => mis.id === rejected.id);
                if (m) {
                    await db.query('UPDATE missions SET status="pending", technician_id=NULL, route_order=NULL WHERE id=?', [m.id]);
                    unassignedMissions.push({
                        client: m.client_name,
                        reason: "Horaires ou Distance" // VROOM ne donne pas toujours la raison exacte, on suppose
                    });
                }
            }
        }

        // 👇 ON RENVOIE TOUT : Le chemin, la route valide, ET les rejets
        return { path: decodedPath, route: formattedRoute, unassigned: unassignedMissions }; 

    } catch (error) {
        console.error("❌ CRASH :", error.message);
        throw error;
    }
}

module.exports = optimizeRoute;