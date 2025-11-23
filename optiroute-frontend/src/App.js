import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css'; 
import L from 'leaflet';
import { jwtDecode } from 'jwt-decode'; 
import SignatureCanvas from 'react-signature-canvas';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Crisp } from "crisp-sdk-web";

// --- FIX ASSETS LEAFLET ---
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: iconRetinaUrl,
    iconUrl: iconUrl,
    shadowUrl: shadowUrl,
});

// --- 1. CONSTANTES & DESIGN SYSTEM ---
const COLORS = {
    DARK: '#3b4651', 
    BLUE: '#2b79c2', 
    PASTEL_BLUE: '#A0C4FF', 
    PASTEL_GREEN: '#B9FBC0', 
    PASTEL_RED: '#FFADAD', 
    WHITE: '#ffffff', 
    BORDER: '#e0e0e0', 
    GRAY_TEXT: '#6c757d', 
    BG_LIGHT: '#f8f9fa', 
    WARNING: '#ffd6a5',
    SUCCESS_TEXT: '#2e7d32'
};

const PILL_RADIUS = '38px'; 
const STANDARD_RADIUS = '12px';
const SHADOW = '0 8px 20px rgba(0,0,0,0.08)';
const NAV_HEIGHT = '65px'; // Hauteur barre nav mobile

// --- 2. STYLES CSS-IN-JS (ORDRE CORRECT) ---

// Layout Principal Adaptatif
const rootContainerStyle = (isMobile) => ({ 
    display: 'flex', 
    flexDirection: isMobile ? 'column' : 'row', 
    height: '100vh', 
    width: '100vw',
    fontFamily: "'Inter', sans-serif", 
    backgroundColor: COLORS.BG_LIGHT, 
    overflow: 'hidden',
    position: 'fixed', top:0, left:0, right:0, bottom:0 // Force le plein écran mobile
});

// Carte : 35% Hauteur sur Mobile, 100% Largeur sur Desktop (à droite)
const mapContainerStyle = (isMobile) => ({ 
    flex: isMobile ? 'none' : 1, 
    height: isMobile ? '35vh' : '100%', 
    width: '100%',
    order: isMobile ? 1 : 2, 
    borderLeft: isMobile ? 'none' : '1px solid ' + COLORS.BORDER,
    zIndex: 0,
    position: 'relative'
});

// Panneau : Reste de la hauteur sur Mobile, 450px sur Desktop (à gauche)
const panelContainerStyle = (isMobile) => ({ 
    width: isMobile ? '100%' : '450px', 
    flex: isMobile ? 1 : 'none', // Prend tout l'espace restant en bas
    height: isMobile ? 'auto' : '100%',
    backgroundColor: 'white',
    display: 'flex', 
    flexDirection: 'column', 
    order: isMobile ? 2 : 1, 
    zIndex: 10, 
    boxShadow: isMobile ? '0 -5px 20px rgba(0,0,0,0.1)' : '5px 0 30px rgba(0,0,0,0.05)',
    position: 'relative',
    borderTopRightRadius: isMobile ? '20px' : '0', // Joli arrondi sur mobile
    borderTopLeftRadius: isMobile ? '20px' : '0'
});

// Header du panneau
const panelHeaderStyle = { 
    padding: '20px', 
    borderBottom: '1px solid ' + COLORS.BORDER, 
    backgroundColor: '#fff',
    borderTopRightRadius: '20px',
    borderTopLeftRadius: '20px'
};

// Zone de contenu scrollable (IMPORTANT pour mobile)
const panelContentStyle = (isMobile) => ({ 
    flex: 1, 
    overflowY: 'auto', 
    padding: '20px', 
    paddingBottom: isMobile ? '80px' : '20px', // Espace pour la nav bar mobile
    WebkitOverflowScrolling: 'touch' 
});

// Barre de Navigation Mobile (Fixée en bas)
const mobileBottomNavStyle = {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: NAV_HEIGHT,
    backgroundColor: COLORS.WHITE, borderTop: '1px solid ' + COLORS.BORDER,
    display: 'flex', justifyContent: 'space-around', alignItems: 'center',
    zIndex: 100, paddingBottom: '5px'
};

const mobileNavItemStyle = (isActive) => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    color: isActive ? COLORS.BLUE : COLORS.GRAY_TEXT, fontSize: '10px', fontWeight: 'bold',
    cursor: 'pointer', flex: 1, height: '100%', borderTop: isActive ? '3px solid '+COLORS.BLUE : '3px solid transparent'
});

// Styles Composants UI
const proTagStyle = { fontSize: '0.4em', backgroundColor: COLORS.BLUE, color: COLORS.WHITE, padding: '3px 6px', verticalAlign: 'top', marginLeft: '8px', fontFamily: "'Inter', sans-serif", fontWeight: '700', borderRadius: '4px' };
const cardStyle = { marginBottom: '15px', backgroundColor: COLORS.BG_LIGHT, padding:'15px', borderRadius: STANDARD_RADIUS, border:'1px solid '+COLORS.BORDER }; 
const cardTitleStyle = { margin: 0, fontWeight: '700', color: COLORS.DARK };
const inputStyle = { width: '100%', padding: '16px', marginBottom: '10px', borderRadius: PILL_RADIUS, border: '1px solid #ddd', backgroundColor: '#fff', fontSize: '16px', color: COLORS.DARK, outline: 'none', boxSizing: 'border-box' };
const dropdownItemStyle = { padding: '12px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '13px', fontFamily: "'Inter', sans-serif", color: COLORS.DARK, fontWeight: '600', transition: 'background 0.2s' };
const submitButtonStyle = { width: '100%', padding: '16px', backgroundColor: COLORS.DARK, color: COLORS.WHITE, border: 'none', borderRadius: PILL_RADIUS, fontWeight: '700', fontSize: '14px', letterSpacing: '1px', cursor: 'pointer', textTransform: 'uppercase', fontFamily: "'Oswald', sans-serif" };
const actionButtonsContainerStyle = { display: 'flex', justifyContent: 'center', marginTop: '10px', paddingBottom:'20px' };
const optimizeButtonStyle = { padding: '0', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' };
const resetButtonStyle = { padding: '10px', backgroundColor: 'white', borderRadius: '50%', border: '1px solid #ddd', cursor: 'pointer', width: '50px', height: '50px', display:'flex', alignItems:'center', justifyContent:'center', marginLeft:'15px' };
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
const navStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 40px', backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', position: 'fixed', top: 0, width: '100%', zIndex: 1000, boxSizing: 'border-box', borderBottom: '1px solid '+COLORS.BORDER };
const heroSectionStyle = { padding: '140px 20px 80px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' };
const heroTitleStyle = { fontFamily: "'Oswald', sans-serif", fontSize: 'clamp(40px, 6vw, 70px)', textTransform: 'uppercase', lineHeight: '1.1', margin: '0 0 20px', maxWidth: '900px' };
const heroSubtitleStyle = { fontSize: '18px', color: COLORS.GRAY_TEXT, maxWidth: '600px', margin: '0 auto 40px', lineHeight: '1.6' };
const ctaButtonStyle = { padding: '18px 40px', fontSize: '16px', fontWeight: '700', color: COLORS.WHITE, backgroundColor: COLORS.BLUE, border: 'none', borderRadius: PILL_RADIUS, cursor: 'pointer', textTransform: 'uppercase', fontFamily: "'Oswald', sans-serif", letterSpacing: '1px', boxShadow: '0 10px 25px rgba(43, 121, 194, 0.4)', transition: 'transform 0.2s' };
const featuresGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px', padding: '60px 10%', maxWidth: '1400px', margin: '0 auto' };
const featureCardStyle = (color) => ({ backgroundColor: COLORS.WHITE, padding: '40px', borderRadius: '24px', border: `1px solid ${COLORS.BORDER}`, boxShadow: SHADOW, position: 'relative', overflow: 'hidden' });
const tutorialContainerStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: COLORS.BG_LIGHT, zIndex: 20000, overflowY: 'auto', padding: '40px 20px' };
const tutorialHeaderStyle = { maxWidth: '800px', margin: '0 auto 40px', textAlign: 'center' };
const tutorialSectionStyle = { maxWidth: '800px', margin: '0 auto 30px', backgroundColor: 'white', padding: '30px', borderRadius: '20px', boxShadow: SHADOW };
const stepNumberStyle = { display: 'inline-block', backgroundColor: COLORS.BLUE, color: 'white', width: '25px', height: '25px', borderRadius: '50%', textAlign: 'center', lineHeight: '25px', marginRight: '10px', fontWeight: 'bold', fontSize: '14px' };

// --- 3. SVG ICONS ---
const Icons = {
    User: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={COLORS.BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>,
    Truck: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={COLORS.BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>,
    Help: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={COLORS.GRAY_TEXT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>,
    Map: ({color}) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color || COLORS.BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg>,
    Check: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={COLORS.BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>,
    History: ({color}) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color || COLORS.GRAY_TEXT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
    List: ({color}) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color || COLORS.BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
};

// --- 4. UTILS & HELPERS ---
const isValidCoord = (n) => !isNaN(parseFloat(n)) && isFinite(n) && n !== null;

const formatDuration = (minutes) => {
    if (!minutes) return "";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}h ${m > 0 ? m + 'min' : ''}`;
    return `${m} min`;
};

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
        } else { firstPage.drawText("(Non signé)", { x: 50, y: height - 550, size: 10, font: font, color: rgb(0.5,0.5,0.5) }); }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Rapport_${mission.client.replace(/\s+/g, '_')}.pdf`;
        link.click();
    } catch (error) { alert("Erreur PDF. Vérifiez template."); }
};

const AddressInput = ({ placeholder, value, onChange }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    useEffect(() => {
        const t = setTimeout(async () => {
            if (value.length > 3 && showSuggestions) {
                try {
                    const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${value}&limit=5`);
                    const data = await res.json();
                    setSuggestions(data.features);
                } catch (e) {}
            } else setSuggestions([]);
        }, 300);
        return () => clearTimeout(t);
    }, [value, showSuggestions]);
    return (
        <div style={{ position: 'relative', width: '100%' }}>
            <input type="text" placeholder={placeholder} value={value} onChange={(e) => {onChange(e.target.value); setShowSuggestions(true);}} style={inputStyle} />
            {suggestions.length > 0 && showSuggestions && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', borderRadius: '12px', boxShadow: SHADOW, zIndex: 20000, marginTop: '-5px', border: '1px solid ' + COLORS.BORDER }}>
                    {suggestions.map((s, i) => (
                        <div key={i} onClick={() => { onChange(s.properties.label); setShowSuggestions(false); }} style={{ padding: '15px', borderBottom: '1px solid #eee', fontSize: '13px' }}>📍 {s.properties.label}</div>
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
                if(valid.length > 0) map.fitBounds(valid, { padding: [50, 50] });
            } else if (center && isValidCoord(center[0]) && isValidCoord(center[1])) {
                map.flyTo(center, 13);
            }
        } catch(e) {}
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

// --- 5. PAGES ---
const TutorialPage = ({ onClose }) => (
    <div style={tutorialContainerStyle}>
        <div style={tutorialHeaderStyle}><h1 style={{fontFamily:"'Oswald', sans-serif", textTransform:'uppercase', color:COLORS.DARK}}>GUIDE</h1></div>
        <div style={tutorialSectionStyle}><div style={{display:'flex', alignItems:'center', marginBottom:'10px'}}><Icons.User /><h3 style={{marginLeft:'10px', margin:0}}>ADMIN</h3></div><p>Gérez l'équipe, ajoutez les missions, optimisez.</p></div>
        <div style={tutorialSectionStyle}><div style={{display:'flex', alignItems:'center', marginBottom:'10px'}}><Icons.Truck /><h3 style={{marginLeft:'10px', margin:0}}>TECH</h3></div><p>Naviguez, validez, signez.</p></div>
        <div style={{textAlign:'center'}}><button onClick={onClose} style={{...submitButtonStyle, width:'auto', padding:'10px 30px'}}>COMPRIS</button></div>
    </div>
);

const LandingPage = ({ onStart }) => (
    <div style={landingContainerStyle}>
        <nav style={navStyle}>
            <div style={{display:'flex', alignItems:'center'}}><img src="/logo-truck.svg" alt="Logo" style={{height:'40px', marginRight:'15px'}} /><span style={{fontFamily:"'Oswald', sans-serif", fontSize:'24px', fontWeight:'bold', letterSpacing:'1px'}}>OPTIROUTE <span style={proTagStyle}>PRO</span></span></div>
            <button onClick={onStart} style={{...submitButtonStyle, width:'auto', padding:'10px 25px', fontSize:'12px', boxShadow:'none'}}>ACCÈS CLIENT</button>
        </nav>
        <section style={heroSectionStyle}>
            <h1 style={heroTitleStyle}>OPTIMISEZ VOS TOURNÉES</h1>
            <button onClick={onStart} style={ctaButtonStyle}>COMMENCER GRATUITEMENT</button>
        </section>
    </div>
);

// --- 6. APP ---
function App() {
    const API_URL = "https://optiroute-wxaz.onrender.com";
    const [token, setToken] = useState(localStorage.getItem('optiroute_token'));
    const [userRole, setUserRole] = useState(null);
    const [userId, setUserId] = useState(null);
    const [userName, setUserName] = useState("");
    const [userCompany, setUserCompany] = useState(localStorage.getItem('optiroute_company') || "");
    const [showLanding, setShowLanding] = useState(!token);
    const [showTutorial, setShowTutorial] = useState(false);
    
    // TABS GLOBAUX (Gèrent tout : Desktop et Mobile)
    // 0: Saisie, 1: Route, 2: Historique
    const [activeTab, setActiveTab] = useState(0);

    const [isLoginView, setIsLoginView] = useState(true);
    const [authEmail, setAuthEmail] = useState("");
    const [authPass, setAuthPass] = useState("");
    const [authCompany, setAuthCompany] = useState("");
    const [authError, setAuthError] = useState("");
    const [authLoading, setAuthLoading] = useState(false);

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
    const [isDeletingTech, setIsDeletingTech] = useState(false);
    const [missionToSign, setMissionToSign] = useState(null);
    const sigCanvas = useRef(null);

    const isMobile = screenWidth < 768;
    const getAuthHeaders = () => ({ headers: { Authorization: `Bearer ${token}` } });

    // --- HELPERS ---
    const handleLogout = () => {
        localStorage.clear(); setToken(null); setUserRole(null); setRoute([]); setShowLanding(true);
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
                setActiveTab(1);
                if(savedPath) {
                    try { const p = JSON.parse(savedPath); if(p.length) { setRoutePath(p); setMapBounds(p); } } catch(e){}
                }
            }
        } catch(e){}
    };
    const fetchHistory = async () => { try { const res = await axios.get(`${API_URL}/trips/history`, getAuthHeaders()); setHistoryTrips(res.data); } catch(e){} };
    const handleAuth = async (e) => { e.preventDefault(); setLoading(true); try { const endpoint = isLoginView ? '/auth/login' : '/auth/register'; const payload = isLoginView ? { email: authEmail, password: authPass } : { email: authEmail, password: authPass, company_name: authCompany }; const res = await axios.post(`${API_URL}${endpoint}`, payload); if (isLoginView) { localStorage.setItem('optiroute_token', res.data.token); localStorage.setItem('optiroute_company', res.data.name||''); setToken(res.data.token); setUserCompany(res.data.name); setShowLanding(false); setTimeout(()=>{fetchTechnicians();fetchCurrentTrip();},500); } else { setIsLoginView(true); alert("Compte créé !"); } } catch(e) { alert("Erreur"); } finally { setLoading(false); } };
    const handleAddMission = async (e) => { e.preventDefault(); try { await axios.post(`${API_URL}/missions`, { client_name: newName, address: newAddress, time_slot: timeSlot, duration: duration, technician_id: selectedTechId, phone: newPhone, comments: newComments }, getAuthHeaders()); setPendingMissions([...pendingMissions, { name: newName }]); setNewName(""); setNewAddress(""); } catch(e) { alert("Erreur"); } };
    const handleOptimize = async () => { setLoading(true); try { const res = await axios.get(`${API_URL}/optimize`, getAuthHeaders()); if(res.data.route) { setRoute(res.data.route); setRoutePath(res.data.path); localStorage.setItem('saved_route_path', JSON.stringify(res.data.path)); if(res.data.path.length>0) setMapBounds(res.data.path); setActiveTab(1); setPendingMissions([]); } } catch(e) { alert("Erreur"); } finally { setLoading(false); } };
    const updateStatus = async (id, status, sig) => { try { await axios.patch(`${API_URL}/missions/${id}/status`, { status, signature: sig }, getAuthHeaders()); setRoute(prev => prev.map(m => m.id===id ? { ...m, status, signature: sig } : m)); } catch(e){} };
    const handleAddTech = async (e) => { e.preventDefault(); try { await axios.post(`${API_URL}/technicians`, { name: newTechName, address: newTechAddress, email: newTechEmail, password: newTechPass }, getAuthHeaders()); fetchTechnicians(); setShowTeamModal(false); } catch(e){} };
    const resetAll = async () => { try { await axios.delete(`${API_URL}/missions/reset`, getAuthHeaders()); setRoute([]); setRoutePath([]); setPendingMissions([]); localStorage.removeItem('saved_route_path'); setShowResetModal(false); setActiveTab(0); } catch(e){} };

    useEffect(() => {
        const h = () => setScreenWidth(window.innerWidth); window.addEventListener('resize', h);
        Crisp.configure("3a2abcb6-a8fd-4fc5-b856-a99c36e6ad0b");
        if(token) { try { const d = jwtDecode(token); setUserRole(d.role); setUserId(d.id); setUserName(d.name); if(d.role==='tech') setSelectedTechId(d.id); fetchTechnicians(); fetchCurrentTrip(); } catch(e){ handleLogout(); } }
        return () => window.removeEventListener('resize', h);
    }, [token]);

    if (showLanding && !token) return <LandingPage onStart={()=>setShowLanding(false)} />;
    if (showTutorial) return <TutorialPage onClose={()=>setShowTutorial(false)} />;
    if (!token) return <div style={{height:'100vh', display:'flex', justifyContent:'center', alignItems:'center', background:COLORS.DARK}}><div style={{background:'white', padding:'40px', borderRadius:'20px', width:'90%', maxWidth:'350px'}}><h2 style={{textAlign:'center', fontFamily:"'Oswald', sans-serif"}}>{isLoginView?"CONNEXION":"INSCRIPTION"}</h2><form onSubmit={handleAuth}>{!isLoginView && <input placeholder="Entreprise" value={authCompany} onChange={e=>setAuthCompany(e.target.value)} style={inputStyle} />}<input placeholder="Email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} style={inputStyle} /><input type="password" placeholder="Pass" value={authPass} onChange={e=>setAuthPass(e.target.value)} style={inputStyle} /><button type="submit" disabled={loading} style={{...submitButtonStyle, marginTop:'20px'}}>{loading?"...":"GO"}</button></form><div style={{textAlign:'center', marginTop:'20px', cursor:'pointer', fontSize:'12px', textDecoration:'underline'}} onClick={()=>setIsLoginView(!isLoginView)}>{isLoginView?"Créer un compte":"J'ai déjà un compte"}</div></div></div>;

    return (
        <div style={rootContainerStyle(isMobile)}>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Oswald:wght@500;700&display=swap'); .leaflet-control-attribution { display: none !important; }`}</style>
            
            {/* MODALES */}
            {missionToSign && <div style={modalOverlayStyle} onClick={()=>setMissionToSign(null)}><div style={modalContentStyle} onClick={e=>e.stopPropagation()}><h3>SIGNATURE</h3><div style={{border:'2px dashed #ccc'}}><SignatureCanvas ref={sigCanvas} canvasProps={{width:300, height:150}} /></div><button onClick={()=>{if(sigCanvas.current && !sigCanvas.current.isEmpty()){updateStatus(missionToSign, 'done', sigCanvas.current.toDataURL()); setMissionToSign(null);}}} style={{...submitButtonStyle, marginTop:'10px'}}>VALIDER</button></div></div>}
            {showTeamModal && <div style={modalOverlayStyle} onClick={()=>setShowTeamModal(false)}><div style={modalContentStyle} onClick={e=>e.stopPropagation()}><h3>AJOUT TECH</h3><form onSubmit={handleAddTech}><input placeholder="Nom" value={newTechName} onChange={e=>setNewTechName(e.target.value)} style={inputStyle}/><AddressInput placeholder="Adresse" value={newTechAddress} onChange={setNewTechAddress}/><input placeholder="Email" value={newTechEmail} onChange={e=>setNewTechEmail(e.target.value)} style={inputStyle}/><input placeholder="Pass" value={newTechPass} onChange={e=>setNewTechPass(e.target.value)} style={inputStyle}/><button type="submit" style={submitButtonStyle}>AJOUTER</button></form></div></div>}
            {showResetModal && <div style={modalOverlayStyle} onClick={()=>setShowResetModal(false)}><div style={modalContentStyle} onClick={e=>e.stopPropagation()}><h3>RESET ?</h3><div style={{display:'flex', gap:'10px'}}><button onClick={()=>setShowResetModal(false)} style={cancelButtonStyle}>NON</button><button onClick={resetAll} style={submitButtonStyle}>OUI</button></div></div></div>}

            {/* HAUT : MAP */}
            <div style={mapContainerStyle(isMobile)}>
                <MapContainer center={mapCenter} zoom={13} style={{height:'100%', width:'100%'}} zoomControl={false}>
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                    <MapController center={mapCenter} bounds={mapBounds} />
                    {technicians.map(t => { const lat=parseFloat(t.start_lat); const lng=parseFloat(t.start_lng); if(isValidCoord(lat)&&isValidCoord(lng)) return <Marker key={t.id} position={[lat, lng]}><Popup>🏠 {t.name}</Popup></Marker>; return null; })}
                    {route.map((step, i) => { if(isValidCoord(step.lat)&&isValidCoord(step.lng)) return <Marker key={i} position={[step.lat, step.lng]} icon={createCustomIcon(i, route.length, step.status, userRole==='tech'?step.technician_name===userName:true)}><Popup>#{step.step} {step.client}</Popup></Marker>; return null; })}
                    {routePath.length > 0 && <Polyline positions={routePath} color={COLORS.BLUE} />}
                </MapContainer>
            </div>

            {/* BAS : PANEL (AVEC NAVIGATION INTERNE) */}
            <div style={panelContainerStyle(isMobile)}>
                <div style={panelHeaderStyle}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                        <div><h2 style={{margin:0, fontFamily:"'Oswald', sans-serif"}}>OPTIROUTE</h2><span style={{fontSize:'10px'}}>{userName}</span></div>
                        <div style={{display:'flex'}}>
                            <div onClick={()=>setShowTutorial(true)} style={{cursor:'pointer', marginRight:'10px'}}><Icons.Help/></div>
                            <button onClick={handleLogout} style={{border:'none', background:'transparent', color:COLORS.RED, fontWeight:'bold'}}>DÉCO</button>
                        </div>
                    </div>
                </div>

                {/* NAVIGATION DES ONGLETS (VISIBLE PARTOUT) */}
                <div style={isMobile ? mobileBottomNavStyle : {display:'flex', gap:'10px', marginBottom:'20px'}}>
                    <div onClick={()=>setActiveTab(0)} style={mobileNavItemStyle(activeTab===0)}><Icons.List color={activeTab===0?COLORS.BLUE:COLORS.GRAY_TEXT}/> SAISIE</div>
                    <div onClick={()=>setActiveTab(1)} style={mobileNavItemStyle(activeTab===1)}><Icons.Map color={activeTab===1?COLORS.BLUE:COLORS.GRAY_TEXT}/> ROUTE</div>
                    <div onClick={()=>{fetchHistory(); setActiveTab(2);}} style={mobileNavItemStyle(activeTab===2)}><Icons.History color={activeTab===2?COLORS.BLUE:COLORS.GRAY_TEXT}/> HISTO</div>
                </div>

                {/* CONTENU */}
                <div style={panelContentStyle(isMobile)}>
                    {activeTab === 0 && (
                        <>
                            {userRole==='admin' && (
                                <div style={{display:'flex', gap:'5px', overflowX:'auto', marginBottom:'10px'}}>
                                    {technicians.map(t=><div key={t.id} onClick={()=>{setSelectedTechId(t.id); const lat=parseFloat(t.start_lat); if(isValidCoord(lat)) setMapCenter([lat, parseFloat(t.start_lng)]);}} style={{padding:'5px 10px', borderRadius:PILL_RADIUS, background:selectedTechId===t.id?COLORS.DARK:COLORS.WHITE, color:selectedTechId===t.id?'white':'black', border:'1px solid #ddd', cursor:'pointer'}}>{t.name}</div>)}
                                    <button onClick={()=>setShowTeamModal(true)} style={{border:'none', background:'transparent', color:COLORS.BLUE, textDecoration:'underline'}}>+ ÉQUIPE</button>
                                </div>
                            )}
                            <div style={cardStyle}>
                                <form onSubmit={handleAddMission}>
                                    <input placeholder="Client" value={newName} onChange={e=>setNewName(e.target.value)} style={inputStyle} />
                                    <AddressInput placeholder="Adresse" value={newAddress} onChange={setNewAddress} />
                                    <input placeholder="Tél" value={newPhone} onChange={e=>setNewPhone(e.target.value)} style={inputStyle} />
                                    <input placeholder="Note" value={newComments} onChange={e=>setNewComments(e.target.value)} style={inputStyle} />
                                    <button type="submit" style={submitButtonStyle}>AJOUTER</button>
                                </form>
                            </div>
                            <div style={{textAlign:'center', marginTop:'10px'}}>
                                {pendingMissions.length} en attente
                                <div style={{display:'flex', gap:'10px', justifyContent:'center', marginTop:'10px'}}>
                                    <button onClick={handleOptimize} style={{...submitButtonStyle, background:COLORS.BLUE, width:'auto', padding:'10px 30px'}}>OPTIMISER 🚚</button>
                                    {userRole==='admin' && <button onClick={()=>setShowResetModal(true)} style={resetButtonStyle}>🗑️</button>}
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 1 && (
                        <div style={missionsListStyle}>
                            {route.length===0 && <div style={{textAlign:'center', color:COLORS.GRAY_TEXT}}>Aucune route.</div>}
                            {route.map((step, i) => (
                                <div key={i} style={missionItemStyle}>
                                    <div style={{flex:1}}>
                                        <div style={{fontWeight:'bold'}}>#{step.step} {step.client}</div>
                                        <div style={{fontSize:'12px', color:COLORS.GRAY_TEXT}}>{step.address}</div>
                                        {step.comments && <div style={{fontSize:'11px', fontStyle:'italic'}}>📝 {step.comments}</div>}
                                        <div style={{marginTop:'10px', display:'flex', gap:'5px', flexWrap:'wrap'}}>
                                            {step.status==='assigned' && <button onClick={()=>updateStatus(step.id, 'in_progress')} style={{...statusButtonStyle, background:COLORS.PASTEL_GREEN}}>DÉMARRER</button>}
                                            {step.status==='in_progress' && <button onClick={()=>setMissionToSign(step.id)} style={{...statusButtonStyle, background:COLORS.PASTEL_RED}}>TERMINER</button>}
                                            {step.status==='done' && <div style={{width:'100%', fontSize:'12px', color:'green', fontWeight:'bold'}}>✅ TERMINÉ<br/><button onClick={()=>generatePDF(step, step.technician_name, userCompany)} style={{fontSize:'10px', padding:'5px', border:'1px solid #ddd', marginTop:'5px'}}>📄 PDF</button></div>}
                                        </div>
                                    </div>
                                    <div style={{display:'flex', flexDirection:'column', gap:'5px'}}>
                                        {step.phone && <a href={`tel:${step.phone}`} style={phoneButtonStyle}>📞</a>}
                                        <button onClick={()=>{setNavModal({lat:step.lat, lng:step.lng}); if(isValidCoord(step.lat)) setMapCenter([step.lat, step.lng]);}} style={compassButtonStyle}>🧭</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 2 && (
                        <div style={missionsListStyle}>
                            {historyTrips.map(t => (
                                <div key={t.id} style={tripCardStyle}>
                                    <div style={{fontWeight:'bold'}}>{t.name}</div>
                                    <div style={{fontSize:'12px', color:COLORS.GRAY_TEXT}}>{new Date(t.created_at).toLocaleDateString()} • {t.total_km} km</div>
                                    <div style={{fontSize:'12px', color: t.status==='active'?'green':'gray'}}>{t.status==='active'?'EN COURS':'TERMINÉ'}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default App;