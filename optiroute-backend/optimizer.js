const db = require('./db');

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
}
function deg2rad(deg) { return deg * (Math.PI / 180); }

function optimizeGroup(startLat, startLng, groupMissions, startOrderIndex) {
    let currentLat = startLat;
    let currentLng = startLng;
    let remaining = [...groupMissions];
    let sorted = [];
    let order = startOrderIndex;

    while (remaining.length > 0) {
        let nearestIndex = -1;
        let minDist = Infinity;

        for (let i = 0; i < remaining.length; i++) {
            const m = remaining[i];
            const dist = getDistance(currentLat, currentLng, parseFloat(m.lat), parseFloat(m.lng));
            if (dist < minDist) {
                minDist = dist;
                nearestIndex = i;
            }
        }

        const best = remaining[nearestIndex];
        sorted.push({ ...best, order: order, dist_prev: minDist });
        currentLat = parseFloat(best.lat);
        currentLng = parseFloat(best.lng);
        order++;
        remaining.splice(nearestIndex, 1);
    }
    return { sortedMissions: sorted, lastLat: currentLat, lastLng: currentLng, lastOrder: order };
}

async function optimizeRoute() {
    console.log("🚀 Optimisation PRO...");
    const [techs] = await db.query('SELECT * FROM technicians LIMIT 1');
    const tech = techs[0];
    const [missions] = await db.query('SELECT * FROM missions WHERE status = "pending"');

    if (missions.length === 0) return { message: "Aucune mission." };

    const morningMissions = missions.filter(m => m.time_slot === 'morning' || m.time_slot === 'any');
    const afternoonMissions = missions.filter(m => m.time_slot === 'afternoon');

    let finalRoute = [];
    let orderCounter = 1;

    const resMatin = optimizeGroup(parseFloat(tech.start_lat), parseFloat(tech.start_lng), morningMissions, orderCounter);
    finalRoute = [...finalRoute, ...resMatin.sortedMissions];
    orderCounter = resMatin.lastOrder;

    let startApremLat = resMatin.sortedMissions.length > 0 ? resMatin.lastLat : parseFloat(tech.start_lat);
    let startApremLng = resMatin.sortedMissions.length > 0 ? resMatin.lastLng : parseFloat(tech.start_lng);

    const resAprem = optimizeGroup(startApremLat, startApremLng, afternoonMissions, orderCounter);
    finalRoute = [...finalRoute, ...resAprem.sortedMissions];

    let formattedRoute = [];
    for (let item of finalRoute) {
        await db.query('UPDATE missions SET technician_id = ?, route_order = ?, status = "assigned" WHERE id = ?', [tech.id, item.order, item.id]);
        
        formattedRoute.push({
            step: item.order,
            client: item.client_name, // PLUS D'ÉMOJI ICI, JUSTE LE NOM
            time_slot: item.time_slot, // ON ENVOIE L'INFO SÉPARÉE
            address: item.address,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lng),
            distance_from_prev: item.dist_prev.toFixed(2) + " km"
        });
    }
    return formattedRoute;
}

module.exports = optimizeRoute;