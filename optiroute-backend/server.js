const db = require('./db');
const axios = require('axios');
// ASSURE-TOI QUE CE MODULE EST BIEN INSTALLE : npm install polyline
const polyline = require('polyline'); 

// 👇 COLLE TA CLÉ API OPENROUTESERVICE ICI
const API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImExZWY5YzUwNzY3NzQwZTU5NDFhMzA2MGY3YWEyNGU0IiwiaCI6Im11cm11cjY0In0="; 

// --- CONFIGURATION DES HORAIRES EN SECONDES ---
const TIME_WINDOWS = {
    morning: [28800, 43200],   // 08h00 -> 12h00
    afternoon: [50400, 64800], // 14h00 -> 18h00
    any: [28800, 64800]        // 08h00 -> 18h00 (Toute la journée)
};

async function optimizeRoute() {
    console.log("🚀 Démarrage du Moteur V12 (OpenRouteService)...");

    if (API_KEY.trim() === "" || API_KEY.trim() === "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImExZWY5YzUwNzY3NzQwZTU5NDFhMzA2MGY3YWEyNGU0IiwiaCI6Im11cm11cjY0In0=") {
         throw new Error("ERREUR CRITIQUE: Veuillez coller votre clé API dans optimizer.js.");
    }
    
    // 1. Récupération des données locales
    const [techs] = await db.query('SELECT * FROM technicians LIMIT 1');
    const tech = techs[0];
    const [missions] = await db.query('SELECT * FROM missions WHERE status = "pending"');

    if (missions.length === 0) return { message: "Aucune mission à optimiser." };

    // 2. Préparation du JSON de la Requête
    const jobs = missions.map(m => {
        const window = TIME_WINDOWS[m.time_slot] || TIME_WINDOWS.any;
        return {
            id: m.id,
            location: [parseFloat(m.lng), parseFloat(m.lat)], // [Longitude, Latitude]
            type: 'service', 
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

    // 3. L'Appel API VROOM
    try {
        console.log("📡 Envoi des données à OpenRouteService...");
        
        const response = await axios.post(
            'https://api.openrouteservice.org/optimization', 
            { jobs: jobs, vehicles: [vehicle] },
            { headers: { 'Authorization': API_KEY, 'Content-Type': 'application/json' } }
        );

        const responseData = response.data;
        
        // VÉRIFICATION DU SOLVEUR
        if (responseData.error || responseData.code) {
            console.error("ERREUR SOLVEUR VROOM DÉTAILLÉE:", responseData.error || responseData.code);
            throw new Error(`Rejet de la requête: ${responseData.error || 'Problème de données'}. Vérifiez vos coordonnées/temps.`);
        }

        // 4. Traitement et Décodage de la Géométrie
        const geometryString = responseData.routes[0].geometry; // Le chemin codé
        const decodedPath = polyline.decode(geometryString); // Le chemin en [Lat, Lng]
        
        const optimizedSteps = responseData.routes[0].steps;
        console.log(`✅ Solution trouvée ! ${optimizedSteps.length - 2} missions planifiées.`);

        let formattedRoute = [];
        let orderCounter = 1;

        for (let step of optimizedSteps) {
            if (step.type === 'job') {
                const originalMission = missions.find(m => m.id === step.id);

                await db.query(
                    'UPDATE missions SET technician_id = ?, route_order = ?, status = "assigned" WHERE id = ?', 
                    [tech.id, orderCounter, step.id]
                );

                formattedRoute.push({
                    step: orderCounter,
                    client: originalMission.client_name,
                    time_slot: originalMission.time_slot,
                    address: originalMission.address,
                    lat: parseFloat(originalMission.lat),
                    lng: parseFloat(originalMission.lng),
                    distance_from_prev: (step.distance / 1000).toFixed(2) + " km"
                });
                orderCounter++;
            }
        }

        // 5. LE RETOUR FINAL : ENVOIE LE PATH ET LA ROUTE AU SERVEUR.JS
        return { path: decodedPath, route: formattedRoute }; 

    } catch (error) {
        console.error("❌ ERREUR VROOM/RÉSEAU: ", error.message);
        
        if (error.response) {
            console.error("STATUT HTTP REÇU:", error.response.status, "DÉTAIL ORS:", error.response.data);
            throw new Error(`Erreur API: Code ${error.response.status}. Vérifiez votre clé API.`);
        }
        
        throw new Error("L'optimisation a échoué. Problème réseau ou serveur ORS inaccessible.");
    }
}

module.exports = optimizeRoute;