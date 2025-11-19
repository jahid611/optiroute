const axios = require('axios');

// 👇 COLLE TA CLÉ API ICI (La même que dans optimizer.js)
const API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImExZWY5YzUwNzY3NzQwZTU5NDFhMzA2MGY3YWEyNGU0IiwiaCI6Im11cm11cjY0In0="; 

async function getCoordinates(address) {
    try {
        // On utilise le géocodeur PRO d'OpenRouteService (plus intelligent)
        // On ajoute &boundary.country=FR pour qu'il cherche en France en priorité
        const url = `https://api.openrouteservice.org/geocode/search?api_key=${API_KEY}&text=${encodeURIComponent(address)}&boundary.country=FR`;
        
        const response = await axios.get(url);

        // Vérification si on a trouvé quelque chose
        if (response.data && response.data.features && response.data.features.length > 0) {
            // ORS renvoie [Longitude, Latitude]
            const coords = response.data.features[0].geometry.coordinates;
            
            console.log(`📍 Adresse trouvée : ${address} -> [${coords[1]}, ${coords[0]}]`);

            return {
                lat: coords[1], // Latitude
                lng: coords[0], // Longitude
                found: true
            };
        } else {
            console.log("❌ Adresse introuvable via ORS :", address);
            return { found: false, error: "Adresse introuvable" };
        }

    } catch (error) {
        console.error('Erreur Geocoding ORS:', error.message);
        return { found: false, error: error.message };
    }
}

module.exports = getCoordinates;