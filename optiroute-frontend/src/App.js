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

// --- CHARTE GRAPHIQUE & UI ---
const COLORS = {
    DARK: '#1e293b', // Un gris anthracite plus moderne (Slate-900)
    BLUE: '#3b82f6', // Un bleu royal vif (Blue-500)
    GREEN: '#10b981', // Emerald-500
    RED: '#ef4444',   // Red-500
    WHITE: '#ffffff',
    GLASS_BG: 'rgba(255, 255, 255, 0.85)', // Blanc semi-transparent pour l'effet blur
    BORDER: 'rgba(255, 255, 255, 0.4)', // Bordure subtile
    GRAY_TEXT: '#64748b', // Slate-500
    INPUT_BG: 'rgba(255, 255, 255, 0.9)', // Fond des inputs
    SUCCESS: '#10b981',
    WARNING: '#f59e0b'
};

const PILL_RADIUS = '12px'; 
const PANEL_RADIUS = '24px';

// CRÉATION DES MARQUEURS COLORES
const createCustomIcon = (index, total) => {
    let color = COLORS.BLUE;
    if (index === 0) color = COLORS.GREEN;
    if (index === total - 1) color = COLORS.RED;

    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="
            background-color: ${color};
            width: 28px;
            height: 28px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-family: 'Inter', sans-serif;
            font-size: 13px;
        ">${index + 1}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14]
    });
};

function App() {
    // ==========================================
    // 👇 TON IP ICI
    // ==========================================
    const API_URL = "https://optiroute-wxaz.onrender.com";
    // ==========================================

    const [route, setRoute] = useState([]);
    const [routePath, setRoutePath] = useState([]); 
    const [loading, setLoading] = useState(false);
    const [newName, setNewName] = useState("");
    const [newAddress, setNewAddress] = useState("");
    const [timeSlot, setTimeSlot] = useState("morning");

    const [screenWidth, setScreenWidth] = useState(window.innerWidth);
    
    // MODALS
    const [navModal, setNavModal] = useState(null); 
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const [resetSuccess, setResetSuccess] = useState(false);
    const [showEmptyModal, setShowEmptyModal] = useState(false);
    const [unassignedList, setUnassignedList] = useState([]); 
    const [showUnassignedModal, setShowUnassignedModal] = useState(false);

    // TEAM MANAGEMENT
    const [showTeamModal, setShowTeamModal] = useState(false);
    const [technicians, setTechnicians] = useState([]);
    const [newTechName, setNewTechName] = useState("");
    const [newTechAddress, setNewTechAddress] = useState("");
    
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const isMobileView = screenWidth < 768;
    const center = [48.8675, 2.3639]; 

    useEffect(() => {
        const handleResize = () => setScreenWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        fetchTechnicians();
    }, []);

    const fetchTechnicians = async () => {
        try {
            const res = await axios.get(`${API_URL}/technicians`);
            setTechnicians(res.data);
        } catch (e) { console.error("Erreur chargement techniciens"); }
    };

    const handleAddTech = async (e) => {
        e.preventDefault();
        if (!newTechName || !newTechAddress) return;
        try {
            await axios.post(`${API_URL}/technicians`, { name: newTechName, address: newTechAddress });
            setNewTechName(""); setNewTechAddress("");
            fetchTechnicians();
            alert("Technicien ajouté !");
        } catch (error) { alert("Erreur adresse ou serveur"); }
    };

    const handleDeleteTech = async (id) => {
        if(!window.confirm("Supprimer ce technicien ?")) return;
        try {
            await axios.delete(`${API_URL}/technicians/${id}`);
            fetchTechnicians();
        } catch (e) { alert("Erreur"); }
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
            setTimeout(() => fetchTechnicians(), 500); 
            setResetLoading(false); setResetSuccess(true);
            setTimeout(() => { setShowResetModal(false); setResetSuccess(false); }, 1500);
        } catch (error) { setResetLoading(false); alert("Erreur lors de la réinitialisation"); }
    };

    const renderClientName = (name, slot) => {
        let iconSrc = "/icon-morning.svg"; 
        if (slot === 'afternoon') iconSrc = "/icon-afternoon.svg";
        return (
            <div style={{display: 'flex', alignItems: 'center'}}>
                <img src={iconSrc} alt={slot} style={{width: '18px', height: '18px', marginRight: '8px', opacity: 0.7}} />
                <span style={{fontFamily: "'Inter', sans-serif", fontWeight: '600', fontSize: '15px', color: COLORS.DARK}}>{name}</span>
            </div>
        );
    };

    const getStepColor = (index, total) => {
        if (index === 0) return COLORS.GREEN;
        if (index === total - 1) return COLORS.RED;
        return COLORS.BLUE;
    };

    return (
        <div style={rootContainerStyle}>
            <style>
                {`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Oswald:wght@500;700&display=swap');`}
                {` .leaflet-control-attribution { display: none !important; } `}
                {` .leaflet-div-icon { background: transparent; border: none; } `}
                {` 
                    /* Scrollbar personnalisée */
                    ::-webkit-scrollbar { width: 6px; }
                    ::-webkit-scrollbar-track { background: transparent; }
                    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                    ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
                `}
            </style>
            
            {/* --- MAP CONTAINER (BACKGROUND) --- */}
            <div style={mapContainerStyle}>
                <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                    
                    {technicians.map(t => (
                        <Marker key={`tech-${t.id}`} position={[parseFloat(t.start_lat), parseFloat(t.start_lng)]}>
                            <Popup>🏠 {t.name}</Popup>
                        </Marker>
                    ))}

                    {route.map((step, index) => (
                        <Marker key={index} position={[step.lat, step.lng]} icon={createCustomIcon(index, route.length)}>
                            <Popup><strong>#{step.step}</strong> {step.client}</Popup>
                        </Marker>
                    ))}
                    
                    {routePath.length > 0 && (
                        <Polyline positions={routePath} color={COLORS.BLUE} weight={6} opacity={0.75} lineCap="round" lineJoin="round" /> 
                    )}
                </MapContainer>
            </div>

            {/* --- GLASS PANEL (FOREGROUND) --- */}
            <div style={glassPanelStyle(isMobileView)}>
                
                {/* HEADER */}
                <div style={panelHeaderStyle}>
                    <div style={{display:'flex', alignItems:'center'}}>
                        <img src="/logo-truck.svg" alt="Logo" style={{height: '32px', marginRight: '12px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'}} />
                        <h2 style={{margin: 0, color: COLORS.DARK, fontSize: '22px', fontFamily: "'Oswald', sans-serif", fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px'}}>
                            OptiRoute <span style={proTagStyle}>PRO</span>
                        </h2>
                    </div>
                </div>

                {/* CARD : AJOUT MISSION */}
                <div style={contentSectionStyle}>
                    <div style={headerWithButtonStyle}>
                        <h4 style={sectionTitleStyle}>NOUVEAU TRAJET</h4>
                        <button onClick={() => setShowTeamModal(true)} style={textButtonStyle}>
                            👥 Équipe
                        </button>
                    </div>
                    
                    <p style={helpTextStyle}>Ajoutez vos points de passage ci-dessous.</p>

                    <form onSubmit={handleAddMission}>
                        <input type="text" placeholder="Nom du client..." value={newName} onChange={(e) => setNewName(e.target.value)} style={inputStyle} />
                        <input type="text" placeholder="Adresse complète..." value={newAddress} onChange={(e) => setNewAddress(e.target.value)} style={inputStyle} />
                        
                        <div style={{position: 'relative', marginBottom: '15px', userSelect: 'none'}}>
                            <div onClick={() => setIsDropdownOpen(!isDropdownOpen)} style={{...inputStyle, display: 'flex', alignItems: 'center', cursor: 'pointer', position: 'relative'}}>
                                <img src={timeSlot === 'morning' ? '/icon-morning.svg' : '/icon-afternoon.svg'} alt="icon" style={{width: '18px', height: '18px', marginRight: '10px', opacity: 0.6}} />
                                <span style={{flex: 1, fontWeight: '500'}}>{timeSlot === 'morning' ? 'Matin (08h - 12h)' : 'Après-midi (14h - 18h)'}</span>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={COLORS.DARK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s', opacity: 0.5}}><path d="M6 9l6 6 6-6" /></svg>
                            </div>
                            {isDropdownOpen && (
                                <div style={dropdownStyle}>
                                    <div onClick={() => { setTimeSlot('morning'); setIsDropdownOpen(false); }} style={dropdownItemStyle}><img src="/icon-morning.svg" alt="M" style={{width: '18px', marginRight: '10px'}} />Matin</div>
                                    <div style={{height: '1px', background: '#f1f5f9', margin: '0 10px'}}></div>
                                    <div onClick={() => { setTimeSlot('afternoon'); setIsDropdownOpen(false); }} style={dropdownItemStyle}><img src="/icon-afternoon.svg" alt="A" style={{width: '18px', marginRight: '10px'}} />Après-midi</div>
                                </div>
                            )}
                        </div>
                        
                        <button type="submit" style={mainButtonStyle}>AJOUTER LA MISSION</button>
                    </form>
                </div>

                {/* ACTIONS */}
                <div style={actionButtonsContainerStyle}>
                    <div style={buttonsRowStyle}>
                        <button onClick={handleOptimize} disabled={loading} style={optimizeButtonStyle}>
                             {loading ? (
                                <span style={{fontSize: '14px', color: COLORS.BLUE, fontWeight: 'bold', fontFamily: "'Oswald', sans-serif", animation: 'pulse 1s infinite'}}>CALCUL EN COURS...</span> 
                             ) : (
                                 <div style={optimizeButtonInnerStyle}>
                                    <img src="/logo-truck.svg" alt="GO" style={{ width:'30px', height:'auto', marginRight:'10px' }} />
                                    <span>OPTIMISER</span>
                                 </div>
                             )}
                        </button>
                        <button onClick={openResetModal} style={resetButtonStyle} title="Réinitialiser">
                            <img src="/icon-trash.svg" alt="Reset" style={{width:'20px', opacity: 0.7}} />
                        </button>
                    </div>
                </div>

                {/* LISTE DES STOPS */}
                <div style={listContainerStyle}>
                    <h4 style={{...sectionTitleStyle, padding: '0 20px 10px 20px', borderBottom: '1px solid rgba(0,0,0,0.05)'}}>
                        FEUILLE DE ROUTE {route.length > 0 && <span style={counterBadgeStyle}>{route.length}</span>}
                    </h4>
                    
                    <div style={scrollableListStyle}>
                        {route.length === 0 ? (
                            <div style={emptyStateStyle}>
                                <div style={{fontSize: '32px', marginBottom: '10px'}}>📍</div>
                                <p style={{margin: 0, fontWeight: '500'}}>Aucun trajet planifié.</p>
                                <p style={{margin: '5px 0 0 0', fontSize: '12px', opacity: 0.6}}>Ajoutez des missions ci-dessus.</p>
                            </div>
                        ) : (
                            route.map((step, index) => {
                                const stepColor = getStepColor(index, route.length);
                                return (
                                    <div key={index} style={missionItemStyle}>
                                        <div style={{...stepNumberStyle, backgroundColor: stepColor}}>{step.step}</div>

                                        <div style={missionInfoStyle}>
                                            <div style={missionTitleStyle}>
                                                {renderClientName(step.client, step.time_slot)}
                                            </div>
                                            <div style={missionAddressStyle}>{step.address.substring(0, 35)}{step.address.length > 35 ? '...' : ''}</div>
                                            <div style={missionMetaContainerStyle}>
                                                 {step.technician_name && <span style={techTagStyle}>🚛 {step.technician_name}</span>}
                                                 <span style={distTagStyle}>📍 {step.distance_km} km</span>
                                            </div>
                                        </div>
                                        <button onClick={() => setNavModal({lat: step.lat, lng: step.lng})} style={navButtonStyle}>
                                            <img src="/icon-navigation.svg" alt="GPS" style={{width:'16px', opacity: 0.6}} />
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* --- MODALS (Gardent leur style clean) --- */}
            
            {/* MODAL EQUIPE */}
            {showTeamModal && (
                <div style={modalOverlayStyle} onClick={() => setShowTeamModal(false)}>
                    <div style={modalGlassContentStyle} onClick={(e) => e.stopPropagation()}>
                        <h3 style={modalTitleStyle}>MON ÉQUIPE</h3>
                        <div style={techListStyle}>
                            {technicians.map(t => (
                                <div key={t.id} style={techItemStyle}>
                                    <div>
                                        <div style={{fontWeight:'700', color: COLORS.DARK, fontSize: '14px'}}>{t.name}</div>
                                        <div style={{fontSize:'11px', color: COLORS.GRAY_TEXT}}>{t.address}</div>
                                    </div>
                                    <button onClick={() => handleDeleteTech(t.id)} style={deleteTechButtonStyle}>✕</button>
                                </div>
                            ))}
                        </div>
                        <form onSubmit={handleAddTech} style={{marginTop: '15px'}}>
                            <input type="text" placeholder="Nom (ex: Paul)" value={newTechName} onChange={(e) => setNewTechName(e.target.value)} style={inputStyle} />
                            <input type="text" placeholder="Départ (Adresse)..." value={newTechAddress} onChange={(e) => setNewTechAddress(e.target.value)} style={inputStyle} />
                            <button type="submit" style={{...mainButtonStyle, padding: '12px'}}>AJOUTER</button>
                        </form>
                        <button onClick={() => setShowTeamModal(false)} style={cancelButtonStyle}>FERMER</button>
                    </div>
                </div>
            )}

            {/* MODAL NAVIGATION */}
            {navModal && (
                <div style={modalOverlayStyle} onClick={() => setNavModal(null)}>
                    <div style={modalGlassContentStyle} onClick={(e) => e.stopPropagation()}>
                        <h3 style={modalTitleStyle}>LANCER GPS</h3>
                        <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                            <a href={`https://www.google.com/maps/dir/?api=1&destination=${navModal.lat},${navModal.lng}`} target="_blank" rel="noreferrer" style={gpsLinkStyle}><img src="/google.png" alt="G" style={gpsIconStyle}/>Google Maps</a>
                            <a href={`https://waze.com/ul?ll=${navModal.lat},${navModal.lng}&navigate=yes`} target="_blank" rel="noreferrer" style={gpsLinkStyle}><img src="/waze.png" alt="W" style={gpsIconStyle}/>Waze</a>
                            <a href={`http://maps.apple.com/?daddr=${navModal.lat},${navModal.lng}`} target="_blank" rel="noreferrer" style={gpsLinkStyle}><img src="/apple.png" alt="A" style={gpsIconStyle}/>Apple Plans</a>
                        </div>
                        <button onClick={() => setNavModal(null)} style={cancelButtonStyle}>RETOUR</button>
                    </div>
                </div>
            )}

            {/* MODAL UNASSIGNED */}
            {showUnassignedModal && (
                <div style={modalOverlayStyle} onClick={() => setShowUnassignedModal(false)}>
                    <div style={modalGlassContentStyle} onClick={(e) => e.stopPropagation()}>
                        <div style={{fontSize: '32px', marginBottom: '10px'}}>⚠️</div>
                        <h3 style={{...modalTitleStyle, color: COLORS.WARNING, marginBottom: '10px'}}>MISSIONS NON ASSIGNÉES</h3>
                        <p style={{color: COLORS.GRAY_TEXT, marginBottom: '15px', fontSize:'13px'}}>Impossible de planifier ces trajets (distance ou horaires) :</p>
                        <div style={unassignedBoxStyle}>
                            {unassignedList.map((item, i) => (
                                <div key={i} style={{fontWeight: '600', color: COLORS.DARK, marginBottom: '4px'}}>• {item.client}</div>
                            ))}
                        </div>
                        <button onClick={() => setShowUnassignedModal(false)} style={mainButtonStyle}>COMPRIS</button>
                    </div>
                </div>
            )}

            {/* MODAL RESET */}
            {showResetModal && (
                <div style={modalOverlayStyle} onClick={() => !resetLoading && setShowResetModal(false)}>
                    <div style={modalGlassContentStyle} onClick={(e) => e.stopPropagation()}>
                        {resetSuccess ? (
                            <div style={{padding: '10px 0'}}>
                                <h3 style={{...modalTitleStyle, color: COLORS.SUCCESS}}>✅ SUCCÈS</h3>
                            </div>
                        ) : (
                            <>
                                <h3 style={{...modalTitleStyle, color: COLORS.RED}}>ATTENTION</h3>
                                <p style={{color: COLORS.DARK, marginBottom: '20px', fontSize: '14px'}}>Tout effacer et recommencer ?</p>
                                <div style={{display: 'flex', gap: '10px'}}>
                                    <button onClick={() => setShowResetModal(false)} style={{...cancelButtonStyle, backgroundColor: '#f1f5f9', color: COLORS.DARK, marginTop:0}}>NON</button>
                                    <button onClick={confirmReset} style={{...mainButtonStyle, backgroundColor: COLORS.RED, marginTop:0}}>{resetLoading ? '...' : 'OUI'}</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL EMPTY */}
            {showEmptyModal && (
                <div style={modalOverlayStyle} onClick={() => setShowEmptyModal(false)}>
                    <div style={modalGlassContentStyle} onClick={(e) => e.stopPropagation()}>
                        <div style={{fontSize: '32px', marginBottom: '10px'}}>👋</div>
                        <h3 style={modalTitleStyle}>OPTIROUTE</h3>
                        <p style={{color: COLORS.GRAY_TEXT, marginBottom: '20px', fontSize:'14px'}}>Entrez des adresses à gauche pour commencer !</p>
                        <button onClick={() => setShowEmptyModal(false)} style={{...mainButtonStyle, backgroundColor: COLORS.BLUE}}>C'EST PARTI</button>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- STYLES (GLASSMORPHISM & UI REFRESH) ---

// Layout
const rootContainerStyle = { position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#e2e8f0', fontFamily: "'Inter', sans-serif" };
const mapContainerStyle = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 };

// Le Panneau "Glass" Flottant
const glassPanelStyle = (isMobile) => ({
    position: 'absolute',
    top: isMobile ? 'auto' : '20px',
    bottom: isMobile ? '0' : '20px',
    left: isMobile ? '0' : '20px',
    width: isMobile ? '100%' : '400px',
    height: isMobile ? '55vh' : 'auto',
    backgroundColor: COLORS.GLASS_BG,
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)', // Safari support
    borderRadius: isMobile ? `${PANEL_RADIUS} ${PANEL_RADIUS} 0 0` : PANEL_RADIUS,
    border: `1px solid ${COLORS.BORDER}`,
    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)', // Ombre douce glassmorphism
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    padding: '0',
    overflow: 'hidden',
    transition: 'all 0.3s ease'
});

// Contenus du panneau
const panelHeaderStyle = { padding: '20px 25px 15px 25px', borderBottom: '1px solid rgba(0,0,0,0.05)' };
const proTagStyle = { fontSize: '10px', backgroundColor: COLORS.BLUE, color: COLORS.WHITE, padding: '2px 6px', borderRadius: '4px', verticalAlign: 'middle', marginLeft: '6px' };

const contentSectionStyle = { padding: '20px 25px' };
const sectionTitleStyle = { margin: 0, fontSize: '12px', fontWeight: '700', color: COLORS.GRAY_TEXT, textTransform: 'uppercase', letterSpacing: '0.8px' };
const helpTextStyle = { color: '#94a3b8', fontSize: '12px', marginTop: '5px', marginBottom: '15px' };

const headerWithButtonStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' };
const textButtonStyle = { background: 'none', border: 'none', color: COLORS.BLUE, fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: 0 };

// Inputs & Formulaires
const inputStyle = { 
    width: '100%', 
    padding: '12px 16px', 
    marginBottom: '10px', 
    borderRadius: PILL_RADIUS, 
    border: '1px solid transparent', 
    backgroundColor: COLORS.INPUT_BG, 
    fontSize: '14px', 
    color: COLORS.DARK, 
    outline: 'none', 
    boxSizing: 'border-box', 
    fontWeight: '500',
    boxShadow: '0 2px 5px rgba(0,0,0,0.02)',
    transition: 'all 0.2s'
};
// Effet focus via CSS global ou inline interaction (simplifié ici)

const dropdownStyle = { position: 'absolute', top: '110%', left: 0, right: 0, backgroundColor: '#fff', borderRadius: PILL_RADIUS, padding: '5px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 50 };
const dropdownItemStyle = { padding: '10px 15px', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '14px', fontWeight: '500', borderRadius: '8px', color: COLORS.DARK };

// Boutons
const mainButtonStyle = { width: '100%', padding: '14px', backgroundColor: COLORS.DARK, color: COLORS.WHITE, border: 'none', borderRadius: PILL_RADIUS, fontWeight: '600', fontSize: '13px', cursor: 'pointer', marginTop: '5px', letterSpacing: '0.5px', transition: 'transform 0.1s active' };

const actionButtonsContainerStyle = { padding: '0 25px 20px 25px' };
const buttonsRowStyle = { display: 'flex', gap: '10px' };

const optimizeButtonStyle = { 
    flex: 1, 
    padding: '12px', 
    backgroundColor: COLORS.BLUE, 
    color: COLORS.WHITE, 
    border: 'none', 
    borderRadius: PILL_RADIUS, 
    cursor: 'pointer', 
    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' 
};
const optimizeButtonInnerStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '14px', letterSpacing: '1px', fontFamily: "'Oswald', sans-serif" };

const resetButtonStyle = { 
    width: '48px', 
    backgroundColor: '#fff', 
    border: '1px solid #e2e8f0', 
    borderRadius: PILL_RADIUS, 
    cursor: 'pointer', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center' 
};

// Liste des Missions
const listContainerStyle = { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.4)', borderTop: '1px solid rgba(255,255,255,0.5)', paddingTop: '15px' };
const scrollableListStyle = { flex: 1, overflowY: 'auto', padding: '0 20px 20px 20px' };
const counterBadgeStyle = { backgroundColor: COLORS.DARK, color: 'white', padding: '2px 6px', borderRadius: '10px', fontSize: '10px', verticalAlign: 'text-top', marginLeft: '5px' };

const emptyStateStyle = { textAlign: 'center', color: COLORS.GRAY_TEXT, padding: '40px 20px', border: '2px dashed rgba(0,0,0,0.1)', borderRadius: '16px', marginTop: '10px' };

const missionItemStyle = { 
    backgroundColor: '#fff', 
    padding: '12px', 
    marginBottom: '10px', 
    borderRadius: '16px', 
    display: 'flex', 
    alignItems: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
    border: '1px solid rgba(0,0,0,0.03)'
};

const stepNumberStyle = { 
    width: '28px', height: '28px', borderRadius: '50%', 
    display: 'flex', alignItems: 'center', justifyContent: 'center', 
    color: 'white', fontWeight: '700', fontSize: '12px', 
    marginRight: '12px', flexShrink: 0,
    boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
};

const missionInfoStyle = { flex: 1, minWidth: 0 };
const missionTitleStyle = { marginBottom: '2px' };
const missionAddressStyle = { color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const missionMetaContainerStyle = { display: 'flex', gap: '8px', marginTop: '6px' };

const techTagStyle = { fontSize: '10px', color: COLORS.BLUE, backgroundColor: '#eff6ff', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' };
const distTagStyle = { fontSize: '10px', color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' };

const navButtonStyle = { width: '32px', height: '32px', borderRadius: '10px', border: '1px solid #f1f5f9', backgroundColor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginLeft: '10px' };

// Modals Glass Style
const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' };

const modalGlassContentStyle = { 
    background: 'rgba(255, 255, 255, 0.95)', 
    backdropFilter: 'blur(16px)',
    padding: '30px', 
    borderRadius: '24px', 
    width: '90%', 
    maxWidth: '380px', 
    textAlign: 'center', 
    boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.5)'
};

const modalTitleStyle = { marginTop: 0, marginBottom: '15px', color: COLORS.DARK, fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', fontSize: '18px', letterSpacing: '1px' };

// Gestion Equipe Styles
const techListStyle = { maxHeight: '150px', overflowY: 'auto', marginBottom: '15px', textAlign:'left', backgroundColor: '#f8fafc', borderRadius: '12px', padding: '8px' };
const techItemStyle = { display:'flex', justifyContent:'space-between', alignItems: 'center', padding:'8px', borderBottom:'1px solid #e2e8f0' };
const deleteTechButtonStyle = { background:'rgba(239, 68, 68, 0.1)', border:'none', color: COLORS.RED, cursor:'pointer', width: '24px', height: '24px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' };

const gpsLinkStyle = { display: 'flex', alignItems: 'center', width: '100%', padding: '12px', backgroundColor: '#fff', color: COLORS.DARK, textDecoration: 'none', borderRadius: '12px', border: '1px solid #e2e8f0', fontWeight: '600', fontSize: '14px', boxSizing: 'border-box', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' };
const gpsIconStyle = { width: '20px', height: '20px', objectFit: 'contain', marginRight: '12px' };

const cancelButtonStyle = { marginTop: '15px', padding: '12px', width: '100%', border: 'none', background: 'transparent', color: COLORS.GRAY_TEXT, fontWeight:'600', cursor: 'pointer', fontSize: '13px' };
const unassignedBoxStyle = { textAlign: 'left', backgroundColor: '#fffbeb', padding: '12px', borderRadius: '12px', marginBottom: '20px', border: `1px solid ${COLORS.WARNING}`, fontSize: '13px' };

export default App;