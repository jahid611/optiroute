import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css'; 
import L from 'leaflet';

// FIX ICÔNES LEAFLET
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// --- CHARTE GRAPHIQUE ---
const COLORS = {
    DARK: '#3b4651', 
    BLUE: '#2b79c2', 
    GREEN: '#28a745', 
    RED: '#dc3545',   
    WHITE: '#ffffff',
    BORDER: '#dcdcde',
    GRAY_TEXT: '#6c757d',
    SUCCESS: '#28a745',
    WARNING: '#ff9800'
};

const PILL_RADIUS = '38px'; 
const STANDARD_RADIUS = '4px';

// CRÉATION DES MARQUEURS COLORÉS
const createCustomIcon = (index, total) => {
    let color = COLORS.BLUE;
    if (index === 0) color = COLORS.GREEN;
    if (index === total - 1) color = COLORS.RED;

    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="
            background-color: ${color};
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 3px 5px rgba(0,0,0,0.3);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-family: 'Inter', sans-serif;
            font-size: 12px;
        ">${index + 1}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12]
    });
};

function App() {
    // ==========================================
    // 👇 TON IP ICI
    // ==========================================
    const MY_IP = "192.168.1.17"; 
    const API_URL = `http://${MY_IP}:3001`; 
    // ==========================================

    const [route, setRoute] = useState([]);
    const [routePath, setRoutePath] = useState([]); 
    const [loading, setLoading] = useState(false);
    const [newName, setNewName] = useState("");
    const [newAddress, setNewAddress] = useState("");
    const [timeSlot, setTimeSlot] = useState("morning");

    const [screenWidth, setScreenWidth] = useState(window.innerWidth);
    const [navModal, setNavModal] = useState(null); 
    
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const [resetSuccess, setResetSuccess] = useState(false);
    const [showEmptyModal, setShowEmptyModal] = useState(false);
    
    const [unassignedList, setUnassignedList] = useState([]); 
    const [showUnassignedModal, setShowUnassignedModal] = useState(false); 

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const isMobileView = screenWidth < 768;
    const center = [48.8675, 2.3639]; 

    useEffect(() => {
        const handleResize = () => setScreenWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // --- PERSISTANCE DES DONNÉES (Sauvegarde Auto) ---
    useEffect(() => {
        const savedData = localStorage.getItem('optiroute_data');
        if (savedData) {
            try {
                const { savedRoute, savedPath } = JSON.parse(savedData);
                if (savedRoute && savedPath) {
                    setRoute(savedRoute);
                    setRoutePath(savedPath);
                }
            } catch (e) { console.error("Erreur lecture sauvegarde", e); }
        }
    }, []);

    const saveData = (newRoute, newPath) => {
        localStorage.setItem('optiroute_data', JSON.stringify({ savedRoute: newRoute, savedPath: newPath }));
    };

    const clearData = () => {
        localStorage.removeItem('optiroute_data');
    };

    const handleAddMission = async (e) => {
        e.preventDefault(); 
        if(!newName || !newAddress) return;
        try {
            const response = await axios.post(`${API_URL}/missions`, { client_name: newName, address: newAddress, time_slot: timeSlot });
            if(response.data.success) { setNewName(""); setNewAddress(""); } 
            else { alert("Erreur : " + response.data.message); }
        } catch (error) { alert("Erreur réseau !"); }
    };

    const handleOptimize = async () => {
        setLoading(true);
        setUnassignedList([]); 
        try {
            const response = await axios.get(`${API_URL}/optimize`);
            
            if (response.data.path && Array.isArray(response.data.route)) {
                setRoute(response.data.route);
                setRoutePath(response.data.path);
                saveData(response.data.route, response.data.path);
            } else {
                setRoute([]); 
            }

            if (response.data.unassigned && response.data.unassigned.length > 0) {
                setUnassignedList(response.data.unassigned);
                setShowUnassignedModal(true); 
            } else if (!response.data.route || response.data.route.length === 0) {
                 setShowEmptyModal(true);
            }

        } catch (error) { 
            console.error(error);
            setShowEmptyModal(true); 
        }
        setLoading(false);
    };

    const openResetModal = () => { setResetSuccess(false); setShowResetModal(true); };

    const confirmReset = async () => {
        setResetLoading(true);
        try {
            await axios.get(`${API_URL}/init-data`); 
            setRoute([]); setRoutePath([]); setUnassignedList([]);
            clearData();
            setResetLoading(false); setResetSuccess(true);
            setTimeout(() => { setShowResetModal(false); setResetSuccess(false); }, 1500);
        } catch (error) { setResetLoading(false); alert("Erreur lors de la réinitialisation"); }
    };

    const renderClientName = (name, slot) => {
        let iconSrc = "/icon-morning.svg"; 
        if (slot === 'afternoon') iconSrc = "/icon-afternoon.svg";
        return (
            <div style={{display: 'flex', alignItems: 'center'}}>
                <img src={iconSrc} alt={slot} style={{width: '18px', height: '18px', marginRight: '8px', opacity: 0.8}} />
                <span style={{fontFamily: "'Oswald', sans-serif", fontSize: '1.05em', letterSpacing: '0.3px', color: COLORS.DARK}}>{name}</span>
            </div>
        );
    };

    const getStepColor = (index, total) => {
        if (index === 0) return COLORS.GREEN;
        if (index === total - 1) return COLORS.RED;
        return COLORS.BLUE;
    };

    return (
        <div style={rootContainerStyle(isMobileView)}>
            <style>
                {`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Oswald:wght@500;700&display=swap');`}
                {` .leaflet-control-attribution { display: none !important; } `}
                {` .leaflet-div-icon { background: transparent; border: none; } `}
            </style>
            
            {navModal && (
                <div style={modalOverlayStyle} onClick={() => setNavModal(null)}>
                    <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
                        <h3 style={modalTitleStyle}>NAVIGATION</h3>
                        <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                            <a href={`https://www.google.com/maps/dir/?api=1&destination=${navModal.lat},${navModal.lng}`} target="_blank" rel="noreferrer" style={gpsLinkStyle}><img src="/google.png" alt="G" style={gpsIconStyle}/>Google Maps</a>
                            <a href={`https://waze.com/ul?ll=${navModal.lat},${navModal.lng}&navigate=yes`} target="_blank" rel="noreferrer" style={gpsLinkStyle}><img src="/waze.png" alt="W" style={gpsIconStyle}/>Waze</a>
                            <a href={`http://maps.apple.com/?daddr=${navModal.lat},${navModal.lng}`} target="_blank" rel="noreferrer" style={gpsLinkStyle}><img src="/apple.png" alt="A" style={gpsIconStyle}/>Apple Plans</a>
                        </div>
                        <button onClick={() => setNavModal(null)} style={cancelButtonStyle}>FERMER</button>
                    </div>
                </div>
            )}

            {/* MODAL MISSIONS IMPOSSIBLES (TEXTE MODIFIÉ) */}
            {showUnassignedModal && (
                <div style={modalOverlayStyle} onClick={() => setShowUnassignedModal(false)}>
                    <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
                        <div style={{fontSize: '40px', marginBottom: '10px'}}>⚠️</div>
                        <h3 style={{...modalTitleStyle, marginBottom: '15px', color: COLORS.WARNING}}>MISSIONS NON INTÉGRÉES</h3>
                        <p style={{fontFamily: "'Inter', sans-serif", color: COLORS.GRAY_TEXT, marginBottom: '15px', fontSize:'14px'}}>
                            OptiRoute n'a pas pu planifier les missions suivantes (Trop loin ou hors horaires) :
                        </p>
                        
                        <div style={{textAlign: 'left', backgroundColor: '#fff3e0', padding: '10px', borderRadius: '8px', marginBottom: '20px', border: `1px solid ${COLORS.WARNING}`}}>
                            {unassignedList.map((item, i) => (
                                <div key={i} style={{fontFamily: "'Oswald', sans-serif", color: COLORS.DARK, marginBottom: '5px'}}>
                                    • {item.client}
                                </div>
                            ))}
                        </div>

                        <button onClick={() => setShowUnassignedModal(false)} style={{...submitButtonStyle, marginTop: '0', backgroundColor: COLORS.DARK}}>COMPRIS</button>
                    </div>
                </div>
            )}

            {showResetModal && (
                <div style={modalOverlayStyle} onClick={() => !resetLoading && setShowResetModal(false)}>
                    <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
                        {resetSuccess ? (
                            <div style={{padding: '20px 0'}}>
                                <h3 style={{...modalTitleStyle, color: COLORS.SUCCESS, marginBottom: '10px'}}>✅ SUCCÈS</h3>
                                <p style={{fontFamily: "'Inter', sans-serif", color: COLORS.DARK, fontWeight: 'bold'}}>Données supprimées.</p>
                            </div>
                        ) : (
                            <>
                                <h3 style={{...modalTitleStyle, color: '#d32f2f'}}>ATTENTION</h3>
                                <p style={{fontFamily: "'Inter', sans-serif", color: COLORS.DARK, marginBottom: '25px'}}>Voulez-vous vraiment effacer toute la tournée ?</p>
                                <div style={{display: 'flex', gap: '10px'}}>
                                    <button onClick={() => setShowResetModal(false)} disabled={resetLoading} style={{...gpsLinkStyle, justifyContent: 'center', backgroundColor: '#fff', color: COLORS.DARK}}>NON</button>
                                    <button onClick={confirmReset} disabled={resetLoading} style={{...gpsLinkStyle, justifyContent: 'center', backgroundColor: COLORS.DARK, color: '#fff', border: `1px solid ${COLORS.DARK}`}}>{resetLoading ? '...' : 'OUI'}</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL LISTE VIDE (TEXTE MODIFIÉ) */}
            {showEmptyModal && (
                <div style={modalOverlayStyle} onClick={() => setShowEmptyModal(false)}>
                    <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
                        <div style={{fontSize: '40px', marginBottom: '15px'}}>👋</div>
                        <h3 style={{...modalTitleStyle, marginBottom: '15px', color: COLORS.DARK}}>OPTIROUTE</h3>
                        <p style={{fontFamily: "'Inter', sans-serif", color: COLORS.GRAY_TEXT, marginBottom: '25px', lineHeight: '1.5'}}>
                            Veuillez entrer des trajets ci-dessus pour commencer à rouler !
                        </p>
                        <button onClick={() => setShowEmptyModal(false)} style={{...submitButtonStyle, marginTop: '0', backgroundColor: COLORS.BLUE}}>C'EST COMPRIS</button>
                    </div>
                </div>
            )}

            <div style={mapContainerStyle(isMobileView)}>
                <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }} attributionControl={false}>
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                    <Marker position={center}><Popup>🏁 Dépôt</Popup></Marker>
                    
                    {route.map((step, index) => (
                        <Marker 
                            key={index} 
                            position={[step.lat, step.lng]}
                            icon={createCustomIcon(index, route.length)} 
                        >
                            <Popup><strong>#{step.step}</strong> {step.client}</Popup>
                        </Marker>
                    ))}
                    
                    {routePath.length > 0 && (
                        <Polyline positions={routePath} color={COLORS.BLUE} weight={5} opacity={0.8} /> 
                    )}
                </MapContainer>
            </div>

            <div style={panelContainerStyle(isMobileView)}>
                <div style={panelHeaderStyle}>
                    <div style={{display:'flex', alignItems:'center'}}>
                        <img src="/logo-truck.svg" alt="Logo" style={{height: '36px', marginRight: '15px'}} />
                        <h2 style={{margin: 0, color: COLORS.DARK, fontSize: '1.8em', fontFamily: "'Oswald', sans-serif", fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px'}}>
                            OptiRoute <span style={proTagStyle}>PRO</span>
                        </h2>
                    </div>
                </div>

                <div style={cardStyle}>
                    <div style={cardHeaderStyle}>
                        <img src="/icon-plus.svg" alt="+" style={{width:'18px', marginRight:'10px'}} />
                        <h4 style={{margin:0, color: COLORS.DARK, fontSize: '1.1em', fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', letterSpacing: '0.5px'}}>TRAJETS</h4>
                    </div>
                    
                    <p style={helpTextStyle}>Renseignez les informations ci-dessous pour ajouter un point de passage.</p>

                    <form onSubmit={handleAddMission}>
                        <input type="text" placeholder="Nom du client..." value={newName} onChange={(e) => setNewName(e.target.value)} style={inputStyle} />
                        <input type="text" placeholder="Adresse complète..." value={newAddress} onChange={(e) => setNewAddress(e.target.value)} style={inputStyle} />
                        
                        <div style={{position: 'relative', marginBottom: '20px', userSelect: 'none'}}>
                            <div onClick={() => setIsDropdownOpen(!isDropdownOpen)} style={{...inputStyle, display: 'flex', alignItems: 'center', cursor: 'pointer', position: 'relative'}}>
                                <img src={timeSlot === 'morning' ? '/icon-morning.svg' : '/icon-afternoon.svg'} alt="icon" style={{width: '20px', height: '20px', marginRight: '12px'}} />
                                <span style={{flex: 1}}>{timeSlot === 'morning' ? 'Matin (08h - 12h)' : 'Après-midi (14h - 18h)'}</span>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={COLORS.DARK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s'}}><path d="M6 9l6 6 6-6" /></svg>
                            </div>
                            {isDropdownOpen && (
                                <div style={{position: 'absolute', top: '110%', left: 0, right: 0, backgroundColor: COLORS.WHITE, border: `1px solid ${COLORS.DARK}`, borderRadius: '20px', zIndex: 100, boxShadow: '0 10px 30px rgba(0,0,0,0.15)', overflow: 'hidden', padding: '5px'}}>
                                    <div onClick={() => { setTimeSlot('morning'); setIsDropdownOpen(false); }} style={dropdownItemStyle}><img src="/icon-morning.svg" alt="M" style={{width: '20px', marginRight: '10px'}} />Matin (08h - 12h)</div>
                                    <div style={{height: '1px', background: '#eee', margin: '0 10px'}}></div>
                                    <div onClick={() => { setTimeSlot('afternoon'); setIsDropdownOpen(false); }} style={dropdownItemStyle}><img src="/icon-afternoon.svg" alt="A" style={{width: '20px', marginRight: '10px'}} />Après-midi (14h - 18h)</div>
                                </div>
                            )}
                        </div>
                        
                        <button type="submit" style={submitButtonStyle}>ENREGISTRER LA MISSION</button>
                    </form>
                </div>

                <div style={actionButtonsContainerStyle}>
                    <div style={buttonsRowStyle}>
                        <button onClick={handleOptimize} disabled={loading} style={optimizeButtonStyle}>
                             {loading ? (
                                <span style={{fontSize: '16px', color: COLORS.BLUE, fontWeight: 'bold', fontFamily: "'Oswald', sans-serif"}}>CALCUL...</span> 
                             ) : (
                                 <img src="/logo-truck.svg" alt="Optimize" style={{ width:'100px', height:'auto' }} />
                             )}
                        </button>
                        
                        <button onClick={openResetModal} style={resetButtonStyle}>
                            <img src="/icon-trash.svg" alt="Reset" style={{width:'28px'}} />
                        </button>
                    </div>

                    <p style={{...helpTextStyle, textAlign: 'center', marginTop: '15px', marginBottom: '0', width: '100%', maxWidth:'250px'}}>
                        Une fois vos trajets prêts, cliquez sur le camion pour lancer la mission !
                    </p>
                </div>

                <div style={{...cardStyle, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
                    <h4 style={{...cardTitleStyle, marginBottom: '5px', fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', fontSize: '1em', letterSpacing: '1px'}}>FEUILLE DE ROUTE</h4>
                    {/* TEXTE MODIFIÉ : PLUS DE MENTION D'IA */}
                    <p style={{...helpTextStyle, marginBottom: '15px'}}>L'ordre optimal calculé par OptiRoute s'affichera ici.</p>

                    <div style={missionsListStyle}>
                        {route.length === 0 ? (
                            <div style={{padding: '30px', textAlign: 'center', color: COLORS.DARK, border: `1px dashed ${COLORS.DARK}`, fontSize: '0.9em', fontFamily: "'Inter', sans-serif", borderRadius: STANDARD_RADIUS}}>
                                <span style={{fontSize: '40px', marginBottom: '10px', display:'block'}}>👋</span>
                                <h3 style={{margin: '0 0 10px 0', color: COLORS.DARK, fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', letterSpacing: '1px'}}>Bienvenue sur OptiRoute</h3>
                                <p style={{margin: 0, fontFamily: "'Inter', sans-serif", fontSize: '14px', maxWidth: '100%'}}>Veuillez entrer des destinations ci-dessus pour commencer votre optimisation.</p>
                            </div>
                        ) : (
                            route.map((step, index) => {
                                const stepColor = getStepColor(index, route.length);
                                return (
                                    <div key={index} style={missionItemStyle}>
                                        <div style={{
                                            backgroundColor: stepColor,
                                            color: 'white',
                                            width: '32px', height: '32px', borderRadius: '50%',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontWeight: 'bold', fontFamily: "'Inter', sans-serif",
                                            marginRight: '15px', boxShadow: '0 2px 5px rgba(0,0,0,0.15)', flexShrink: 0
                                        }}>{step.step}</div>

                                        <div style={missionInfoStyle}>
                                            <div style={missionTitleStyle}>
                                                {renderClientName(step.client, step.time_slot)}
                                            </div>
                                            <div style={missionAddressStyle}>{step.address.substring(0, 40)}...</div>
                                            <div style={{fontSize: '11px', color: COLORS.BLUE, marginTop: '4px', fontWeight: '600', fontFamily: "'Inter', sans-serif"}}>
                                                 📍 {step.distance_km} km 
                                            </div>
                                        </div>
                                        <button onClick={() => setNavModal({lat: step.lat, lng: step.lng})} style={compassButtonStyle}>
                                            <img src="/icon-navigation.svg" alt="GPS" style={{width:'20px'}} />
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- STYLES ---
const helpTextStyle = { color: COLORS.GRAY_TEXT, fontSize: '12px', fontFamily: "'Inter', sans-serif", fontStyle: 'italic', marginTop: '-5px', marginBottom: '15px', lineHeight: '1.4' };
const rootContainerStyle = (isMobile) => ({ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: isMobile ? 'auto' : '100vh', minHeight: '100vh', fontFamily: "'Inter', sans-serif", backgroundColor: '#f0f0f1', overflow: isMobile ? 'auto' : 'hidden' });
const mapContainerStyle = (isMobile) => ({ flex: isMobile ? 'none' : 1, height: isMobile ? '40vh' : '100%', order: isMobile ? 1 : 2, borderLeft: isMobile ? 'none' : `1px solid ${COLORS.DARK}`, zIndex: 0 });
const panelContainerStyle = (isMobile) => ({ width: isMobile ? '100%' : '450px', height: isMobile ? 'auto' : '100%', minHeight: isMobile ? '60vh' : '100%', backgroundColor: COLORS.WHITE, padding: '25px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', order: isMobile ? 2 : 1, zIndex: 1000, borderTop: isMobile ? `2px solid ${COLORS.DARK}` : 'none' });
const panelHeaderStyle = { marginBottom: '25px', paddingBottom: '20px', borderBottom: `2px solid ${COLORS.DARK}` };
const proTagStyle = { fontSize: '0.4em', backgroundColor: COLORS.BLUE, color: COLORS.WHITE, padding: '2px 6px', verticalAlign: 'top', marginLeft: '8px', fontFamily: "'Inter', sans-serif", fontWeight: '600', borderRadius: STANDARD_RADIUS };
const cardStyle = { marginBottom: '25px' };
const cardHeaderStyle = { display: 'flex', alignItems: 'center', marginBottom: '10px' };
const cardTitleStyle = { margin: 0, fontWeight: '700', color: COLORS.DARK };
const inputStyle = { width: '100%', padding: '14px 16px', marginBottom: '5px', borderRadius: PILL_RADIUS, border: `1px solid ${COLORS.DARK}`, backgroundColor: COLORS.WHITE, fontSize: '14px', fontFamily: "'Inter', sans-serif", color: COLORS.DARK, outline: 'none', boxSizing: 'border-box', fontWeight: '500' };
const dropdownItemStyle = { padding: '12px 15px', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '14px', fontFamily: "'Inter', sans-serif", color: COLORS.DARK, fontWeight: '500', borderRadius: '15px', transition: 'background 0.2s' };
const submitButtonStyle = { width: '100%', padding: '16px', backgroundColor: COLORS.DARK, color: COLORS.WHITE, border: 'none', borderRadius: PILL_RADIUS, fontWeight: '700', fontSize: '15px', letterSpacing: '1px', cursor: 'pointer', textTransform: 'uppercase', fontFamily: "'Oswald', sans-serif", marginTop: '10px' };
const actionButtonsContainerStyle = { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' };
const buttonsRowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '30px', width: '100%' };
const optimizeButtonStyle = { padding: '0', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', transition: 'transform 0.2s' };
const resetButtonStyle = { padding: '10px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', filter: 'invert(38%) sepia(75%) saturate(1968%) hue-rotate(189deg) brightness(92%) contrast(89%)' };
const missionsListStyle = { display: 'flex', flexDirection: 'column', border: `1px solid ${COLORS.DARK}`, overflowY: 'auto', flex: 1, borderRadius: STANDARD_RADIUS };
const missionItemStyle = { backgroundColor: COLORS.WHITE, padding: '16px', borderBottom: `1px solid ${COLORS.DARK}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const missionInfoStyle = { flex: 1, marginRight: '10px' };
const missionTitleStyle = { fontWeight: '700', fontSize: '15px', color: COLORS.DARK, display: 'flex', alignItems: 'center' };
const missionStepStyle = { marginRight: '15px', fontWeight: '900', fontSize: '18px', fontFamily: "'Oswald', sans-serif" };
const missionAddressStyle = { color: '#555', fontSize: '13px', marginTop: '4px', fontFamily: "'Inter', sans-serif" };
const compassButtonStyle = { backgroundColor: COLORS.WHITE, border: `1px solid ${COLORS.DARK}`, borderRadius: STANDARD_RADIUS, width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(59, 70, 81, 0.95)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const modalContentStyle = { background: COLORS.WHITE, padding: '35px', borderRadius: STANDARD_RADIUS, width: '90%', maxWidth: '350px', textAlign: 'center', border: `4px solid ${COLORS.BLUE}`, boxSizing: 'border-box' };
const modalTitleStyle = { marginTop: 0, marginBottom: '25px', color: COLORS.DARK, fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', fontSize: '1.4em', letterSpacing: '1px' };
const gpsLinkStyle = { display: 'flex', alignItems: 'center', width: '100%', padding: '18px', backgroundColor: '#f8f9fa', color: COLORS.DARK, textDecoration: 'none', borderRadius: STANDARD_RADIUS, border: `1px solid ${COLORS.DARK}`, fontWeight: '700', fontSize: '15px', fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', letterSpacing: '0.5px', boxSizing: 'border-box' };
const gpsIconStyle = { width: '26px', height: '26px', objectFit: 'contain', marginRight: '18px' };
const cancelButtonStyle = { marginTop: '25px', padding: '14px', width: '100%', border: 'none', background: COLORS.DARK, color: COLORS.WHITE, fontWeight:'700', cursor: 'pointer', borderRadius: STANDARD_RADIUS, fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', letterSpacing: '1px' };

export default App;