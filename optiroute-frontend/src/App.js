import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css'; 
import L from 'leaflet';

// --- CONFIGURATION LEAFLET ---
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// --- DA "NIKE PRO" ---
const COLORS = {
    DARK: '#3b4651', 
    BLUE: '#2b79c2', 
    GREEN: '#28a745', 
    RED: '#dc3545',   
    WHITE: '#ffffff',
    BORDER: '#dcdcde',
    GRAY_TEXT: '#6c757d',
    BG_LIGHT: '#f0f0f1'
};

const PILL_RADIUS = '38px'; 
const STANDARD_RADIUS = '8px';
const SHADOW = '0 10px 30px rgba(0,0,0,0.15)';

// --- COMPOSANT INTELLIGENT : CONTRÔLE DE LA CARTE ---
// Permet de déplacer la caméra programmatiquement
function MapController({ center, bounds }) {
    const map = useMap();
    useEffect(() => {
        if (bounds && bounds.length > 0) {
            map.fitBounds(bounds, { padding: [50, 50] });
        } else if (center) {
            map.flyTo(center, 13, { duration: 1.5 });
        }
    }, [center, bounds, map]);
    return null;
}

// --- MARQUEURS CUSTOM ---
const createCustomIcon = (index, total) => {
    let color = COLORS.BLUE;
    if (index === 0) color = COLORS.GREEN;
    if (index === total - 1) color = COLORS.RED;

    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="
            background-color: ${color}; width: 24px; height: 24px; border-radius: 50%;
            border: 2px solid white; box-shadow: 0 3px 5px rgba(0,0,0,0.3);
            color: white; display: flex; align-items: center; justify-content: center;
            font-weight: bold; font-family: 'Inter', sans-serif; font-size: 12px;
        ">${index + 1}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12]
    });
};

function App() {
    const API_URL = "https://optiroute-wxaz.onrender.com";

    // --- STATES AUTH ---
    const [token, setToken] = useState(localStorage.getItem('optiroute_token'));
    const [userCompany, setUserCompany] = useState(localStorage.getItem('optiroute_company') || '');
    const [isLoginView, setIsLoginView] = useState(true);
    const [authEmail, setAuthEmail] = useState("");
    const [authPass, setAuthPass] = useState("");
    const [authCompany, setAuthCompany] = useState("");
    const [authError, setAuthError] = useState("");
    const [authLoading, setAuthLoading] = useState(false);

    // --- STATES APP ---
    const [route, setRoute] = useState([]);
    const [routePath, setRoutePath] = useState([]); 
    const [loading, setLoading] = useState(false);
    const [pendingMissions, setPendingMissions] = useState([]);

    // --- MAP STATES (POUR UX INTELLIGENTE) ---
    const [mapCenter, setMapCenter] = useState([48.8675, 2.3639]); // Paris par défaut
    const [mapBounds, setMapBounds] = useState(null);

    // --- FORMULAIRES ---
    const [newName, setNewName] = useState("");
    const [newAddress, setNewAddress] = useState("");
    const [timeSlot, setTimeSlot] = useState("morning");
    const [duration, setDuration] = useState(30);
    const [isAddingMission, setIsAddingMission] = useState(false);

    // --- MODALS & UX ---
    const [screenWidth, setScreenWidth] = useState(window.innerWidth);
    const [navModal, setNavModal] = useState(null); 
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const [showEmptyModal, setShowEmptyModal] = useState(false);
    const [unassignedList, setUnassignedList] = useState([]); 
    const [showUnassignedModal, setShowUnassignedModal] = useState(false);
    const [toast, setToast] = useState(null);

    // --- GESTION EQUIPE & CONFIRMATION SUPPRESSION ---
    const [showTeamModal, setShowTeamModal] = useState(false);
    const [technicians, setTechnicians] = useState([]);
    const [newTechName, setNewTechName] = useState("");
    const [newTechAddress, setNewTechAddress] = useState("");
    const [isAddingTech, setIsAddingTech] = useState(false);
    
    // État spécifique pour la suppression
    const [techToDelete, setTechToDelete] = useState(null); // ID du tech à supprimer
    const [isDeletingTech, setIsDeletingTech] = useState(false);

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const isMobileView = screenWidth < 768;

    // --- EFFETS ---
    useEffect(() => {
        const handleResize = () => setScreenWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => { if (token) fetchTechnicians(); }, [token]);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const getAuthHeaders = () => ({ headers: { Authorization: `Bearer ${token}` } });

    // --- ACTIONS AUTH ---
    const handleAuth = async (e) => {
        e.preventDefault();
        setAuthError(""); setAuthLoading(true);
        try {
            const endpoint = isLoginView ? '/auth/login' : '/auth/register';
            const payload = isLoginView ? { email: authEmail, password: authPass } : { email: authEmail, password: authPass, company_name: authCompany };
            const res = await axios.post(`${API_URL}${endpoint}`, payload);
            if (isLoginView) {
                localStorage.setItem('optiroute_token', res.data.token);
                localStorage.setItem('optiroute_company', res.data.company);
                setToken(res.data.token); setUserCompany(res.data.company);
            } else {
                alert("Compte créé ! Connectez-vous."); setIsLoginView(true);
            }
        } catch (err) { setAuthError(err.response?.data?.message || "Erreur de connexion"); } 
        finally { setAuthLoading(false); }
    };

    const handleLogout = () => {
        localStorage.removeItem('optiroute_token'); localStorage.removeItem('optiroute_company');
        setToken(null); setUserCompany(""); setRoute([]); setRoutePath([]); setPendingMissions([]);
    };

    // --- ACTIONS APP ---
    const fetchTechnicians = async () => {
        try {
            const res = await axios.get(`${API_URL}/technicians`, getAuthHeaders());
            setTechnicians(res.data);
        } catch (e) { if(e.response?.status === 401) handleLogout(); }
    };

    const handleAddTech = async (e) => {
        e.preventDefault();
        if (!newTechName || !newTechAddress) return;
        setIsAddingTech(true);
        try {
            // On triche un peu pour récupérer les coordonnées GPS côté front ou on attend le refresh
            // Idéalement l'API devrait renvoyer les coords du nouveau tech.
            // Pour l'instant on recharge tout.
            await axios.post(`${API_URL}/technicians`, { name: newTechName, address: newTechAddress }, getAuthHeaders());
            setNewTechName(""); setNewTechAddress("");
            
            // Rechargement et Focus Map
            const res = await axios.get(`${API_URL}/technicians`, getAuthHeaders());
            setTechnicians(res.data);
            
            // UX INTELLIGENTE : On centre la carte sur le dernier technicien ajouté
            const addedTech = res.data[res.data.length - 1];
            if (addedTech) {
                setMapCenter([parseFloat(addedTech.start_lat), parseFloat(addedTech.start_lng)]);
                setMapBounds(null); // On enlève les bounds pour prioriser le flyTo
            }

            setToast({ message: "Technicien ajouté", type: "success" });
        } catch (error) { alert("Erreur adresse ou serveur"); }
        finally { setIsAddingTech(false); }
    };

    // Déclenche la modale de confirmation
    const confirmDeleteTech = (id) => {
        setTechToDelete(id);
    };

    // Exécute la suppression réelle
    const executeDeleteTech = async () => {
        if (!techToDelete) return;
        setIsDeletingTech(true);
        try { 
            await axios.delete(`${API_URL}/technicians/${techToDelete}`, getAuthHeaders()); 
            await fetchTechnicians();
            setTechToDelete(null); // Ferme la modale
        } catch (e) { alert("Erreur suppression"); }
        finally { setIsDeletingTech(false); }
    };

    const handleAddMission = async (e) => {
        e.preventDefault(); 
        if(!newName || !newAddress) return;
        setIsAddingMission(true);
        try {
            const response = await axios.post(`${API_URL}/missions`, { client_name: newName, address: newAddress, time_slot: timeSlot, duration: duration }, getAuthHeaders());
            if(response.data.success) { 
                setPendingMissions([...pendingMissions, { name: newName, time: duration }]);
                setNewName(""); setNewAddress(""); 
                setToast({ message: "Mission ajoutée", type: "success" });
            } 
            else { alert(response.data.message); }
        } catch (error) { alert("Erreur réseau"); }
        finally { setIsAddingMission(false); }
    };

    const handleOptimize = async () => {
        setLoading(true); setUnassignedList([]); 
        try {
            const response = await axios.get(`${API_URL}/optimize`, getAuthHeaders());
            if (response.data.path && Array.isArray(response.data.route)) {
                setRoute(response.data.route); setRoutePath(response.data.path);
                setPendingMissions([]); 
                
                // UX INTELLIGENTE : On zoome pour voir tout le trajet
                // `path` est un tableau de [lat, lng], parfait pour les bounds
                if (response.data.path.length > 0) {
                    setMapBounds(response.data.path);
                }
            } else { setRoute([]); }

            if (response.data.unassigned?.length > 0) {
                setUnassignedList(response.data.unassigned); setShowUnassignedModal(true); 
            } else if (!response.data.route?.length) { setShowEmptyModal(true); }
        } catch (error) { console.error(error); alert("Erreur optimisation"); }
        finally { setLoading(false); }
    };

    const confirmReset = async () => {
        setResetLoading(true);
        try {
            await axios.get(`${API_URL}/init-data`, getAuthHeaders()); 
            setRoute([]); setRoutePath([]); setUnassignedList([]); setPendingMissions([]);
            setTimeout(() => fetchTechnicians(), 500); 
            setShowResetModal(false); setToast({ message: "Données effacées", type: "info" });
        } catch (error) { alert("Erreur"); }
        finally { setResetLoading(false); }
    };

    // --- RENDER HELPERS ---
    const renderClientName = (name, slot) => {
        let iconSrc = slot === 'afternoon' ? "/icon-afternoon.svg" : "/icon-morning.svg";
        return (
            <div style={{display: 'flex', alignItems: 'center'}}>
                <img src={iconSrc} alt="time" style={{width: '16px', height: '16px', marginRight: '8px', opacity: 0.8}} />
                <span style={{fontFamily: "'Oswald', sans-serif", fontSize: '1.05em', color: COLORS.DARK, textTransform:'uppercase', letterSpacing:'0.5px'}}>{name}</span>
            </div>
        );
    };
    const getStepColor = (index, total) => {
        if (index === 0) return COLORS.GREEN; if (index === total - 1) return COLORS.RED; return COLORS.BLUE;
    };

    // --- ECRAN DE LOGIN (NIKE PRO) ---
    if (!token) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: COLORS.DARK, color: 'white', fontFamily: "'Inter', sans-serif" }}>
            <div style={{ background: 'white', padding: '50px', borderRadius: STANDARD_RADIUS, width: '90%', maxWidth: '400px', color: COLORS.DARK, textAlign: 'center', boxShadow: SHADOW }}>
                <img src="/logo-truck.svg" alt="OptiRoute" style={{ height: '60px', marginBottom: '30px' }} />
                <h2 style={{ margin: '0 0 30px 0', fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', letterSpacing:'2px', fontSize:'24px' }}>{isLoginView ? "Connexion" : "Rejoindre"}</h2>
                
                {authError && <div style={{ color: COLORS.RED, marginBottom: '20px', fontSize: '14px', fontWeight:'600', border:`1px solid ${COLORS.RED}`, padding:'10px', borderRadius:STANDARD_RADIUS }}>{authError}</div>}
                
                <form onSubmit={handleAuth}>
                    {!isLoginView && <input type="text" placeholder="NOM DE L'ENTREPRISE" required value={authCompany} onChange={e => setAuthCompany(e.target.value)} style={inputStyle} />}
                    <input type="email" placeholder="EMAIL" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} style={inputStyle} />
                    <input type="password" placeholder="MOT DE PASSE" required value={authPass} onChange={e => setAuthPass(e.target.value)} style={inputStyle} />
                    <button type="submit" disabled={authLoading} style={{...submitButtonStyle, marginTop:'20px'}}>
                        {authLoading ? "CHARGEMENT..." : (isLoginView ? "ENTRER" : "CRÉER COMPTE")}
                    </button>
                </form>
                <div style={{ marginTop: '25px', fontSize: '13px', color: COLORS.GRAY_TEXT, cursor: 'pointer', textDecoration: 'underline', fontWeight:'500' }} onClick={() => setIsLoginView(!isLoginView)}>
                    {isLoginView ? "Créer un compte entreprise" : "J'ai déjà un compte"}
                </div>
            </div>
        </div>
    );

    // --- APPLICATION PRINCIPALE ---
    return (
        <div style={rootContainerStyle(isMobileView)}>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Oswald:wght@500;700&display=swap'); .leaflet-control-attribution { display: none !important; } .leaflet-div-icon { background: transparent; border: none; }`}</style>
            
            {/* --- TOAST NOTIFICATION (NIKE STYLE) --- */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)',
                    backgroundColor: toast.type === 'success' ? COLORS.DARK : COLORS.BLUE, color: 'white',
                    padding: '15px 30px', borderRadius: PILL_RADIUS, boxShadow: SHADOW,
                    zIndex: 99999, fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', letterSpacing:'1px', fontSize: '14px',
                    display: 'flex', alignItems: 'center', animation: 'fadeIn 0.3s ease-out'
                }}>
                    <img src="/logo-truck.svg" alt="" style={{width:'20px', height:'20px', marginRight:'15px', filter:'invert(1)'}}/>
                    {toast.message}
                </div>
            )}

            {/* --- MODAL SUPPRESSION TECHNICIEN (STYLE) --- */}
            {techToDelete && (
                <div style={modalOverlayStyle} onClick={() => !isDeletingTech && setTechToDelete(null)}>
                    <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                        <img src="/icon-trash.svg" alt="Del" style={{width:'40px', marginBottom:'15px'}} />
                        <h3 style={{...modalTitleStyle, color: COLORS.DARK}}>SUPPRIMER ?</h3>
                        <p style={{fontFamily:"'Inter', sans-serif", color:COLORS.GRAY_TEXT, marginBottom:'25px'}}>Cette action est irréversible.</p>
                        <div style={{display:'flex', gap:'10px'}}>
                            <button onClick={() => setTechToDelete(null)} style={{...cancelButtonStyle, backgroundColor:'white', color:COLORS.DARK, border:`1px solid ${COLORS.BORDER}`, marginTop:0}}>NON</button>
                            <button onClick={executeDeleteTech} style={{...submitButtonStyle, marginTop:0, backgroundColor:COLORS.RED}}>
                                {isDeletingTech ? "..." : "OUI, SUPPRIMER"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL EQUIPE --- */}
            {showTeamModal && (
                <div style={modalOverlayStyle} onClick={() => setShowTeamModal(false)}>
                    <div style={{...modalContentStyle, maxWidth:'450px', padding:'40px'}} onClick={e => e.stopPropagation()}>
                        <div style={{display:'flex', alignItems:'center', marginBottom:'30px', borderBottom:`2px solid ${COLORS.DARK}`, paddingBottom:'15px'}}>
                            <h3 style={{margin:0, fontFamily:"'Oswald', sans-serif", fontSize:'24px', textTransform:'uppercase'}}>MON ÉQUIPE</h3>
                            <span style={{marginLeft:'auto', background:COLORS.BLUE, color:'white', borderRadius:'12px', padding:'2px 8px', fontSize:'12px', fontWeight:'bold'}}>{technicians.length}</span>
                        </div>
                        
                        <div style={{maxHeight: '200px', overflowY: 'auto', marginBottom: '30px', paddingRight:'5px'}}>
                            {technicians.map(t => (
                                <div key={t.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'15px', marginBottom:'10px', border:`1px solid ${COLORS.BORDER}`, borderRadius:STANDARD_RADIUS, backgroundColor: '#fafafa'}}>
                                    <div>
                                        <div style={{fontWeight:'700', color: COLORS.DARK, fontFamily: "'Oswald', sans-serif", fontSize:'16px', textTransform:'uppercase'}}>{t.name}</div>
                                        <div style={{fontSize:'12px', color: COLORS.GRAY_TEXT, fontFamily:"'Inter', sans-serif"}}>{t.address}</div>
                                    </div>
                                    <button onClick={() => confirmDeleteTech(t.id)} style={{background:'transparent', border:'none', cursor:'pointer', opacity:0.6, transition:'0.2s'}}>
                                        <img src="/icon-trash.svg" alt="Del" style={{width:'20px'}} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        
                        <form onSubmit={handleAddTech}>
                            <div style={{textAlign:'left', marginBottom:'5px', fontSize:'12px', fontWeight:'bold', color:COLORS.GRAY_TEXT}}>NOUVEAU TECHNICIEN</div>
                            <input type="text" placeholder="Nom (ex: Thomas)" value={newTechName} onChange={(e) => setNewTechName(e.target.value)} style={inputStyle} />
                            <input type="text" placeholder="Adresse de départ..." value={newTechAddress} onChange={(e) => setNewTechAddress(e.target.value)} style={inputStyle} />
                            <button type="submit" disabled={isAddingTech} style={{...submitButtonStyle, marginTop: '10px'}}>
                                {isAddingTech ? "ENREGISTREMENT..." : "AJOUTER À L'ÉQUIPE"}
                            </button>
                        </form>
                        <button onClick={() => setShowTeamModal(false)} style={{...cancelButtonStyle, background:'transparent', color:COLORS.GRAY_TEXT, border:'none', textDecoration:'underline', fontSize:'12px'}}>FERMER</button>
                    </div>
                </div>
            )}

            {/* --- MODAL NAVIGATION --- */}
            {navModal && (<div style={modalOverlayStyle} onClick={() => setNavModal(null)}><div style={modalContentStyle} onClick={e => e.stopPropagation()}><h3 style={modalTitleStyle}>NAVIGATION</h3><div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}><a href={`https://waze.com/ul?ll=${navModal.lat},${navModal.lng}&navigate=yes`} target="_blank" rel="noreferrer" style={gpsLinkStyle}><img src="/waze.png" alt="W" style={gpsIconStyle}/>Waze</a><a href={`https://www.google.com/maps/dir/?api=1&destination=${navModal.lat},${navModal.lng}`} target="_blank" rel="noreferrer" style={gpsLinkStyle}><img src="/google.png" alt="G" style={gpsIconStyle}/>Google Maps</a></div><button onClick={() => setNavModal(null)} style={cancelButtonStyle}>FERMER</button></div></div>)}

            {/* --- MODAL RESET --- */}
            {showResetModal && (<div style={modalOverlayStyle} onClick={() => !resetLoading && setShowResetModal(false)}><div style={modalContentStyle} onClick={e => e.stopPropagation()}><img src="/icon-trash.svg" alt="!" style={{width:'40px', marginBottom:'15px'}}/ ><h3 style={modalTitleStyle}>RESET COMPLET ?</h3><p style={{fontFamily:"'Inter', sans-serif", color:COLORS.GRAY_TEXT, marginBottom:'25px'}}>Toutes les missions et techniciens seront effacés.</p><div style={{display:'flex', gap:'10px'}}><button onClick={()=>setShowResetModal(false)} style={{...cancelButtonStyle, backgroundColor:'white', color:COLORS.DARK, border:`1px solid ${COLORS.BORDER}`, marginTop:0}}>ANNULER</button><button onClick={confirmReset} style={{...submitButtonStyle, marginTop:0, backgroundColor:COLORS.DARK}}>{resetLoading ? "..." : "CONFIRMER"}</button></div></div></div>)}
            
            {/* --- MODAL EMPTY / REJECTED --- */}
            {showEmptyModal && (<div style={modalOverlayStyle} onClick={() => setShowEmptyModal(false)}><div style={modalContentStyle} onClick={e => e.stopPropagation()}><img src="/logo-truck.svg" alt="Info" style={{width:'50px', marginBottom:'15px'}} /><h3 style={modalTitleStyle}>OPTIROUTE</h3><p style={{fontFamily:"'Inter', sans-serif", color:COLORS.GRAY_TEXT, marginBottom:'25px'}}>Ajoutez des missions avant de lancer le calcul.</p><button onClick={() => setShowEmptyModal(false)} style={submitButtonStyle}>OK</button></div></div>)}
            
            {showUnassignedModal && (<div style={modalOverlayStyle} onClick={() => setShowUnassignedModal(false)}><div style={modalContentStyle} onClick={e => e.stopPropagation()}><h3 style={{...modalTitleStyle, color: COLORS.WARNING}}>MISSIONS IMPOSSIBLES</h3><p style={{fontFamily: "'Inter', sans-serif", color: COLORS.GRAY_TEXT, marginBottom:'15px'}}>Certaines adresses sont trop loin ou hors horaires :</p><div style={{textAlign: 'left', backgroundColor: '#fff3e0', padding: '15px', borderRadius: STANDARD_RADIUS, marginBottom: '20px', border: `1px solid ${COLORS.WARNING}`, maxHeight:'150px', overflowY:'auto'}}>{unassignedList.map((item, i) => (<div key={i} style={{fontFamily: "'Oswald', sans-serif", color: COLORS.DARK, marginBottom: '5px', fontSize:'14px'}}>• {item.client}</div>))}</div><button onClick={() => setShowUnassignedModal(false)} style={submitButtonStyle}>COMPRIS</button></div></div>)}

            {/* --- LAYOUT PRINCIPAL --- */}
            <div style={mapContainerStyle(isMobileView)}>
                <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                    <MapController center={mapCenter} bounds={mapBounds} />
                    
                    {technicians.map(t => (<Marker key={`tech-${t.id}`} position={[parseFloat(t.start_lat), parseFloat(t.start_lng)]}><Popup><div style={{fontFamily:"'Oswald', sans-serif", textTransform:'uppercase'}}>🏠 {t.name}</div></Popup></Marker>))}
                    
                    {route.map((step, index) => (<Marker key={index} position={[step.lat, step.lng]} icon={createCustomIcon(index, route.length)}><Popup><strong style={{fontFamily:"'Oswald', sans-serif"}}>#{step.step} {step.client}</strong><br/><span style={{fontFamily:"'Inter', sans-serif", fontSize:'11px'}}>🕐 {step.time_slot}</span></Popup></Marker>))}
                    
                    {routePath.length > 0 && <Polyline positions={routePath} color={COLORS.BLUE} weight={5} opacity={0.8} />}
                </MapContainer>
            </div>

            <div style={panelContainerStyle(isMobileView)}>
                <div style={panelHeaderStyle}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                        <div style={{display:'flex', alignItems:'center'}}>
                            <img src="/logo-truck.svg" alt="Logo" style={{height: '36px', marginRight: '15px'}} />
                            <div><h2 style={{margin: 0, color: COLORS.DARK, fontSize: '1.8em', fontFamily: "'Oswald', sans-serif", fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px'}}>OptiRoute <span style={proTagStyle}>PRO</span></h2><div style={{fontSize: '12px', color: COLORS.GRAY_TEXT, marginTop: '2px', fontFamily:"'Inter', sans-serif", fontWeight:'500'}}>{userCompany}</div></div>
                        </div>
                        <button onClick={handleLogout} style={{background: 'transparent', border: 'none', color: COLORS.RED, cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', textDecoration:'underline', fontFamily:"'Inter', sans-serif"}}>DÉCONNEXION</button>
                    </div>
                </div>

                <div style={cardStyle}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
                        <div style={{display: 'flex', alignItems: 'center'}}><img src="/icon-plus.svg" alt="+" style={{width:'16px', marginRight:'8px'}} /><h4 style={{margin:0, color: COLORS.DARK, fontSize: '14px', fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', letterSpacing: '1px'}}>NOUVELLE MISSION</h4></div>
                        <button onClick={() => setShowTeamModal(true)} style={{background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px', color: COLORS.BLUE, fontFamily: "'Inter', sans-serif", fontWeight: '600', textDecoration: 'underline'}}>GÉRER L'ÉQUIPE</button>
                    </div>
                    
                    <form onSubmit={handleAddMission}>
                        <input type="text" placeholder="NOM DU CLIENT" value={newName} onChange={(e) => setNewName(e.target.value)} style={inputStyle} />
                        <input type="text" placeholder="ADRESSE COMPLÈTE" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} style={inputStyle} />
                        
                        <div style={{display:'flex', gap:'10px', marginBottom:'10px'}}>
                            <div style={{position: 'relative', flex: 1, userSelect: 'none'}}>
                                <div onClick={() => setIsDropdownOpen(!isDropdownOpen)} style={{...inputStyle, display: 'flex', alignItems: 'center', cursor: 'pointer', position: 'relative', marginBottom:0}}>
                                    <img src={timeSlot === 'morning' ? '/icon-morning.svg' : '/icon-afternoon.svg'} alt="time" style={{width: '18px', marginRight: '10px'}} />
                                    <span style={{flex: 1, fontSize:'13px', textTransform:'uppercase', fontWeight:'600'}}>{timeSlot === 'morning' ? 'MATIN' : 'APRÈS-MIDI'}</span>
                                </div>
                                {isDropdownOpen && (
                                    <div style={{position: 'absolute', top: '110%', left: 0, right: 0, backgroundColor: COLORS.WHITE, border: `1px solid ${COLORS.DARK}`, borderRadius: '20px', zIndex: 100, boxShadow: SHADOW, overflow: 'hidden', padding: '5px'}}>
                                        <div onClick={() => { setTimeSlot('morning'); setIsDropdownOpen(false); }} style={dropdownItemStyle}><img src="/icon-morning.svg" alt="M" style={{width: '18px', marginRight: '10px'}} />MATIN</div>
                                        <div style={{height: '1px', background: '#eee', margin: '0 10px'}}></div>
                                        <div onClick={() => { setTimeSlot('afternoon'); setIsDropdownOpen(false); }} style={dropdownItemStyle}><img src="/icon-afternoon.svg" alt="A" style={{width: '18px', marginRight: '10px'}} />APRÈS-MIDI</div>
                                    </div>
                                )}
                            </div>
                            <div style={{width: '90px', position:'relative'}}>
                                <input type="number" min="5" step="5" value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 30)} style={{...inputStyle, textAlign:'center', marginBottom:0, paddingRight:'25px'}} />
                                <span style={{position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', fontSize:'10px', color:COLORS.GRAY_TEXT, fontWeight:'bold'}}>MIN</span>
                            </div>
                        </div>

                        <button type="submit" disabled={isAddingMission} style={{...submitButtonStyle, opacity: isAddingMission ? 0.7 : 1}}>
                            {isAddingMission ? "ENREGISTREMENT..." : "AJOUTER AU TRAJET"}
                        </button>
                    </form>
                </div>

                {/* PANIER DE MISSIONS */}
                {pendingMissions.length > 0 && (
                    <div style={{marginBottom: '20px', border: `1px dashed ${COLORS.BLUE}`, borderRadius: STANDARD_RADIUS, padding: '15px', backgroundColor: 'rgba(43, 121, 194, 0.05)'}}>
                         <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
                            <h5 style={{margin:0, color:COLORS.BLUE, fontFamily:"'Oswald', sans-serif", fontSize:'14px'}}>EN ATTENTE ({pendingMissions.length})</h5>
                         </div>
                         <div style={{maxHeight:'80px', overflowY:'auto'}}>
                            {pendingMissions.map((pm, idx) => (
                                <div key={idx} style={{fontSize:'12px', marginBottom:'4px', display:'flex', alignItems:'center', fontFamily:"'Inter', sans-serif"}}>
                                    <div style={{width:'6px', height:'6px', borderRadius:'50%', background:COLORS.BLUE, marginRight:'8px'}}></div>
                                    <span style={{fontWeight:'600', marginRight:'5px', color:COLORS.DARK}}>{pm.name}</span> 
                                    <span style={{color:COLORS.GRAY_TEXT}}>({pm.time} min)</span>
                                </div>
                            ))}
                         </div>
                    </div>
                )}

                <div style={actionButtonsContainerStyle}>
                    <div style={buttonsRowStyle}>
                        <button onClick={handleOptimize} disabled={loading} style={optimizeButtonStyle}>
                             {loading ? (
                                <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                                    <img src="/logo-truck.svg" alt="..." style={{width:'60px', opacity:0.5}} />
                                    <span style={{fontSize: '12px', color: COLORS.BLUE, fontWeight: 'bold', fontFamily: "'Oswald', sans-serif", marginTop:'5px'}}>OPTIMISATION...</span> 
                                </div>
                             ) : (
                                 <div style={{position:'relative'}}>
                                     <img src="/logo-truck.svg" alt="Optimize" style={{ width:'100px', height:'auto', filter: 'drop-shadow(0px 5px 10px rgba(0,0,0,0.2))' }} />
                                     {pendingMissions.length > 0 && <div style={{position:'absolute', top:'-5px', right:'-5px', background:COLORS.RED, color:'white', borderRadius:'50%', width:'24px', height:'24px', fontSize:'12px', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'bold', border:'2px solid white', boxShadow:'0 2px 5px rgba(0,0,0,0.2)'}}>{pendingMissions.length}</div>}
                                 </div>
                             )}
                        </button>
                        <button onClick={()=>setShowResetModal(true)} style={resetButtonStyle}>
                            <img src="/icon-trash.svg" alt="Reset" style={{width:'28px', opacity:0.6}} />
                        </button>
                    </div>
                </div>

                <div style={{...cardStyle, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
                    <h4 style={{...cardTitleStyle, marginBottom: '10px', fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', fontSize: '14px', letterSpacing: '1px', borderBottom:`1px solid ${COLORS.BORDER}`, paddingBottom:'5px'}}>FEUILLE DE ROUTE</h4>
                    <div style={missionsListStyle}>
                        {route.length === 0 ? (
                            <div style={{padding: '30px', textAlign: 'center', color: COLORS.GRAY_TEXT, fontSize: '0.9em', fontFamily: "'Inter', sans-serif"}}>
                                <div style={{opacity:0.3, fontSize:'40px', marginBottom:'10px'}}>🗺️</div>
                                <p style={{margin: 0}}>La carte est vide.</p>
                            </div>
                        ) : (
                            route.map((step, index) => {
                                const stepColor = getStepColor(index, route.length);
                                return (
                                    <div key={index} style={missionItemStyle}>
                                        <div style={{backgroundColor: stepColor, color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontFamily: "'Inter', sans-serif", marginRight: '15px', boxShadow: '0 2px 5px rgba(0,0,0,0.15)', flexShrink: 0}}>{step.step}</div>
                                        <div style={missionInfoStyle}>
                                            <div style={missionTitleStyle}>{renderClientName(step.client, step.time_slot)}</div>
                                            <div style={missionAddressStyle}>{step.address.substring(0, 35)}...</div>
                                            <div style={{fontSize: '10px', color: COLORS.BLUE, marginTop: '4px', fontWeight: '600', fontFamily: "'Inter', sans-serif", textTransform:'uppercase'}}>{step.technician_name ? `🚛 ${step.technician_name} • ` : ''}📍 {step.distance_km} km</div>
                                        </div>
                                        <button onClick={() => setNavModal({lat: step.lat, lng: step.lng})} style={compassButtonStyle}><img src="/icon-navigation.svg" alt="GPS" style={{width:'18px'}} /></button>
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

// --- STYLES CSS-IN-JS STRICTS (NIKE PRO) ---
const rootContainerStyle = (isMobile) => ({ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: isMobile ? 'auto' : '100vh', minHeight: '100vh', fontFamily: "'Inter', sans-serif", backgroundColor: COLORS.BG_LIGHT, overflow: isMobile ? 'auto' : 'hidden' });
const mapContainerStyle = (isMobile) => ({ flex: isMobile ? 'none' : 1, height: isMobile ? '40vh' : '100%', order: isMobile ? 1 : 2, borderLeft: isMobile ? 'none' : `1px solid ${COLORS.DARK}`, zIndex: 0 });
const panelContainerStyle = (isMobile) => ({ 
    width: isMobile ? '100%' : '450px', 
    height: isMobile ? 'auto' : '100%', 
    minHeight: isMobile ? '60vh' : '100%', 
    backgroundColor: 'rgba(255, 255, 255, 0.85)', // Glassmorphism
    backdropFilter: 'blur(20px)', 
    WebkitBackdropFilter: 'blur(20px)', 
    padding: '30px', 
    boxSizing: 'border-box', 
    display: 'flex', 
    flexDirection: 'column', 
    order: isMobile ? 2 : 1, 
    zIndex: 1000, 
    borderTop: isMobile ? `2px solid ${COLORS.DARK}` : 'none',
    boxShadow: isMobile ? 'none' : '-5px 0 20px rgba(0,0,0,0.05)'
});
const panelHeaderStyle = { marginBottom: '30px', paddingBottom: '20px', borderBottom: `2px solid ${COLORS.DARK}` };
const proTagStyle = { fontSize: '0.4em', backgroundColor: COLORS.BLUE, color: COLORS.WHITE, padding: '3px 6px', verticalAlign: 'top', marginLeft: '8px', fontFamily: "'Inter', sans-serif", fontWeight: '700', borderRadius: '4px' };
const cardStyle = { marginBottom: '25px' };
const cardTitleStyle = { margin: 0, fontWeight: '700', color: COLORS.DARK };
const inputStyle = { width: '100%', padding: '16px 20px', marginBottom: '10px', borderRadius: PILL_RADIUS, border: 'none', backgroundColor: COLORS.WHITE, fontSize: '13px', fontFamily: "'Inter', sans-serif", color: COLORS.DARK, outline: 'none', boxSizing: 'border-box', fontWeight: '600', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' };
const dropdownItemStyle = { padding: '12px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '13px', fontFamily: "'Inter', sans-serif", color: COLORS.DARK, fontWeight: '600', transition: 'background 0.2s' };
const submitButtonStyle = { width: '100%', padding: '18px', backgroundColor: COLORS.DARK, color: COLORS.WHITE, border: 'none', borderRadius: PILL_RADIUS, fontWeight: '700', fontSize: '14px', letterSpacing: '1px', cursor: 'pointer', textTransform: 'uppercase', fontFamily: "'Oswald', sans-serif'", transition: 'transform 0.1s', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' };
const actionButtonsContainerStyle = { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px', marginTop:'auto' };
const buttonsRowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', width: '100%' };
const optimizeButtonStyle = { padding: '0', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', transition: 'transform 0.2s' };
const resetButtonStyle = { padding: '10px', backgroundColor: 'white', borderRadius:'50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', width:'50px', height:'50px' };
const missionsListStyle = { display: 'flex', flexDirection: 'column', border: 'none', overflowY: 'auto', flex: 1, borderRadius: STANDARD_RADIUS, paddingRight:'5px' };
const missionItemStyle = { backgroundColor: COLORS.WHITE, padding: '15px', marginBottom:'10px', borderRadius: STANDARD_RADIUS, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.03)' };
const missionInfoStyle = { flex: 1, marginRight: '10px' };
const missionTitleStyle = { fontWeight: '700', fontSize: '14px', color: COLORS.DARK, display: 'flex', alignItems: 'center', fontFamily:"'Inter', sans-serif" };
const missionAddressStyle = { color: COLORS.GRAY_TEXT, fontSize: '12px', marginTop: '2px', fontFamily: "'Inter', sans-serif" };
const compassButtonStyle = { backgroundColor: '#f8f9fa', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(59, 70, 81, 0.6)', backdropFilter: 'blur(5px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const modalContentStyle = { background: COLORS.WHITE, padding: '40px', borderRadius: '20px', width: '90%', maxWidth: '350px', textAlign: 'center', border: `2px solid ${COLORS.BLUE}`, boxSizing: 'border-box', boxShadow: SHADOW };
const modalTitleStyle = { marginTop: 0, marginBottom: '15px', color: COLORS.DARK, fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', fontSize: '20px', letterSpacing: '1px' };
const gpsLinkStyle = { display: 'flex', alignItems: 'center', width: '100%', padding: '15px', backgroundColor: '#f8f9fa', color: COLORS.DARK, textDecoration: 'none', borderRadius: STANDARD_RADIUS, border: '1px solid #eee', fontWeight: '700', fontSize: '14px', fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', letterSpacing: '0.5px', boxSizing: 'border-box' };
const gpsIconStyle = { width: '24px', height: '24px', objectFit: 'contain', marginRight: '15px' };
const cancelButtonStyle = { marginTop: '15px', padding: '15px', width: '100%', border: 'none', background: COLORS.DARK, color: COLORS.WHITE, fontWeight:'700', cursor: 'pointer', borderRadius: PILL_RADIUS, fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', letterSpacing: '1px' };

export default App;