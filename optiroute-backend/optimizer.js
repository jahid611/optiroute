const db = require('./db');
const axios = require('axios');
const polyline = require('polyline'); 

// Clé API (Idéalement dans .env)
const API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImExZWY5YzUwNzY3NzQwZTU5NDFhMzA2MGY3YWEyNGU0IiwiaCI6Im11cm11cjY0In0="; 

const TIME_WINDOWS = {
    morning: [28800, 43200],   
    afternoon: [50400, 64800], 
    any: [28800, 64800]        
};

async function optimizeRoute(userId) {
    console.log(`🚀 Démarrage Optimisation User ${userId}...`);

    const [techs] = await db.query('SELECT * FROM technicians WHERE user_id = ?', [userId]);
    if (techs.length === 0) throw new Error("Aucun technicien configuré.");

    const [missions] = await db.query("SELECT * FROM missions WHERE status IN ('pending', 'assigned') AND user_id = ?", [userId]);
    if (missions.length === 0) return { message: "Aucune mission.", route: [], path: [], unassigned: [] };

    const jobs = missions.map(m => ({
        id: m.id,
        location: [parseFloat(m.lng), parseFloat(m.lat)],
        type: 'service',
        service: (m.duration_minutes || 30) * 60,
        time_windows: [ TIME_WINDOWS[m.time_slot] || TIME_WINDOWS.any ],
        description: m.client_name
    }));

    const vehicles = techs.map(t => ({
        id: t.id, 
        profile: "driving-car",
        start: [parseFloat(t.start_lng), parseFloat(t.start_lat)],
        end: [parseFloat(t.start_lng), parseFloat(t.start_lat)], 
        capacity: [t.capacity || 10],
        time_window: TIME_WINDOWS.any
    }));

    try {
        const response = await axios.post(
            'https://api.openrouteservice.org/optimization', 
            { jobs: jobs, vehicles: vehicles, options: { g: true } },
            { headers: { 'Authorization': API_KEY, 'Content-Type': 'application/json' } }
        );

        if (response.data.code && response.data.code !== 0) throw new Error(`Erreur IA: ${response.data.error}`);

        let allPaths = [];
        let formattedRoute = [];
        
        if (response.data.routes && response.data.routes.length > 0) {
            for (const routeData of response.data.routes) {
                if (routeData.geometry) {
                    allPaths = [...allPaths, ...polyline.decode(routeData.geometry)];
                }

                const assignedTechId = routeData.vehicle;
                const assignedTech = techs.find(t => t.id === assignedTechId);
                const techName = assignedTech ? assignedTech.name : "Inconnu";

                let order = 1;
                for (let step of routeData.steps) {
                    if (step.type === 'job') {
                        const m = missions.find(mis => mis.id === step.id);
                        
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
                            technician_name: techName,
                            // --- AJOUT DES NOUVEAUX CHAMPS ---
                            phone: m.phone,
                            comments: m.comments
                        });
                        order++;
                    }
                }
            }
        }

        let unassignedList = [];
        if (response.data.unassigned) {
            for (let rej of response.data.unassigned) {
                const m = missions.find(mis => mis.id === rej.id);
                if (m) {
                    await db.query('UPDATE missions SET status=?, technician_id=NULL WHERE id=? AND user_id=?', ['pending', m.id, userId]);
                    unassignedList.push({ client: m.client_name });
                }
            }
        }

        return { path: allPaths, route: formattedRoute, unassigned: unassignedList }; 

    } catch (error) {
        console.error("❌ Erreur Optimisation:", error.message);
        throw error;
    }
}

module.exports = optimizeRoute;