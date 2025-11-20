const db = require('./db');
const axios = require('axios');
const polyline = require('polyline'); 

const API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImExZWY5YzUwNzY3NzQwZTU5NDFhMzA2MGY3YWEyNGU0IiwiaCI6Im11cm11cjY0In0="; 

const TIME_WINDOWS = {
    morning: [28800, 43200],
    afternoon: [50400, 64800],
    any: [28800, 64800]
};

async function optimizeRoute() {
    console.log("🚀 Démarrage du Moteur V12...");

    const [techs] = await db.query('SELECT * FROM technicians LIMIT 1');
    if (techs.length === 0) throw new Error("Aucun technicien en base.");
    const tech = techs[0];

    const [missions] = await db.query("SELECT * FROM missions WHERE status IN ('pending', 'assigned')");
    if (missions.length === 0) return { message: "Aucune mission." };

    const jobs = missions.map(m => ({
        id: m.id,
        location: [parseFloat(m.lng), parseFloat(m.lat)],
        type: 'service',
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
        console.log(`📡 Envoi de ${jobs.length} missions à l'IA...`);
        
        const response = await axios.post(
            'https://api.openrouteservice.org/optimization', 
            { jobs: jobs, vehicles: [vehicle], options: { g: true } },
            { headers: { 'Authorization': API_KEY, 'Content-Type': 'application/json' } }
        );

        if (response.data.code && response.data.code !== 0) {
            console.error("⚠️ REFUS DE L'IA :", response.data.error);
            throw new Error(`L'IA a refusé : ${response.data.error}`);
        }

        if (!response.data.routes || response.data.routes.length === 0) {
            console.error("⚠️ L'IA a répondu succès mais sans route !");
            return { path: [], route: [], unassigned: response.data.unassigned || [] };
        }

        const routeData = response.data.routes[0];
        const decodedPath = routeData.geometry ? polyline.decode(routeData.geometry) : [];
        const steps = routeData.steps;
        console.log(`✅ Route calculée : ${steps.length} étapes.`);

        let formattedRoute = [];
        let order = 1;
        
        for (let step of steps) {
            if (step.type === 'job') {
                const m = missions.find(mis => mis.id === step.id);
                
                // ✅ Correction : passer 'assigned' comme paramètre
                await db.query(
                    'UPDATE missions SET technician_id=?, route_order=?, status=? WHERE id=?',
                    [tech.id, order, 'assigned', step.id]
                );
                
                formattedRoute.push({
                    step: order,
                    client: m.client_name,
                    time_slot: m.time_slot,
                    address: m.address,
                    lat: parseFloat(m.lat),
                    lng: parseFloat(m.lng),
                    distance_km: (step.distance / 1000).toFixed(1)
                });
                order++;
            }
        }

        return { 
            path: decodedPath, 
            route: formattedRoute,
            unassigned: response.data.unassigned || [] 
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
