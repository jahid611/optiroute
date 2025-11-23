import React, { useState, useEffect, useRef } from 'react';
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
    DARK: '#3b4651', BLUE: '#2b79c2', PASTEL_BLUE: '#A0C4FF', 
    PASTEL_GREEN: '#B9FBC0', PASTEL_RED: '#FFADAD', WHITE: '#ffffff', 
    BORDER: '#e0e0e0', GRAY_TEXT: '#6c757d', BG_LIGHT: '#f8f9fa', WARNING: '#ffd6a5',
    SUCCESS_TEXT: '#2e7d32'
};

const PILL_RADIUS = '38px'; 
const STANDARD_RADIUS = '12px';
const SHADOW = '0 8px 20px rgba(0,0,0,0.08)';

// --- 3. STYLES CSS (ARCHITECTURE BETON) ---

// Conteneur : Ligne sur PC, Colonne sur Mobile (Map en haut, Reste en bas)
const rootContainerStyle = (isMobile) => ({ 
    display: 'flex', 
    flexDirection: isMobile ? 'column' : 'row', 
    height: '100vh', 
    width: '100vw',
    fontFamily: "'Inter', sans-serif", 
    backgroundColor: COLORS.BG_LIGHT, 
    overflow: 'hidden' 
});

// Map : Prend 100% de hauteur sur PC, 35% FIXE sur Mobile
const mapContainerStyle = (isMobile) => ({ 
    flex: isMobile ? 'none' : 1, 
    height: isMobile ? '35vh' : '100%', 
    width: '100%',
    order: isMobile ? 1 : 2, // En haut sur mobile, à droite sur PC
    borderLeft: isMobile ? 'none' : '1px solid ' + COLORS.BORDER,
    borderBottom: isMobile ? '2px solid ' + COLORS.DARK : 'none',
    zIndex: 0
});

// Panel : Prend le reste (65% sur mobile)
const panelContainerStyle = (isMobile) => ({ 
    width: isMobile ? '100%' : '450px', 
    flex: isMobile ? 1 : 'none', // Prend le reste de la hauteur sur mobile
    backgroundColor: 'white',
    display: 'flex', 
    flexDirection: 'column', 
    order: isMobile ? 2 : 1, // En bas sur mobile, à gauche sur PC
    zIndex: 10, 
    boxShadow: isMobile ? '0 -5px 20px rgba(0,0,0,0.1)' : '5px 0 30px rgba(0,0,0,0.05)',
    overflowY: 'hidden' // Le scroll est géré dans le contenu interne
});

const panelHeaderStyle = { padding: '15px 20px', borderBottom: '1px solid ' + COLORS.BORDER, backgroundColor: '#fff', zIndex: 20 };
const panelContentStyle = { flex: 1, overflowY: 'auto', padding: '20px', WebkitOverflowScrolling: 'touch' };

// Styles Composants
const proTagStyle = { fontSize: '0.4em', backgroundColor: COLORS.BLUE, color: COLORS.WHITE, padding: '3px 6px', verticalAlign: 'top', marginLeft: '8px', fontFamily: "'Inter', sans-serif", fontWeight: '700', borderRadius: '4px' };
const cardStyle = { marginBottom: '15px', backgroundColor: COLORS.BG_LIGHT, padding:'15px', borderRadius: STANDARD_RADIUS, border:'1px solid '+COLORS.BORDER }; 
const cardTitleStyle = { margin: 0, fontWeight: '700', color: COLORS.DARK };
const inputStyle = { width: '100%', padding: '14px', marginBottom: '10px', borderRadius: PILL_RADIUS, border: '1px solid #ddd', backgroundColor: '#fff', fontSize: '16px', color: COLORS.DARK, outline: 'none', boxSizing: 'border-box' };
const dropdownItemStyle = { padding: '12px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '13px', fontFamily: "'Inter', sans-serif", color: COLORS.DARK, fontWeight: '600', transition: 'background 0.2s' };
const submitButtonStyle = { width: '100%', padding: '15px', backgroundColor: COLORS.DARK, color: COLORS.WHITE, border: 'none', borderRadius: PILL_RADIUS, fontWeight: '700', fontSize: '14px', letterSpacing: '1px', cursor: 'pointer', textTransform: 'uppercase', fontFamily: "'Oswald', sans-serif" };
const actionButtonsContainerStyle = { display: 'flex', justifyContent: 'center', marginTop: '10px', paddingBottom:'20px' };
const optimizeButtonStyle = { padding: '0', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' };
const resetButtonStyle = { padding: '10px', backgroundColor: 'white', borderRadius: '50%', border: '1px solid #ddd', cursor: 'pointer', width: '50px', height: '50px', display:'flex', alignItems:'center', justifyContent:'center' };
const missionsListStyle = { display: 'flex', flexDirection: 'column', gap:'10px' };
const missionItemStyle = { backgroundColor: COLORS.WHITE, padding: '15px', borderRadius: STANDARD_RADIUS, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', boxShadow: '0 2px 5px rgba(0,0,0,0.03)', border: '1px solid #eee' };
const missionInfoStyle = { flex: 1, marginRight: '10px' };
const missionTitleStyle = { fontWeight: '700', fontSize: '14px', color: COLORS.DARK, display: 'flex', alignItems: 'center', fontFamily: "'Inter', sans-serif" };
const missionAddressStyle = { color: COLORS.GRAY_TEXT, fontSize: '12px', marginTop: '2px', fontFamily: "'Inter', sans-serif" };
const compassButtonStyle = { backgroundColor: '#f8f9fa', border: '1px solid #eee', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginLeft:'5px' };
const phoneButtonStyle = { backgroundColor: COLORS.PASTEL_GREEN, border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', textDecoration:'none', marginLeft:'5px' };
const statusButtonStyle = { marginTop: '10px', width: '100%', padding: '10px', borderRadius: PILL_RADIUS, border: 'none', fontWeight: '700', fontSize: '12px', cursor: 'pointer', fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' };
const pdfButtonStyle = { marginTop:'10px', padding:'8px 15px', fontSize:'11px', borderRadius:'20px', border:'1px solid #ddd', background:'white', cursor:'pointer', display:'flex', alignItems:'center', fontWeight:'bold', color:COLORS.DARK, fontFamily:"'Inter', sans-serif", width: '100%', justifyContent: 'center' };
const tripCardStyle = { backgroundColor: COLORS.WHITE, padding: '15px', borderRadius: STANDARD_RADIUS, marginBottom: '10px', border: `1px solid ${COLORS.BORDER}`, cursor: 'pointer' };
const tabButtonStyle = (isActive) => ({ flex:1, padding:'10px', border:'none', background: isActive ? COLORS.DARK : 'transparent', color: isActive ? 'white' : COLORS.GRAY_TEXT, fontWeight:'bold', fontSize:'12px', cursor:'pointer', borderRadius:'8px' });

// Modales
const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(59, 70, 81, 0.8)', backdropFilter: 'blur(5px)', zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const modalContentStyle = { background: COLORS.WHITE, padding: '30px', borderRadius: '20px', width: '90%', maxWidth: '400px', textAlign: 'center', maxHeight:'90vh', overflowY:'auto' };
const modalTitleStyle = { marginTop: 0, marginBottom: '15px', color: COLORS.DARK, fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', fontSize: '20px' };
const gpsLinkStyle = { display: 'flex', alignItems: 'center', width: '100%', padding: '15px', backgroundColor: '#f8f9fa', color: COLORS.DARK, textDecoration: 'none', borderRadius: STANDARD_RADIUS, border: '1px solid #eee', fontWeight: '700', fontSize: '14px', marginBottom:'10px' };
const gpsIconStyle = { width: '24px', height: '24px', objectFit: 'contain', marginRight: '15px' };
const cancelButtonStyle = { marginTop: '10px', padding: '15px', width: '100%', border: 'none', background: 'transparent', color: COLORS.GRAY_TEXT, fontWeight: '600', cursor: 'pointer', borderRadius: PILL_RADIUS, fontSize: '13px' };

// Styles Landing & Tuto
const landingContainerStyle = { minHeight: '100vh', backgroundColor: COLORS.BG_LIGHT, fontFamily: "'Inter', sans-serif", color: COLORS.DARK, overflowX: 'hidden', display:'flex', flexDirection:'column' };
const navStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', backgroundColor: 'white', borderBottom: '1px solid '+COLORS.BORDER };
const heroSectionStyle = { padding: '80px 20px', textAlign: 'center' };
const heroTitleStyle = { fontFamily: "'Oswald', sans-serif", fontSize: '40px', textTransform: 'uppercase', lineHeight: '1.1', margin: '0 0 20px' };
const ctaButtonStyle = { padding: '15px 30px', fontSize: '16px', fontWeight: '700', color: COLORS.WHITE, backgroundColor: COLORS.BLUE, border: 'none', borderRadius: PILL_RADIUS, cursor: 'pointer' };
const tutorialContainerStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: COLORS.BG_LIGHT, zIndex: 20000, overflowY: 'auto', padding: '20px' };
const tutorialHeaderStyle = { maxWidth: '800px', margin: '0 auto 40px', textAlign: 'center' };
const tutorialSectionStyle = { maxWidth: '800px', margin: '0 auto 20px', backgroundColor: 'white', padding: '20px', borderRadius: '20px', boxShadow: SHADOW };
const stepNumberStyle = { display: 'inline-block', backgroundColor: COLORS.BLUE, color: 'white', width: '25px', height: '25px', borderRadius: '50%', textAlign: 'center', lineHeight: '25px', marginRight: '10px', fontWeight: 'bold', fontSize: '14px' };

// --- 4. SVG ICONS ---
const Icons = {
    User: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={COLORS.BLUE} strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>,
    Truck: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={COLORS.BLUE} strokeWidth="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>,
    Help: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={COLORS.GRAY_TEXT} strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>,
};

// --- 3. COMPOSANTS UTILITAIRES ---
const isValidCoord = (n) => !isNaN(parseFloat(n)) && isFinite(n) && n !== null;
const formatDuration = (minutes) => { if (!minutes) return ""; const h = Math.floor(minutes / 60); const m = minutes % 60; if (h > 0) return `${h}h ${m > 0 ? m + 'min' : ''}`; return `${m} min`; };

const generatePDF = async (mission, technicianName, companyName) => {
    try {
        const existingPdfBytes = await fetch('/template_rapport.pdf').then(res => res.arrayBuffer());
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const pages = pdfDoc.getPages();
        const firstPage = pages[0];
        const { height } = firstPage.getSize(); 
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const row1_Y = height - 252;
        firstPage.drawText(mission.client || "", { x: 100, y: row1_Y, size: 11, font: fontBold });
        firstPage.drawText(mission.address || "", { x: 370, y: row1_Y, size: 10, font: font, maxWidth: 200, lineHeight: 12 });
        const row2_Y = height - 315;
        if(mission.phone) firstPage.drawText(mission.phone, { x: 100, y: row2_Y, size: 11, font: font });
        firstPage.drawText(new Date().toLocaleDateString(), { x: 355, y: row2_Y, size: 11, font: font });
        const row3_Y = height - 405;
        firstPage.drawText(technicianName || "", { x: 100, y: row3_Y, size: 11, font: font });
        firstPage.drawText("VALIDÉ", { x: 370, y: row3_Y, size: 11, font: fontBold, color: rgb(0, 0.5, 0) });
        if (mission.comments) firstPage.drawText(mission.comments, { x: 75, y: height - 465, size: 10, font: font, maxWidth: 500 });
        if (mission.signature) {
            const signatureImage = await pdfDoc.embedPng(mission.signature);
            const sigDims = signatureImage.scale(0.4); 
            firstPage.drawImage(signatureImage, { x: 50, y: height - 580, width: sigDims.width, height: sigDims.height });
        }
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Rapport_${mission.client.replace(/\s+/g, '_')}.pdf`;
        link.click();
    } catch (error) { alert("Erreur PDF : template_rapport.pdf manquant ?"); }
};

const AddressInput = ({ placeholder, value, onChange }) => {
    const [suggestions, setSuggestions] = useState([]);
    useEffect(() => {
        const t = setTimeout(async () => {
            if (value.length > 3) {
                try {
                    const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${value}&limit=5`);
                    const data = await res.json();
                    setSuggestions(data.features);
                } catch (e) {}
            } else setSuggestions([]);
        }, 300);
        return () => clearTimeout(t);
    }, [value]);
    return (
        <div style={{ position: 'relative', width: '100%' }}>
            <input type="text" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
            {suggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', borderRadius: '12px', boxShadow: SHADOW, zIndex: 20000, marginTop: '-5px', border: '1px solid ' + COLORS.BORDER }}>
                    {suggestions.map((s, i) => (
                        <div key={i} onClick={() => { onChange(s.properties.label); setSuggestions([]); }} style={{ padding: '15px', borderBottom: '1px solid #eee', fontSize: '13px' }}>📍 {s.properties.label}</div>
                    ))}
                </div>
            )}
        </div>
    );
};

function MapController({ center, bounds }) {
    const map = useMap();
    useEffect(() => {
        try {
            if (bounds && bounds.length > 0) {
                const valid = bounds.filter(p => p && isValidCoord(p[0]) && isValidCoord(p[1]));
                if (valid.length > 0) map.fitBounds(valid, { padding: [50, 50] });
            } else if (center && isValidCoord(center[0]) && isValidCoord(center[1])) {
                map.flyTo(center, 13);
            }
        } catch (e) {}
    }, [center, bounds, map]);
    return null;
}

const createCustomIcon = (index, total, status, isMyMission) => {
    let bgColor = '#e0e0e0'; let textColor = COLORS.DARK;
    if (isMyMission) {
        if (status === 'done') { bgColor = COLORS.PASTEL_RED; textColor = COLORS.GRAY_TEXT; } 
        else { bgColor = COLORS.PASTEL_BLUE; if (index === 0) bgColor = COLORS.PASTEL_GREEN; if (index === total - 1) bgColor = COLORS.PASTEL_RED; }
    }
    return L.divIcon({ className: 'custom-marker', html: `<div style="background-color: ${bgColor}; width: 28px; height: 28px; border-radius: 50%; border: 2px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.15); color: ${textColor}; display: flex; align-items: center; justify-content: center; font-weight: 800; font-family: 'Inter', sans-serif; font-size: 12px;">${index + 1}</div>`, iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -14] });
};

const getStepColor = (index, total, status) => {
    if (status === 'done') return COLORS.PASTEL_RED; 
    if (index === 0) return COLORS.PASTEL_GREEN; 
    if (index === total - 1) return COLORS.PASTEL_RED; 
    return COLORS.PASTEL_BLUE; 
};

const renderClientName = (name, slot) => {
    let iconSrc = "/icon-morning.svg"; if (slot === 'afternoon') iconSrc = "/icon-afternoon.svg";
    return (<div style={{display: 'flex', alignItems: 'center'}}><img src={iconSrc} alt={slot} style={{width: '18px', height: '18px', marginRight: '8px', opacity: 0.8}} /><span style={{fontFamily: "'Oswald', sans-serif", fontSize: '1.1em', letterSpacing: '0.3px', color: COLORS.DARK}}>{name}</span></div>);
};

// --- PAGES ---
const TutorialPage = ({ onClose }) => (
    <div style={tutorialContainerStyle}>
        <div style={tutorialHeaderStyle}><h1 style={{fontFamily:"'Oswald', sans-serif", textTransform:'uppercase', color:COLORS.DARK}}>GUIDE RAPIDE</h1></div>
        <div style={tutorialSectionStyle}><div style={{display:'flex', alignItems:'center', marginBottom:'10px'}}><Icons.User /><h3 style={{marginLeft:'10px', margin:0}}>ADMIN</h3></div><p>Créez l'équipe, ajoutez les missions, cliquez sur le camion pour optimiser.</p></div>
        <div style={tutorialSectionStyle}><div style={{display:'flex', alignItems:'center', marginBottom:'10px'}}><Icons.Truck /><h3 style={{marginLeft:'10px', margin:0}}>TECH</h3></div><p>Suivez la route, validez les étapes, faites signer le client.</p></div>
        <div style={{textAlign:'center'}}><button onClick={onClose} style={{...submitButtonStyle, width:'auto', padding:'10px 30px'}}>COMPRIS</button></div>
    </div>
);

const LandingPage = ({ onStart }) => (
    <div style={landingContainerStyle}>
        <nav style={navStyle}>
            <div style={{display:'flex', alignItems:'center'}}><img src="/logo-truck.svg" alt="Logo" style={{height:'30px', marginRight:'10px'}} /><span style={{fontFamily:"'Oswald', sans-serif", fontSize:'20px', fontWeight:'bold'}}>OPTIROUTE</span></div>
            <button onClick={onStart} style={{padding:'8px 15px', fontSize:'12px', fontWeight:'bold', color:'white', backgroundColor:COLORS.BLUE, border:'none', borderRadius:PILL_RADIUS}}>CONNEXION</button>
        </nav>
        <section style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'20px'}}>
            <h1 style={{textAlign:'center', fontFamily:"'Oswald', sans-serif", fontSize:'40px', lineHeight:'1.1', marginBottom:'20px'}}>LA SOLUTION<br/>TOURNÉES</h1>
            <p style={{textAlign:'center', color:COLORS.GRAY_TEXT, maxWidth:'400px', marginBottom:'30px'}}>Planification IA, Suivi GPS et Signature Client.</p>
            <button onClick={onStart} style={ctaButtonStyle}>COMMENCER</button>
        </section>
    </div>
);

// --- APP ---
function App() {
    const API_URL = "https://optiroute-wxaz.onrender.com";
    const [token, setToken] = useState(localStorage.getItem('optiroute_token'));
    const [userRole, setUserRole] = useState(null);
    const [userId, setUserId] = useState(null);
    const [userName, setUserName] = useState("");
    const [userCompany, setUserCompany] = useState(localStorage.getItem('optiroute_company') || "");
    const [showLanding, setShowLanding] = useState(!token);
    const [showTutorial, setShowTutorial] = useState(false);
    
    // TABS: 0=Saisie/Liste, 1=Route, 2=History
    const [activeTab, setActiveTab] = useState(0);

    const [isLoginView, setIsLoginView] = useState(true);
    const [authEmail, setAuthEmail] = useState("");
    const [authPass, setAuthPass] = useState("");
    const [authCompany, setAuthCompany] = useState("");
    
    const [technicians, setTechnicians] = useState([]);
    const [selectedTechId, setSelectedTechId] = useState(null);
    const [route, setRoute] = useState([]);
    const [routePath, setRoutePath] = useState([]); 
    const [pendingMissions, setPendingMissions] = useState([]);
    const [historyTrips, setHistoryTrips] = useState([]);

    const [newName, setNewName] = useState("");
    const [newAddress, setNewAddress] = useState("");
    const [newPhone, setNewPhone] = useState("");
    const [newComments, setNewComments] = useState("");
    const [timeSlot, setTimeSlot] = useState("morning");
    const [duration, setDuration] = useState(30);
    
    const [newTechName, setNewTechName] = useState("");
    const [newTechAddress, setNewTechAddress] = useState("");
    const [newTechEmail, setNewTechEmail] = useState("");
    const [newTechPass, setNewTechPass] = useState("");

    const [mapCenter, setMapCenter] = useState([48.86, 2.33]); 
    const [mapBounds, setMapBounds] = useState(null);
    const [screenWidth, setScreenWidth] = useState(window.innerWidth);
    const [loading, setLoading] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [toast, setToast] = useState(null);

    const [navModal, setNavModal] = useState(null); 
    const [showTeamModal, setShowTeamModal] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    const [showEmptyModal, setShowEmptyModal] = useState(false);
    const [showUnassignedModal, setShowUnassignedModal] = useState(false);
    const [unassignedList, setUnassignedList] = useState([]); 
    const [techToDelete, setTechToDelete] = useState(null); 
    
    const [missionToSign, setMissionToSign] = useState(null);
    const sigCanvas = useRef(null);

    const isMobile = screenWidth < 768;
    const getAuthHeaders = () => ({ headers: { Authorization: `Bearer ${token}` } });

    useEffect(() => {
        const handleResize = () => setScreenWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        Crisp.configure("3a2abcb6-a8fd-4fc5-b856-a99c36e6ad0b");
        try { if (window.$crisp) window.$crisp.push(["do", "chat:show"]); } catch(e) {}
        
        if(token) {
            try {
                const decoded = jwtDecode(token);
                setUserRole(decoded.role); setUserId(decoded.id); setUserName(decoded.name);
                if(decoded.role === 'tech') setSelectedTechId(decoded.id);
                fetchTechnicians();
                fetchCurrentTrip();
            } catch(e) { handleLogout(); }
        }
        return () => window.removeEventListener('resize', handleResize);
    }, [token]);

    const handleLogout = () => {
        localStorage.clear();
        setToken(null); setUserRole(null); setRoute([]); setShowLanding(true);
    };

    const fetchTechnicians = async () => {
        try { const res = await axios.get(`${API_URL}/technicians`, getAuthHeaders()); setTechnicians(res.data); } catch(e){}
    };

    const fetchCurrentTrip = async () => {
        try {
            const res = await axios.get(`${API_URL}/trips/current`, getAuthHeaders());
            const savedPath = localStorage.getItem('saved_route_path');
            if(res.data && res.data.length > 0) {
                const mapped = res.data.map(m => ({
                    id: m.id, step: m.route_order, client: m.client_name, address: m.address, lat: m.lat, lng: m.lng, 
                    technician_name: m.technician_name, phone: m.phone, comments: m.comments, status: m.status, signature: m.signature
                }));
                setRoute(mapped);
                setActiveTab(1); // Go to Route tab
                if(savedPath) {
                    try { const p = JSON.parse(savedPath); if(p.length) { setRoutePath(p); setMapBounds(p); } } catch(e){}
                }
            }
        } catch(e){}
    };

    const fetchHistory = async () => {
        try { const res = await axios.get(`${API_URL}/trips/history`, getAuthHeaders()); setHistoryTrips(res.data); } catch(e){}
    };

    const handleAuth = async (e) => {
        e.preventDefault(); setLoading(true);
        try {
            const endpoint = isLoginView ? '/auth/login' : '/auth/register';
            const payload = isLoginView ? { email: authEmail, password: authPass } : { email: authEmail, password: authPass, company_name: authCompany };
            const res = await axios.post(`${API_URL}${endpoint}`, payload);
            if (isLoginView) {
                localStorage.setItem('optiroute_token', res.data.token);
                localStorage.setItem('optiroute_company', res.data.name || '');
                setToken(res.data.token); setUserCompany(res.data.name); setShowLanding(false);
                setTimeout(() => { fetchTechnicians(); fetchCurrentTrip(); }, 500);
            } else { setIsLoginView(true); alert("Compte créé !"); }
        } catch (err) { alert("Erreur connexion"); } 
        finally { setLoading(false); }
    };

    const handleAddMission = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/missions`, { client_name: newName, address: newAddress, time_slot: timeSlot, duration: duration, technician_id: selectedTechId, phone: newPhone, comments: newComments }, getAuthHeaders());
            setPendingMissions([...pendingMissions, { name: newName }]);
            setNewName(""); setNewAddress("");
        } catch (e) { alert("Erreur ajout"); }
    };

    const handleOptimize = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/optimize`, getAuthHeaders());
            if (res.data.route) {
                setRoute(res.data.route);
                setRoutePath(res.data.path);
                localStorage.setItem('saved_route_path', JSON.stringify(res.data.path));
                if(res.data.path.length > 0) setMapBounds(res.data.path);
                setActiveTab(1);
                setPendingMissions([]);
            }
        } catch (e) { alert("Erreur optimisation"); }
        finally { setLoading(false); }
    };

    const updateStatus = async (id, status, sig) => {
        try {
            await axios.patch(`${API_URL}/missions/${id}/status`, { status, signature: sig }, getAuthHeaders());
            setRoute(prev => prev.map(m => m.id === id ? { ...m, status, signature: sig } : m));
        } catch (e) { alert("Erreur statut"); }
    };

    const handleAddTech = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/technicians`, { name: newTechName, address: newTechAddress, email: newTechEmail, password: newTechPass }, getAuthHeaders());
            fetchTechnicians(); setShowTeamModal(false);
        } catch (e) { alert("Erreur ajout tech"); }
    };

    const resetAll = async () => {
        try {
            await axios.delete(`${API_URL}/missions/reset`, getAuthHeaders());
            setRoute([]); setRoutePath([]); setPendingMissions([]); localStorage.removeItem('saved_route_path');
            setShowResetModal(false); setActiveTab(0);
        } catch(e) { alert("Erreur reset"); }
    };

    if (showLanding && !token) return <LandingPage onStart={()=>setShowLanding(false)} />;
    if (showTutorial) return <TutorialPage onClose={()=>setShowTutorial(false)} />;
    if (!token) return (
        <div style={{height:'100vh', display:'flex', justifyContent:'center', alignItems:'center', background:COLORS.DARK}}>
            <div style={{background:'white', padding:'40px', borderRadius:'20px', width:'90%', maxWidth:'350px'}}>
                <h2 style={{textAlign:'center', fontFamily:"'Oswald', sans-serif"}}>{isLoginView?"CONNEXION":"INSCRIPTION"}</h2>
                <form onSubmit={handleAuth}>
                    {!isLoginView && <input placeholder="Entreprise" value={authCompany} onChange={e=>setAuthCompany(e.target.value)} style={inputStyle} />}
                    <input placeholder="Email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} style={inputStyle} />
                    <input type="password" placeholder="Pass" value={authPass} onChange={e=>setAuthPass(e.target.value)} style={inputStyle} />
                    <button type="submit" disabled={loading} style={{...submitButtonStyle, marginTop:'20px'}}>{loading?"...":"GO"}</button>
                </form>
                <div style={{textAlign:'center', marginTop:'20px', cursor:'pointer', fontSize:'12px', textDecoration:'underline'}} onClick={()=>setIsLoginView(!isLoginView)}>
                    {isLoginView?"Créer un compte":"J'ai déjà un compte"}
                </div>
            </div>
        </div>
    );

    return (
        <div style={rootContainerStyle(isMobile)}>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Oswald:wght@500;700&display=swap'); .leaflet-control-attribution { display: none !important; }`}</style>
            
            {/* MODALES */}
            {missionToSign && <div style={modalOverlayStyle} onClick={()=>setMissionToSign(null)}><div style={modalContentStyle} onClick={e=>e.stopPropagation()}><h3>SIGNATURE</h3><div style={{border:'2px dashed #ccc'}}><SignatureCanvas ref={sigCanvas} canvasProps={{width:300, height:150}} /></div><button onClick={()=>{if(sigCanvas.current && !sigCanvas.current.isEmpty()){updateStatus(missionToSign, 'done', sigCanvas.current.toDataURL()); setMissionToSign(null);}}} style={{...submitButtonStyle, marginTop:'10px'}}>VALIDER</button></div></div>}
            
            {showTeamModal && <div style={modalOverlayStyle} onClick={()=>setShowTeamModal(false)}><div style={modalContentStyle} onClick={e=>e.stopPropagation()}><h3>AJOUT TECH</h3><form onSubmit={handleAddTech}><input placeholder="Nom" value={newTechName} onChange={e=>setNewTechName(e.target.value)} style={inputStyle}/><AddressInput placeholder="Adresse" value={newTechAddress} onChange={setNewTechAddress}/><input placeholder="Email" value={newTechEmail} onChange={e=>setNewTechEmail(e.target.value)} style={inputStyle}/><input placeholder="Pass" value={newTechPass} onChange={e=>setNewTechPass(e.target.value)} style={inputStyle}/><button type="submit" style={submitButtonStyle}>AJOUTER</button></form></div></div>}

            {showResetModal && <div style={modalOverlayStyle} onClick={()=>setShowResetModal(false)}><div style={modalContentStyle} onClick={e=>e.stopPropagation()}><h3>RESET ?</h3><div style={{display:'flex', gap:'10px'}}><button onClick={()=>setShowResetModal(false)} style={cancelButtonStyle}>NON</button><button onClick={resetAll} style={submitButtonStyle}>OUI</button></div></div></div>}

            {/* PARTIE HAUTE : MAP (35% sur mobile) */}
            <div style={mapContainerStyle(isMobile)}>
                <MapContainer center={mapCenter} zoom={13} style={{height:'100%', width:'100%'}} zoomControl={false}>
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                    <MapController center={mapCenter} bounds={mapBounds} />
                    {technicians.map(t => {
                        const lat = parseFloat(t.start_lat); const lng = parseFloat(t.start_lng);
                        if(isValidCoord(lat) && isValidCoord(lng)) return <Marker key={t.id} position={[lat, lng]}><Popup>🏠 {t.name}</Popup></Marker>;
                        return null;
                    })}
                    {route.map((step, i) => {
                        if(isValidCoord(step.lat) && isValidCoord(step.lng)) return <Marker key={i} position={[step.lat, step.lng]}><Popup>#{step.step}</Popup></Marker>;
                        return null;
                    })}
                    {routePath.length > 0 && <Polyline positions={routePath} color={COLORS.BLUE} />}
                </MapContainer>
            </div>

            {/* PARTIE BASSE : PANEL (65% sur mobile) */}
            <div style={panelContainerStyle(isMobile)}>
                <div style={panelHeaderStyle}>
                    <div style={{display:'flex', justifyContent:'space-between'}}>
                        <div><h2 style={{margin:0, fontFamily:"'Oswald', sans-serif"}}>OPTIROUTE</h2><span style={{fontSize:'10px', color:COLORS.GRAY_TEXT}}>{userRole==='admin'?'ADMIN':'TECH'}: {userName}</span></div>
                        <div style={{display:'flex', alignItems:'center'}}>
                            <div onClick={()=>setShowTutorial(true)} style={{cursor:'pointer', marginRight:'15px'}}><Icons.Help/></div>
                            <button onClick={handleLogout} style={{border:'none', background:'transparent', color:COLORS.RED, fontWeight:'bold'}}>DÉCO</button>
                        </div>
                    </div>
                    {/* NAV TABS INTERNE */}
                    <div style={{display:'flex', gap:'10px', marginTop:'15px'}}>
                        <button onClick={()=>setActiveTab(0)} style={tabButtonStyle(activeTab===0)}>SAISIE</button>
                        <button onClick={()=>setActiveTab(1)} style={tabButtonStyle(activeTab===1)}>ROUTE ({route.length})</button>
                        <button onClick={()=>{fetchHistory(); setActiveTab(2);}} style={tabButtonStyle(activeTab===2)}>HISTO</button>
                    </div>
                </div>

                {/* CONTENU ONGLET 0 : SAISIE */}
                {activeTab === 0 && (
                    <div style={panelContentStyle}>
                        {userRole === 'admin' && (
                        <div style={{display:'flex', gap:'5px', overflowX:'auto', paddingBottom:'10px', marginBottom:'10px'}}>
                            {technicians.map(t => (
                                <div key={t.id} onClick={()=>{setSelectedTechId(t.id); 
                                    const lat=parseFloat(t.start_lat); const lng=parseFloat(t.start_lng);
                                    if(isValidCoord(lat)&&isValidCoord(lng)) { setMapCenter([lat, lng]); setMapBounds(null); }
                                }} style={{padding:'5px 15px', borderRadius:PILL_RADIUS, background: selectedTechId===t.id?COLORS.DARK:COLORS.WHITE, color:selectedTechId===t.id?'white':'black', border:'1px solid #ddd', fontSize:'12px', whiteSpace:'nowrap', cursor:'pointer'}}>
                                    {t.name}
                                </div>
                            ))}
                            <button onClick={()=>setShowTeamModal(true)} style={{border:'none', background:'transparent', fontSize:'12px', textDecoration:'underline', color:COLORS.BLUE}}>+ ÉQUIPE</button>
                        </div>
                        )}
                        
                        <div style={cardStyle}>
                            <form onSubmit={handleAddMission}>
                                <input placeholder="Client" value={newName} onChange={e=>setNewName(e.target.value)} style={inputStyle} />
                                <AddressInput placeholder="Adresse" value={newAddress} onChange={setNewAddress} />
                                <input placeholder="Tél" value={newPhone} onChange={e=>setNewPhone(e.target.value)} style={inputStyle} />
                                <input placeholder="Note" value={newComments} onChange={e=>setNewComments(e.target.value)} style={inputStyle} />
                                <button type="submit" style={submitButtonStyle}>AJOUTER MISSION</button>
                            </form>
                        </div>
                        
                        <div style={{textAlign:'center', marginTop:'10px'}}>
                            <div style={{fontSize:'12px', color:COLORS.GRAY_TEXT, marginBottom:'10px'}}>{pendingMissions.length} en attente</div>
                            <div style={{display:'flex', gap:'10px', justifyContent:'center'}}>
                                <button onClick={handleOptimize} style={{...submitButtonStyle, background:COLORS.BLUE, width:'auto', padding:'10px 30px'}}>OPTIMISER 🚚</button>
                                {userRole==='admin' && <button onClick={()=>setShowResetModal(true)} style={resetButtonStyle}>🗑️</button>}
                            </div>
                        </div>
                    </div>
                )}

                {/* CONTENU ONGLET 1 : ROUTE */}
                {activeTab === 1 && (
                    <div style={panelContentStyle}>
                        <div style={missionsListStyle}>
                            {route.length === 0 && <div style={{textAlign:'center', color:COLORS.GRAY_TEXT, marginTop:'20px'}}>Aucune route active.</div>}
                            {route.map((step, i) => (
                                <div key={i} style={missionItemStyle}>
                                    <div>
                                        <div style={{fontWeight:'bold'}}>#{step.step} {step.client}</div>
                                        <div style={{fontSize:'12px', color:COLORS.GRAY_TEXT}}>{step.address}</div>
                                        {step.comments && <div style={{fontSize:'11px', fontStyle:'italic'}}>📝 {step.comments}</div>}
                                        
                                        <div style={{marginTop:'10px', display:'flex', gap:'5px', flexWrap:'wrap'}}>
                                            {step.status === 'assigned' && <button onClick={()=>updateStatus(step.id, 'in_progress')} style={{...statusButtonStyle, background:COLORS.PASTEL_GREEN}}>DÉMARRER</button>}
                                            {step.status === 'in_progress' && <button onClick={()=>setMissionToSign(step.id)} style={{...statusButtonStyle, background:COLORS.PASTEL_RED}}>TERMINER</button>}
                                            {step.status === 'done' && (
                                                <div>
                                                    <div style={{fontSize:'11px', color:'green', fontWeight:'bold'}}>✅ VALIDÉ</div>
                                                    <button onClick={()=>generatePDF(step, step.technician_name, userCompany)} style={pdfButtonStyle}>📄 PDF</button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{display:'flex', flexDirection:'column', gap:'5px'}}>
                                        {step.phone && <a href={`tel:${step.phone}`} style={phoneButtonStyle}>📞</a>}
                                        <button onClick={()=>{
                                            setNavModal({lat: step.lat, lng: step.lng});
                                            if(isValidCoord(step.lat) && isValidCoord(step.lng)) {
                                                setMapCenter([step.lat, step.lng]);
                                                setMapBounds(null); // Focus on point
                                            }
                                        }} style={compassButtonStyle}>🧭</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* CONTENU ONGLET 2 : HISTO */}
                {activeTab === 2 && (
                    <div style={panelContentStyle}>
                        {historyTrips.length === 0 ? <div style={{textAlign:'center', color:COLORS.GRAY_TEXT}}>Aucun historique.</div> : 
                        historyTrips.map(t => (
                            <div key={t.id} style={tripCardStyle}>
                                <div style={{fontWeight:'bold'}}>{t.name}</div>
                                <div style={{fontSize:'12px', color:COLORS.GRAY_TEXT}}>{new Date(t.created_at).toLocaleDateString()}</div>
                                <div style={{fontSize:'12px', marginTop:'5px'}}>{t.status === 'active' ? '🟢 En cours' : '🔴 Terminé'} • {t.total_km} km</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;