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
    console.log("🚀 Démarrage du Moteur V12 (OpenRouteService)...");

    if (API_KEY.trim() === "" || API_KEY === "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImExZWY5YzUwNzY3NzQwZTU5NDFhMzA2MGY3YWEyNGU0IiwiaCI6Im11cm11cjY0In0=") throw new Error("Clé API manquante ou incorrecte.");
    
    // 1. Récupération des données
    const [techs] = await db.query('SELECT * FROM technicians LIMIT 1');
    if (techs.length === 0) throw new Error("Aucun technicien trouvé.");
    const tech = techs[0];

    const [missions] = await db.query('SELECT * FROM missions WHERE status = "pending"');
    if (missions.length === 0) return { message: "Aucune mission à optimiser." };

    // 2. Préparation JSON
    const jobs = missions.map(m => {
        const window = TIME_WINDOWS[m.time_slot] || TIME_WINDOWS.any;
        return {
            id: m.id,
            location: [parseFloat(m.lng), parseFloat(m.lat)],
            service: 1800, 
            time_windows: [ window ],
            description: m.client_name
        };
    });

    const vehicle = {
        id: 1,
        profile: "driving-car",
        start: [parseFloat(tech.start_lng), parseFloat(tech.start_lat)],
        end: [parseFloat(tech.start_lng), parseFloat(tech.start_lat)],
        capacity: [10],
        time_window: TIME_WINDOWS.any
    };

    // 3. Appel API
    try {
        console.log("📡 Envoi des données à OpenRouteService...");
        
        const response = await axios.post(
            'https://api.openrouteservice.org/optimization', 
            { jobs: jobs, vehicles: [vehicle], options: { g: true } }, // Ajout de g: true pour la géométrie
            { headers: { 'Authorization': API_KEY, 'Content-Type': 'application/json' } }
        );

        // --- ZONE DE DIAGNOSTIC ---
        console.log("📥 Réponse reçue de l'API (Statut):", response.status);
        
        // Si l'API renvoie une erreur logique (code 200 mais avec une erreur dedans)
        if (response.data.code && response.data.error) {
            console.error("⚠️ L'API A REFUSÉ LE CALCUL :", response.data.error);
            throw new Error("L'IA refuse le calcul : " + response.data.error);
        }

        // Si la propriété 'routes' n'existe pas
        if (!response.data.routes || !Array.isArray(response.data.routes) || response.data.routes.length === 0) {
            console.error("⚠️ CONTENU DE LA RÉPONSE BIZARRE :", JSON.stringify(response.data, null, 2));
            throw new Error("L'IA n'a pas renvoyé de route valide (Liste vide).");
        }
        // --------------------------

        const routeData = response.data.routes[0];
        
        // Gestion de la géométrie (si absente, tableau vide)
        const geometryString = routeData.geometry; 
        const decodedPath = geometryString ? polyline.decode(geometryString) : [];
        
        const optimizedSteps = routeData.steps;
        
        console.log(`✅ Solution trouvée ! ${optimizedSteps.length - 2} missions planifiées.`);

        let formattedRoute = [];
        let orderCounter = 1;

        for (let step of optimizedSteps) {
            if (step.type === 'job') {
                const m = missions.find(mis => mis.id === step.id);

                await db.query(
                    'UPDATE missions SET technician_id = ?, route_order = ?, status = "assigned" WHERE id = ?', 
                    [tech.id, orderCounter, step.id]
                );

                formattedRoute.push({
                    step: orderCounter,
                    client: m.client_name,
                    time_slot: m.time_slot,
                    address: m.address,
                    lat: parseFloat(m.lat),
                    lng: parseFloat(m.lng),
                    distance_from_prev: (step.distance / 1000).toFixed(2) + " km" // Distance approximative
                });
                orderCounter++;
            }
        }

        // On renvoie l'objet complet
        return { path: decodedPath, route: formattedRoute }; 

    } catch (error) {
        console.error("❌ ERREUR DÉTAILLÉE :", error.message);
        if (error.response) {
            console.error("Données renvoyées par l'API lors de l'erreur :", JSON.stringify(error.response.data, null, 2));
        }
        throw error; 
    }
}

module.exports = optimizeRoute;