import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { jwtDecode } from 'jwt-decode';
import SignatureCanvas from 'react-signature-canvas';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Crisp } from "crisp-sdk-web";

// --- FIX POUR VERCEL ---
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

// --- 1. CONFIGURATION LEAFLET ---
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: iconRetinaUrl,
    iconUrl: iconUrl,
    shadowUrl: shadowUrl,
});

// --- 2. CONSTANTES & STYLES ---
const COLORS = {
    DARK: '#0f172a',
    BLUE: '#3b82f6', 
    PASTEL_BLUE: '#e0f2fe',
    PASTEL_GREEN: '#dcfce7', 
    PASTEL_RED: '#fee2e2', 
    WHITE: '#ffffff',
    BORDER: '#e2e8f0', 
    GRAY_TEXT: '#64748b', 
    BG_LIGHT: '#f8fafc', 
    WARNING: '#fef3c7',
    SUCCESS_TEXT: '#15803d'
};

const PILL_RADIUS = '12px';
const STANDARD_RADIUS = '16px';
const SHADOW = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';

// Styles Layout
const rootContainerStyle = (isMobile) => ({
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    height: '100vh',
    width: '100vw',
    fontFamily: "'Inter', sans-serif",
    backgroundColor: COLORS.BG_LIGHT,
    overflow: 'hidden'
});

const mapContainerStyle = (isMobile) => ({
    flex: isMobile ? 'none' : 1,
    height: isMobile ? '35vh' : '100%',
    order: isMobile ? 1 : 2,
    borderLeft: isMobile ? 'none' : '1px solid ' + COLORS.BORDER,
    zIndex: 0,
    position: 'relative'
});

const panelContainerStyle = (isMobile) => ({
    width: isMobile ? '100%' : '450px',
    height: isMobile ? '65vh' : '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    display: 'flex',
    flexDirection: 'column',
    order: isMobile ? 2 : 1,
    zIndex: 1000,
    borderTop: isMobile ? '1px solid ' + COLORS.BORDER : 'none',
    boxShadow: isMobile ? '0 -4px 20px rgba(0,0,0,0.05)' : '5px 0 30px rgba(0,0,0,0.05)',
    paddingBottom: isMobile ? '80px' : '0px', 
    position: 'relative'
});

const scrollableContentStyle = {
    padding: '30px',
    overflowY: 'auto',
    flex: 1,
    WebkitOverflowScrolling: 'touch'
};

const mobileNavStyle = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    width: '100%',
    height: '70px',
    backgroundColor: COLORS.WHITE,
    borderTop: `1px solid ${COLORS.BORDER}`,
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    zIndex: 2000,
    paddingBottom: '10px',
    boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
};

const mobileNavItemStyle = (isActive) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: isActive ? COLORS.BLUE : COLORS.GRAY_TEXT,
    fontSize: '10px',
    fontWeight: isActive ? '700' : '500',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    width: '60px'
});

const cardStyle = { marginBottom: '25px' };
const cardTitleStyle = { margin: 0, fontWeight: '700', color: COLORS.DARK, fontSize: '18px', fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' };
const inputStyle = { width: '100%', padding: '14px', marginBottom: '10px', borderRadius: PILL_RADIUS, border: `1px solid ${COLORS.BORDER}`, backgroundColor: COLORS.BG_LIGHT, fontSize: '14px', fontFamily: "'Inter', sans-serif", color: COLORS.DARK, outline: 'none', boxSizing: 'border-box', fontWeight: '500', transition: 'all 0.2s' };
const submitButtonStyle = { width: '100%', padding: '16px', backgroundColor: COLORS.DARK, color: COLORS.WHITE, border: 'none', borderRadius: PILL_RADIUS, fontWeight: '700', fontSize: '14px', letterSpacing: '0.5px', cursor: 'pointer', textTransform: 'uppercase', fontFamily: "'Oswald', sans-serif", boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', transition: 'transform 0.1s' };
const missionItemStyle = { backgroundColor: COLORS.WHITE, padding: '16px', marginBottom: '12px', borderRadius: STANDARD_RADIUS, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', border: `1px solid ${COLORS.BORDER}`, transition: 'transform 0.1s' };
const tripCardStyle = { backgroundColor: COLORS.WHITE, padding: '20px', borderRadius: STANDARD_RADIUS, marginBottom: '15px', border: `1px solid ${COLORS.BORDER}`, cursor: 'pointer', transition: '0.2s' };

const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const modalContentStyle = { background: COLORS.WHITE, padding: '30px', borderRadius: '24px', width: '90%', maxWidth: '400px', textAlign: 'center', border: 'none', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' };

// --- ICONS SVG ---
const Icons = {
    Home: ({color}) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>,
    List: ({color}) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>,
    Clock: ({color}) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
    LogOut: ({color}) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>,
    Navigation: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
};

// --- COMPOSANTS INTERNES ---

const AddressInput = ({ placeholder, value, onChange }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (value.length > 3 && showSuggestions) {
                try {
                    const response = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${value}&limit=5`);
                    const data = await response.json();
                    setSuggestions(data.features);
                } catch (e) { console.error(e); }
            } else { setSuggestions([]); }
        }, 300);
        return () => clearTimeout(delayDebounceFn);
    }, [value, showSuggestions]);

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            <input type="text" placeholder={placeholder} value={value} onChange={(e) => { onChange(e.target.value); setShowSuggestions(true); }} style={inputStyle} />
            {suggestions.length > 0 && showSuggestions && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', borderRadius: '12px', boxShadow: SHADOW, zIndex: 1000, overflow: 'hidden', marginTop: '-5px', border: '1px solid ' + COLORS.BORDER }}>
                    {suggestions.map((s, i) => (
                        <div key={i} onClick={() => { onChange(s.properties.label); setShowSuggestions(false); }} style={{ padding: '12px 15px', cursor: 'pointer', borderBottom: '1px solid #eee', fontSize: '13px', textAlign:'left', fontFamily:"'Inter', sans-serif" }}>📍 {s.properties.label}</div>
                    ))}
                </div>
            )}
        </div>
    );
};

const MapController = ({ center, bounds }) => {
    const map = useMap();
    useEffect(() => {
        if (bounds && bounds.length > 0) map.fitBounds(bounds, { padding: [50, 50] });
        else if (center) map.flyTo(center, 13, { duration: 1.5 });
    }, [center, bounds, map]);
    return null;
};

const createCustomIcon = (index, total, status, isMyMission) => {
    let bgColor = '#cbd5e1'; 
    let textColor = COLORS.DARK;
    if (isMyMission) {
        if (status === 'done') { bgColor = COLORS.SUCCESS_TEXT; textColor = 'white'; }
        else { bgColor = COLORS.BLUE; if (index === 0) bgColor = '#10b981'; }
    }
    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="background-color: ${bgColor}; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.2); color: ${textColor}; display: flex; align-items: center; justify-content: center; font-weight: 800; font-family: 'Inter', sans-serif; font-size: 13px; color: white;">${index + 1}</div>`,
        iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -16]
    });
};

// --- APP PRINCIPALE ---
function App() {
    const API_URL = "https://optiroute-wxaz.onrender.com"; 

    const [token, setToken] = useState(localStorage.getItem('optiroute_token'));
    const [userRole, setUserRole] = useState(null);
    const [userId, setUserId] = useState(null);
    const [userName, setUserName] = useState("");
    const [userCompany, setUserCompany] = useState(localStorage.getItem('optiroute_company') || "");
    
    // --- CES LIGNES MANQUAIENT ET CAUSAIENT L'ERREUR, ELLES SONT LÀ MAINTENANT ---
    const [authEmail, setAuthEmail] = useState("");
    const [authPass, setAuthPass] = useState("");
    const [authCompany, setAuthCompany] = useState("");
    const [isLoginView, setIsLoginView] = useState(true);
    const [authError, setAuthError] = useState("");
    const [authLoading, setAuthLoading] = useState(false);
    // -----------------------------------------------------------------------------

    // États UI
    const [activeTab, setActiveTab] = useState(0); 
    const [screenWidth, setScreenWidth] = useState(window.innerWidth);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);
    
    // États Données
    const [technicians, setTechnicians] = useState([]);
    const [selectedTechId, setSelectedTechId] = useState(null);
    const [route, setRoute] = useState([]);
    const [routePath, setRoutePath] = useState([]);
    const [historyTrips, setHistoryTrips] = useState([]);
    const [pendingMissions, setPendingMissions] = useState([]);

    // États Formulaire Mission
    const [newName, setNewName] = useState("");
    const [newAddress, setNewAddress] = useState("");
    const [newPhone, setNewPhone] = useState("");
    const [newComments, setNewComments] = useState("");
    const [timeSlot, setTimeSlot] = useState("morning");
    const [duration, setDuration] = useState(30);

    // États Modales & Map
    const [mapCenter, setMapCenter] = useState([48.8675, 2.3639]);
    const [mapBounds, setMapBounds] = useState(null);
    const [navModal, setNavModal] = useState(null);
    const [missionToSign, setMissionToSign] = useState(null);
    const [showTeamModal, setShowTeamModal] = useState(false);
    
    // Modales suppression tech
    const [techToDelete, setTechToDelete] = useState(null);
    const [isDeletingTech, setIsDeletingTech] = useState(false);
    
    // Modales ajout tech
    const [newTechName, setNewTechName] = useState("");
    const [newTechAddress, setNewTechAddress] = useState("");
    const [newTechEmail, setNewTechEmail] = useState("");
    const [newTechPass, setNewTechPass] = useState("");
    const [isAddingTech, setIsAddingTech] = useState(false);

    const sigCanvas = useRef(null);
    const isMobile = screenWidth < 768;

    const getAuthHeaders = () => ({ headers: { Authorization: `Bearer ${token}` } });

    // --- EFFETS ---
    useEffect(() => {
        const handleResize = () => setScreenWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        
        Crisp.configure("3a2abcb6-a8fd-4fc5-b856-a99c36e6ad0b");
        
        if (token) {
            try {
                const decoded = jwtDecode(token);
                setUserRole(decoded.role); setUserId(decoded.id); setUserName(decoded.name);
                if (decoded.role === 'tech') setSelectedTechId(decoded.id);
                fetchTechnicians();
                fetchCurrentTrip();
            } catch (e) { handleLogout(); }
        }
        return () => window.removeEventListener('resize', handleResize);
    }, [token]);

    // Polling 30s
    useEffect(() => {
        if (!token) return;
        const interval = setInterval(() => fetchCurrentTrip(), 30000);
        return () => clearInterval(interval);
    }, [token]);

    // Toast timer
    useEffect(() => { if (toast) setTimeout(() => setToast(null), 3000); }, [toast]);

    // --- ACTIONS ---
    const handleLogout = () => {
        localStorage.clear(); setToken(null);
    };

    const fetchTechnicians = async () => {
        try {
            const res = await axios.get(`${API_URL}/technicians`, getAuthHeaders());
            setTechnicians(res.data);
        } catch (e) {}
    };

    const fetchCurrentTrip = async () => {
        try {
            const res = await axios.get(`${API_URL}/trips/current`, getAuthHeaders());
            const savedPath = localStorage.getItem('saved_route_path');
            if(res.data) {
                const mapped = res.data.map(m => ({ ...m, step: m.route_order }));
                setRoute(mapped);
                if (savedPath && !mapBounds) setRoutePath(JSON.parse(savedPath));
            }
        } catch (e) {}
    };

    const fetchHistory = async () => {
        try {
            const res = await axios.get(`${API_URL}/trips/history`, getAuthHeaders());
            setHistoryTrips(res.data);
        } catch (e) { console.error(e); }
    };

    const handleOptimize = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_URL}/optimize`, getAuthHeaders());
            if (response.data.route) {
                setRoute(response.data.route);
                setRoutePath(response.data.path);
                localStorage.setItem('saved_route_path', JSON.stringify(response.data.path));
                setMapBounds(response.data.path);
                setActiveTab(1); // Auto switch to Route view
            }
        } catch (e) { alert("Erreur optimisation"); }
        finally { setLoading(false); }
    };

    const handleAddMission = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/missions`, { 
                client_name: newName, address: newAddress, time_slot: timeSlot, 
                duration: duration, technician_id: selectedTechId, phone: newPhone, comments: newComments 
            }, getAuthHeaders());
            setNewName(""); setNewAddress(""); setNewPhone(""); setNewComments("");
            setPendingMissions([...pendingMissions, 1]); // Fake update pour UI
            setToast({ message: "Mission ajoutée", type: "success" });
        } catch (e) { alert("Erreur ajout"); }
    };

    // Gestion Equipe
    const handleAddTech = async (e) => {
        e.preventDefault();
        if (!newTechName || !newTechAddress || !newTechEmail || !newTechPass) return;
        setIsAddingTech(true);
        try {
            await axios.post(`${API_URL}/technicians`, { name: newTechName, address: newTechAddress, email: newTechEmail, password: newTechPass }, getAuthHeaders());
            setNewTechName(""); setNewTechAddress(""); setNewTechEmail(""); setNewTechPass("");
            await fetchTechnicians();
            setShowTeamModal(false);
            setToast({ message: "Technicien ajouté", type: "success" });
        } catch (error) { alert("Erreur ajout"); }
        finally { setIsAddingTech(false); }
    };

    const executeDeleteTech = async () => {
        if (!techToDelete) return;
        setIsDeletingTech(true);
        try { 
            await axios.delete(`${API_URL}/technicians/${techToDelete}`, getAuthHeaders()); 
            await fetchTechnicians(); setTechToDelete(null);
            if (selectedTechId === techToDelete) setSelectedTechId(null);
            setToast({ message: "Technicien supprimé", type: "success" });
        } catch (e) { alert("Erreur"); }
        finally { setIsDeletingTech(false); }
    };

    const triggerStatusUpdate = async (id, status) => {
        if (status === 'done') { setMissionToSign(id); return; }
        await axios.patch(`${API_URL}/missions/${id}/status`, { status }, getAuthHeaders());
        fetchCurrentTrip();
    };

    const confirmSign = async () => {
        if (!sigCanvas.current || sigCanvas.current.isEmpty()) return alert("Signez d'abord");
        await axios.patch(`${API_URL}/missions/${missionToSign}/status`, { 
            status: 'done', signature: sigCanvas.current.toDataURL() 
        }, getAuthHeaders());
        setMissionToSign(null);
        fetchCurrentTrip();
    };

    // --- RENDUS COMPOSANTS ---

    // 1. Footer Mobile (Navigation Native)
    const MobileFooter = () => (
        <div style={mobileNavStyle}>
            <button onClick={() => setActiveTab(0)} style={mobileNavItemStyle(activeTab === 0)}>
                <Icons.Home color={activeTab === 0 ? COLORS.BLUE : COLORS.GRAY_TEXT} />
                <span style={{marginTop: '4px'}}>Saisie</span>
            </button>
            <button onClick={() => setActiveTab(1)} style={mobileNavItemStyle(activeTab === 1)}>
                <Icons.List color={activeTab === 1 ? COLORS.BLUE : COLORS.GRAY_TEXT} />
                <span style={{marginTop: '4px'}}>Route</span>
            </button>
            <button onClick={() => { fetchHistory(); setActiveTab(2); }} style={mobileNavItemStyle(activeTab === 2)}>
                <Icons.Clock color={activeTab === 2 ? COLORS.BLUE : COLORS.GRAY_TEXT} />
                <span style={{marginTop: '4px'}}>Historique</span>
            </button>
            <button onClick={handleLogout} style={mobileNavItemStyle(false)}>
                <Icons.LogOut color={COLORS.GRAY_TEXT} />
                <span style={{marginTop: '4px'}}>Déco</span>
            </button>
        </div>
    );

    // 2. Map Memoized
    const MapSection = useMemo(() => (
        <div style={mapContainerStyle(isMobile)}>
            <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                <MapController center={mapCenter} bounds={mapBounds} />
                {technicians.map(t => <Marker key={t.id} position={[parseFloat(t.start_lat), parseFloat(t.start_lng)]}><Popup>🏠 {t.name}</Popup></Marker>)}
                {route.map((step, i) => <Marker key={i} position={[step.lat, step.lng]} icon={createCustomIcon(i, route.length, step.status, true)}><Popup>#{step.step} {step.client_name}</Popup></Marker>)}
                {routePath.length > 0 && <Polyline positions={routePath} color={COLORS.BLUE} weight={5} opacity={0.7} />}
            </MapContainer>
        </div>
    ), [mapCenter, mapBounds, route, routePath, technicians, isMobile]);

    // LOGIN VIEW
    if (!token) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: COLORS.DARK, fontFamily: "'Inter', sans-serif" }}>
            <div style={{ background: 'white', padding: '40px', borderRadius: '20px', width: '90%', maxWidth: '350px', textAlign: 'center' }}>
                <img src="/logo-truck.svg" alt="Logo" style={{ height: '50px', marginBottom: '20px' }} />
                <h2 style={{fontSize:'20px', fontFamily:"'Oswald', sans-serif", marginBottom:'20px'}}>{isLoginView ? "CONNEXION" : "INSCRIPTION"}</h2>
                {authError && <div style={{color: COLORS.PASTEL_RED, marginBottom:'10px', fontSize:'12px'}}>{authError}</div>}
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    setAuthLoading(true);
                    try {
                        const endpoint = isLoginView ? '/auth/login' : '/auth/register';
                        const payload = isLoginView ? { email: authEmail, password: authPass } : { email: authEmail, password: authPass, company_name: authCompany };
                        const res = await axios.post(`${API_URL}${endpoint}`, payload);
                        
                        if (isLoginView) {
                            localStorage.setItem('optiroute_token', res.data.token);
                            const compName = res.data.name || ''; localStorage.setItem('optiroute_company', compName);
                            setToken(res.data.token); setUserCompany(compName);
                        } else {
                            setIsLoginView(true);
                            setAuthError("Compte créé ! Connectez-vous.");
                        }
                    } catch(err) { setAuthError("Erreur d'authentification"); }
                    finally { setAuthLoading(false); }
                }}>
                    {!isLoginView && <input type="text" placeholder="Nom Entreprise" value={authCompany} onChange={e => setAuthCompany(e.target.value)} style={inputStyle} />}
                    <input type="email" placeholder="Email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} style={inputStyle} />
                    <input type="password" placeholder="Mot de passe" value={authPass} onChange={e => setAuthPass(e.target.value)} style={inputStyle} />
                    <button type="submit" style={submitButtonStyle} disabled={authLoading}>{authLoading ? '...' : (isLoginView ? 'SE CONNECTER' : 'CRÉER COMPTE')}</button>
                </form>
                <div onClick={() => setIsLoginView(!isLoginView)} style={{marginTop:'20px', fontSize:'12px', color:COLORS.GRAY_TEXT, cursor:'pointer', textDecoration:'underline'}}>
                    {isLoginView ? "Créer un compte entreprise" : "J'ai déjà un compte"}
                </div>
            </div>
        </div>
    );

    // APP VIEW
    return (
        <div style={rootContainerStyle(isMobile)}>
            {/* TOAST NOTIFICATION */}
            {toast && <div style={{position: 'fixed', bottom: '90px', left: '50%', transform: 'translateX(-50%)', backgroundColor: toast.type === 'success' ? COLORS.DARK : COLORS.BLUE, color: 'white', padding: '15px 30px', borderRadius: PILL_RADIUS, boxShadow: SHADOW, zIndex: 99999, fontSize: '14px'}}>{toast.message}</div>}

            {/* Modale Signature */}
            {missionToSign && <div style={modalOverlayStyle}><div style={modalContentStyle}>
                <h3>SIGNATURE</h3>
                <div style={{border:'2px dashed #eee', marginBottom:'15px'}}><SignatureCanvas ref={sigCanvas} canvasProps={{width:300, height:200}} /></div>
                <div style={{display:'flex', gap:'10px'}}>
                    <button onClick={() => setMissionToSign(null)} style={{...submitButtonStyle, backgroundColor:'transparent', color:COLORS.GRAY_TEXT, border:'1px solid #eee'}}>Annuler</button>
                    <button onClick={confirmSign} style={submitButtonStyle}>Valider</button>
                </div>
            </div></div>}

            {/* Modale Navigation */}
            {navModal && <div style={modalOverlayStyle} onClick={() => setNavModal(null)}><div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                <h3 style={{...cardTitleStyle, marginBottom:'20px'}}>NAVIGATION</h3>
                <a href={`https://waze.com/ul?ll=${navModal.lat},${navModal.lng}&navigate=yes`} target="_blank" rel="noreferrer" style={{...submitButtonStyle, display:'block', marginBottom:'10px', textDecoration:'none', backgroundColor:'#33ccff', color:'white'}}>WAZE 🚙</a>
                <a href={`http://googleusercontent.com/maps.google.com/?q=${navModal.lat},${navModal.lng}`} target="_blank" rel="noreferrer" style={{...submitButtonStyle, display:'block', marginBottom:'10px', textDecoration:'none', backgroundColor:'#4285F4', color:'white'}}>GOOGLE MAPS 🗺️</a>
                <button onClick={() => setNavModal(null)} style={{...submitButtonStyle, backgroundColor:'transparent', color:COLORS.GRAY_TEXT, border:'1px solid #eee'}}>Fermer</button>
            </div></div>}

            {/* Modale Suppression Tech */}
            {techToDelete && <div style={modalOverlayStyle} onClick={() => !isDeletingTech && setTechToDelete(null)}><div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                <h3 style={{...cardTitleStyle, color: COLORS.DARK}}>SUPPRIMER ?</h3>
                <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
                    <button onClick={() => setTechToDelete(null)} style={{...submitButtonStyle, backgroundColor:'white', color:COLORS.DARK, border:`1px solid ${COLORS.BORDER}`}}>NON</button>
                    <button onClick={executeDeleteTech} style={{...submitButtonStyle, backgroundColor:COLORS.PASTEL_RED, color:COLORS.DARK}}>{isDeletingTech ? "..." : "OUI"}</button>
                </div>
            </div></div>}

            {/* Modale Gestion Equipe (Ajout) */}
            {showTeamModal && <div style={modalOverlayStyle} onClick={() => setShowTeamModal(false)}><div style={{...modalContentStyle, maxWidth:'450px'}} onClick={e => e.stopPropagation()}>
                <h3 style={cardTitleStyle}>MON ÉQUIPE</h3>
                <div style={{maxHeight: '200px', overflowY: 'auto', marginBottom: '20px', textAlign:'left'}}>
                    {technicians.map(t => (
                        <div key={t.id} style={{display:'flex', justifyContent:'space-between', padding:'10px', borderBottom:'1px solid #eee'}}>
                            <div><b>{t.name}</b> <span style={{fontSize:'12px', color:COLORS.GRAY_TEXT}}>({t.email})</span></div>
                            {userRole === 'admin' && <button onClick={() => setTechToDelete(t.id)} style={{border:'none', background:'none', cursor:'pointer'}}>🗑️</button>}
                        </div>
                    ))}
                </div>
                {userRole === 'admin' && (
                    <form onSubmit={handleAddTech} style={{borderTop:'1px solid #eee', paddingTop:'15px'}}>
                        <input type="text" placeholder="Nom" value={newTechName} onChange={(e) => setNewTechName(e.target.value)} style={inputStyle} />
                        <AddressInput placeholder="Adresse (Départ)" value={newTechAddress} onChange={setNewTechAddress} />
                        <input type="email" placeholder="Email" value={newTechEmail} onChange={(e) => setNewTechEmail(e.target.value)} style={inputStyle} />
                        <input type="password" placeholder="Mot de passe" value={newTechPass} onChange={(e) => setNewTechPass(e.target.value)} style={inputStyle} />
                        <button type="submit" disabled={isAddingTech} style={submitButtonStyle}>{isAddingTech ? "..." : "AJOUTER"}</button>
                    </form>
                )}
                <button onClick={() => setShowTeamModal(false)} style={{marginTop:'10px', background:'none', border:'none', color:COLORS.GRAY_TEXT, cursor:'pointer'}}>Fermer</button>
            </div></div>}

            {/* LA CARTE */}
            {MapSection}

            {/* LE PANNEAU */}
            <div style={panelContainerStyle(isMobile)}>
                
                {/* Header du Panneau (Logo + Titre) */}
                <div style={{ padding: '25px 30px', borderBottom: isMobile ? 'none' : `1px solid ${COLORS.BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '20px', fontFamily: "'Oswald', sans-serif", letterSpacing: '1px', color: COLORS.DARK }}>OPTIROUTE <span style={{fontSize:'10px', background:COLORS.BLUE, color:'white', padding:'2px 6px', borderRadius:'4px', verticalAlign:'middle'}}>PRO</span></h1>
                        <div style={{ fontSize: '11px', color: COLORS.GRAY_TEXT, marginTop: '2px', fontWeight: '500' }}>{userRole === 'admin' ? userCompany : userName}</div>
                    </div>
                    {/* Navigation Desktop (Cachée en mobile) */}
                    {!isMobile && (
                        <div style={{ display: 'flex', gap: '15px' }}>
                            <button onClick={() => setActiveTab(0)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: activeTab === 0 ? 'bold' : 'normal', color: activeTab === 0 ? COLORS.BLUE : COLORS.GRAY_TEXT }}>Saisie</button>
                            <button onClick={() => setActiveTab(1)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: activeTab === 1 ? 'bold' : 'normal', color: activeTab === 1 ? COLORS.BLUE : COLORS.GRAY_TEXT }}>Route</button>
                            <button onClick={() => { fetchHistory(); setActiveTab(2); }} style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: activeTab === 2 ? 'bold' : 'normal', color: activeTab === 2 ? COLORS.BLUE : COLORS.GRAY_TEXT }}>Historique</button>
                            <button onClick={handleLogout} style={{ border: 'none', background: 'none', cursor: 'pointer', color: COLORS.PASTEL_RED, fontWeight:'bold' }}>Exit</button>
                        </div>
                    )}
                </div>

                {/* CONTENU SCROLLABLE */}
                <div style={scrollableContentStyle}>
                    
                    {/* TAB 0: AJOUT MISSION */}
                    {activeTab === 0 && (
                        <div>
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
                                <h2 style={cardTitleStyle}>Nouvelle Mission</h2>
                                {userRole === 'admin' && <button onClick={() => setShowTeamModal(true)} style={{background:'none', border:'none', color:COLORS.BLUE, fontWeight:'bold', cursor:'pointer', fontSize:'12px'}}>GÉRER ÉQUIPE</button>}
                            </div>
                            
                            {/* Sélecteur Tech (Admin) */}
                            {userRole === 'admin' && (
                                <div style={{display:'flex', gap:'10px', overflowX:'auto', marginBottom:'15px', paddingBottom:'5px'}}>
                                    {technicians.map(t => (
                                        <div key={t.id} onClick={() => { setSelectedTechId(t.id); setMapCenter([parseFloat(t.start_lat), parseFloat(t.start_lng)]); }} 
                                            style={{ padding:'6px 12px', borderRadius:'20px', fontSize:'12px', fontWeight:'bold', cursor:'pointer', whiteSpace:'nowrap', backgroundColor: selectedTechId === t.id ? COLORS.DARK : COLORS.WHITE, color: selectedTechId === t.id ? COLORS.WHITE : COLORS.DARK, border: `1px solid ${COLORS.BORDER}` }}>
                                            {t.name}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <form onSubmit={handleAddMission}>
                                <input placeholder="Nom Client" value={newName} onChange={e => setNewName(e.target.value)} style={inputStyle} />
                                <AddressInput placeholder="Adresse" value={newAddress} onChange={setNewAddress} />
                                <div style={{display:'flex', gap:'10px'}}>
                                    <input type="number" value={duration} onChange={e => setDuration(e.target.value)} style={{...inputStyle, textAlign:'center'}} />
                                    <select value={timeSlot} onChange={e => setTimeSlot(e.target.value)} style={inputStyle}>
                                        <option value="morning">Matin</option>
                                        <option value="afternoon">Après-midi</option>
                                    </select>
                                </div>
                                <button type="submit" style={submitButtonStyle}>Ajouter (+)</button>
                            </form>
                            
                            <div style={{marginTop:'20px', paddingTop:'20px', borderTop:`1px dashed ${COLORS.BORDER}`}}>
                                <button onClick={handleOptimize} style={{...submitButtonStyle, backgroundColor: COLORS.BLUE, boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)'}}>
                                    {loading ? 'CALCUL...' : 'OPTIMISER LA TOURNÉE 🚀'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* TAB 1: ROUTE */}
                    {activeTab === 1 && (
                        <div>
                            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'15px'}}>
                                <h2 style={cardTitleStyle}>Feuille de Route</h2>
                                <span style={{fontSize:'12px', background:COLORS.PASTEL_BLUE, color:COLORS.BLUE, padding:'2px 8px', borderRadius:'10px', fontWeight:'bold'}}>{route.length} Missions</span>
                            </div>
                            
                            {route.length === 0 ? <div style={{textAlign:'center', color:COLORS.GRAY_TEXT, marginTop:'40px'}}>La route est vide.</div> : 
                             route.map((step, i) => (
                                <div key={i} style={missionItemStyle}>
                                    <div>
                                        <div style={{fontSize:'14px', fontWeight:'bold', color:COLORS.DARK}}>#{step.step} {step.client_name}</div>
                                        <div style={{fontSize:'12px', color:COLORS.GRAY_TEXT}}>{step.address}</div>
                                        <div style={{marginTop:'8px', display:'flex', gap:'5px'}}>
                                            {(step.status === 'assigned' || !step.status) && <button onClick={() => triggerStatusUpdate(step.id, 'in_progress')} style={{border:'none', background:COLORS.PASTEL_GREEN, color:COLORS.SUCCESS_TEXT, fontSize:'10px', fontWeight:'bold', padding:'4px 8px', borderRadius:'4px', cursor:'pointer'}}>DÉMARRER</button>}
                                            {step.status === 'in_progress' && <button onClick={() => triggerStatusUpdate(step.id, 'done')} style={{border:'none', background:COLORS.PASTEL_RED, color:COLORS.DARK, fontSize:'10px', fontWeight:'bold', padding:'4px 8px', borderRadius:'4px', cursor:'pointer'}}>TERMINER</button>}
                                            {step.status === 'done' && <span style={{fontSize:'10px', fontWeight:'bold', color:COLORS.SUCCESS_TEXT}}>✅ FAIT</span>}
                                        </div>
                                    </div>
                                    <button onClick={() => { setNavModal({lat:step.lat, lng:step.lng}); }} style={{background:COLORS.BG_LIGHT, border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer'}}><Icons.Navigation /></button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* TAB 2: HISTORIQUE (Avec suppression visuelle des vides) */}
                    {activeTab === 2 && (
                        <div>
                            <h2 style={cardTitleStyle}>Historique</h2>
                            <p style={{fontSize:'12px', color:COLORS.GRAY_TEXT, marginBottom:'20px'}}>Vos trajets passés.</p>
                            
                            {/* Le filtre .filter(t => t.mission_count > 0) fait disparaître les trajets vides */}
                            {historyTrips.filter(t => t.mission_count > 0).length === 0 ? 
                                <div style={{textAlign:'center', color:COLORS.GRAY_TEXT, marginTop:'30px'}}>Aucun historique valide.</div> 
                                : 
                                historyTrips.filter(t => t.mission_count > 0).map(trip => (
                                    <div key={trip.id} style={tripCardStyle}>
                                        <div style={{display:'flex', justifyContent:'space-between', fontWeight:'bold', fontSize:'14px', color:COLORS.DARK}}>
                                            <span>{new Date(trip.created_at).toLocaleDateString()}</span>
                                            <span>{trip.total_km} km</span>
                                        </div>
                                        <div style={{fontSize:'13px', color:COLORS.GRAY_TEXT, marginTop:'5px'}}>
                                            {trip.tech_name} • {trip.mission_count} missions
                                        </div>
                                        <div style={{marginTop:'10px', fontSize:'11px', fontWeight:'bold', color: trip.status==='active' ? COLORS.BLUE : COLORS.SUCCESS_TEXT}}>
                                            {trip.status === 'active' ? '● EN COURS' : '● TERMINÉ'}
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    )}

                </div>

                {/* Footer Mobile (Seulement si écran < 768px) */}
                {isMobile && <MobileFooter />}
            </div>
        </div>
    );
}

export default App;