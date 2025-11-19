const axios = require('axios');

// Fonction qui transforme une adresse en { lat, lng }
async function getCoordinates(address) {
    try {
        // On prépare l'URL pour OpenStreetMap
        const url = 'https://nominatim.openstreetmap.org/search';
        
        const response = await axios.get(url, {
            params: {
                q: address,
                format: 'json',
                limit: 1
            },
            // IMPORTANT : Nominatim exige un "User-Agent" pour savoir qui l'utilise.
            // On met un nom bidon pour le dev, mais c'est obligatoire.
            headers: {
                'User-Agent': 'OptiRoute-App-Dev/1.0' 
            }
        });

        // Si on a trouvé une réponse
        if (response.data && response.data.length > 0) {
            const location = response.data[0];
            return {
                lat: parseFloat(location.lat),
                lng: parseFloat(location.lon),
                found: true
            };
        } else {
            return { found: false, error: "Adresse introuvable" };
        }

    } catch (error) {
        console.error('Erreur de géocodage:', error.message);
        return { found: false, error: error.message };
    }
}

module.exports = getCoordinates;