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

// --- CHARTE GRAPHIQUE NIKE PRO ---
const COLORS = {
    DARK: '#3b4651', 
    BLUE: '#2b79c2', 
    GREEN: '#28a745', 
    RED: '#dc3545',   
    WHITE: '#ffffff',
    BORDER: '#dcdcde',
    GRAY_TEXT: '#6c757d',
    SUCCESS: '#28a745',
    WARNING: '#ff9800',
    BG_LIGHT: '#f4f6f8'
};

const PILL_RADIUS = '38px'; 
const STANDARD_RADIUS = '8px';

// CRÉATION DES MARQUEURS COLORES
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
    
    // Formulaire Mission
    const [newName, setNewName] = useState("");
    const [newAddress, setNewAddress] = useState("");
    const [timeSlot, setTimeSlot] = useState("morning");
    const [duration, setDuration] = useState(30);
    const [isAddingMission, setIsAddingMission] = useState(false); // Loading state

    // "Panier" de missions en attente
    const [pendingMissions, setPendingMissions] = useState([]);

    const [screenWidth, setScreenWidth] = useState(window.innerWidth);
    
    // MODALS & NOTIFICATIONS
    const [navModal, setNavModal] = useState(null); 
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const [showEmptyModal, setShowEmptyModal] = useState(false);
    const [unassignedList, setUnassignedList] = useState([]); 
    const [showUnassignedModal, setShowUnassignedModal] = useState(false);
    
    // UX Notifications
    const [toast, setToast] = useState(null); // Pour la notif discrète
    const [showTechSuccessModal, setShowTechSuccessModal] = useState(false); // Pour la modale tech

    // TEAM
    const [showTeamModal, setShowTeamModal] = useState(false);
    const [technicians, setTechnicians] = useState([]);
    const [newTechName, setNewTechName] = useState("");
    const [newTechAddress, setNewTechAddress] = useState("");
    const [isAddingTech, setIsAddingTech] = useState(false); // Loading state
    
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const isMobileView = screenWidth < 768;
    const center = [48.8675, 2.3639]; 

    // --- EFFETS ---
    useEffect(() => {
        const handleResize = () => setScreenWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => { if (token) fetchTechnicians(); }, [token]);

    // Auto-hide Toast
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const getAuthHeaders = () => ({ headers: { Authorization: `Bearer ${token}` } });

    // --- AUTH ---
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

    // --- LOGIQUE APP ---
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
            await axios.post(`${API_URL}/technicians`, { name: newTechName, address: newTechAddress }, getAuthHeaders());
            setNewTechName(""); setNewTechAddress("");
            await fetchTechnicians();
            setShowTechSuccessModal(true); // Modale de confirmation
        } catch (error) { alert("Erreur adresse ou serveur"); }
        finally { setIsAddingTech(false); }
    };

    const handleDeleteTech = async (id) => {
        if(!window.confirm("Supprimer ce technicien ?")) return;
        try { await axios.delete(`${API_URL}/technicians/${id}`, getAuthHeaders()); fetchTechnicians(); } 
        catch (e) { alert("Erreur"); }
    };

    const handleAddMission = async (e) => {
        e.preventDefault(); 
        if(!newName || !newAddress) return;
        setIsAddingMission(true);
        try {
            const response = await axios.post(`${API_URL}/missions`, { client_name: newName, address: newAddress, time_slot: timeSlot, duration: duration }, getAuthHeaders());
            if(response.data.success) { 
                // Ajout au "Panier" visuel
                setPendingMissions([...pendingMissions, { name: newName, address: newAddress, time: duration }]);
                setNewName(""); setNewAddress(""); 
                setToast({ message: "Mission ajoutée avec succès !", type: "success" }); // Toast discret
            } 
            else { alert("Erreur : " + response.data.message); }
        } catch (error) { alert("Erreur réseau !"); }
        finally { setIsAddingMission(false); }
    };

    const handleOptimize = async () => {
        setLoading(true); setUnassignedList([]); 
        try {
            const response = await axios.get(`${API_URL}/optimize`, getAuthHeaders());
            if (response.data.path && Array.isArray(response.data.route)) {
                setRoute(response.data.route); setRoutePath(response.data.path);
                setPendingMissions([]); // On vide le panier car c'est traité
            } else { setRoute([]); }

            if (response.data.unassigned?.length > 0) {
                setUnassignedList(response.data.unassigned); setShowUnassignedModal(true); 
            } else if (!response.data.route?.length) { setShowEmptyModal(true); }
        } catch (error) { console.error(error); alert("Erreur : " + (error.response?.data?.error || error.message)); }
        finally { setLoading(false); }
    };

    const confirmReset = async () => {
        setResetLoading(true);
        try {
            await axios.get(`${API_URL}/init-data`, getAuthHeaders()); 
            setRoute([]); setRoutePath([]); setUnassignedList([]); setPendingMissions([]);
            setTimeout(() => fetchTechnicians(), 500); 
            setShowResetModal(false); setToast({ message: "Tout a été effacé.", type: "info" });
        } catch (error) { alert("Erreur"); }
        finally { setResetLoading(false); }
    };

    // --- RENDER HELPERS ---
    const renderClientName = (name, slot) => {
        let iconSrc = slot === 'afternoon' ? "/icon-afternoon.svg" : "/icon-morning.svg";
        return (
            <div style={{display: 'flex', alignItems: 'center'}}>
                <img src={iconSrc} alt={slot} style={{width: '18px', height: '18px', marginRight: '8px', opacity: 0.8}} />
                <span style={{fontFamily: "'Oswald', sans-serif", fontSize: '1.05em', color: COLORS.DARK}}>{name}</span>
            </div>
        );
    };
    const getStepColor = (index, total) => {
        if (index === 0) return COLORS.GREEN; if (index === total - 1) return COLORS.RED; return COLORS.BLUE;
    };

    // --- LOGIN VIEW ---
    if (!token) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: COLORS.DARK, color: 'white', fontFamily: "'Inter', sans-serif" }}>
            <div style={{ background: 'white', padding: '40px', borderRadius: '12px', width: '90%', maxWidth: '400px', color: COLORS.DARK, textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                <img src="/logo-truck.svg" alt="Logo" style={{ height: '50px', marginBottom: '20px' }} />
                <h2 style={{ margin: '0 0 20px 0', fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>{isLoginView ? "Connexion Pro" : "Créer un compte"}</h2>
                {authError && <div style={{ color: COLORS.RED, marginBottom: '15px', fontSize: '14px', fontWeight:'bold' }}>⚠️ {authError}</div>}
                <form onSubmit={handleAuth}>
                    {!isLoginView && <input type="text" placeholder="Nom de l'entreprise" required value={authCompany} onChange={e => setAuthCompany(e.target.value)} style={inputStyle} />}
                    <input type="email" placeholder="Email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} style={inputStyle} />
                    <input type="password" placeholder="Mot de passe" required value={authPass} onChange={e => setAuthPass(e.target.value)} style={inputStyle} />
                    <button type="submit" disabled={authLoading} style={submitButtonStyle}>{authLoading ? "..." : (isLoginView ? "SE CONNECTER" : "S'INSCRIRE")}</button>
                </form>
                <p style={{ marginTop: '20px', fontSize: '14px', color: COLORS.GRAY_TEXT, cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setIsLoginView(!isLoginView)}>{isLoginView ? "Pas encore de compte ?" : "Déjà un compte ?"}</p>
            </div>
        </div>
    );

    // --- APP VIEW ---
    return (
        <div style={rootContainerStyle(isMobileView)}>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Oswald:wght@500;700&display=swap'); .leaflet-control-attribution { display: none !important; } .leaflet-div-icon { background: transparent; border: none; } @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            
            {/* --- NOTIFICATION TOAST (DISCRET) --- */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)',
                    backgroundColor: toast.type === 'success' ? COLORS.DARK : COLORS.RED, color: 'white',
                    padding: '12px 24px', borderRadius: PILL_RADIUS, boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
                    zIndex: 99999, fontFamily: "'Inter', sans-serif", fontWeight: '600', fontSize: '14px',
                    display: 'flex', alignItems: 'center', animation: 'fadeIn 0.3s ease-out'
                }}>
                    {toast.type === 'success' && <span style={{marginRight:'10px'}}>✅</span>}
                    {toast.message}
                </div>
            )}

            {/* --- MODAL SUCCÈS TECHNICIEN --- */}
            {showTechSuccessModal && (
                <div style={modalOverlayStyle} onClick={() => setShowTechSuccessModal(false)}>
                    <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                        <div style={{fontSize:'40px', marginBottom:'10px'}}>🎉</div>
                        <h3 style={modalTitleStyle}>TECHNICIEN AJOUTÉ</h3>
                        <p style={{fontFamily:"'Inter', sans-serif", color:COLORS.GRAY_TEXT}}>Votre équipe s'agrandit ! Il est prêt à recevoir des missions.</p>
                        <button onClick={() => setShowTechSuccessModal(false)} style={submitButtonStyle}>PARFAIT</button>
                    </div>
                </div>
            )}

            {/* --- MODAL EQUIPE --- */}
            {showTeamModal && (
                <div style={modalOverlayStyle} onClick={() => setShowTeamModal(false)}>
                    <div style={{...modalContentStyle, maxWidth:'400px'}} onClick={e => e.stopPropagation()}>
                        <h3 style={modalTitleStyle}>MON ÉQUIPE</h3>
                        <div style={{maxHeight: '150px', overflowY: 'auto', marginBottom: '20px', textAlign:'left', border: `1px solid ${COLORS.BORDER}`, borderRadius: STANDARD_RADIUS}}>
                            {technicians.map(t => (
                                <div key={t.id} style={{display:'flex', justifyContent:'space-between', padding:'10px', borderBottom:`1px solid ${COLORS.BORDER}`, backgroundColor: '#fafafa'}}>
                                    <div><div style={{fontWeight:'bold', color: COLORS.DARK, fontFamily: "'Oswald', sans-serif"}}>{t.name}</div><div style={{fontSize:'12px', color: COLORS.GRAY_TEXT}}>{t.address}</div></div>
                                    <button onClick={() => handleDeleteTech(t.id)} style={{background:'transparent', border:'none', color: COLORS.RED, cursor:'pointer'}}>✕</button>
                                </div>
                            ))}
                        </div>
                        <form onSubmit={handleAddTech}>
                            <input type="text" placeholder="Nom (ex: Paul)" value={newTechName} onChange={(e) => setNewTechName(e.target.value)} style={inputStyle} />
                            <input type="text" placeholder="Départ (Adresse)..." value={newTechAddress} onChange={(e) => setNewTechAddress(e.target.value)} style={inputStyle} />
                            <button type="submit" disabled={isAddingTech} style={{...submitButtonStyle, marginTop: '5px'}}>
                                {isAddingTech ? "AJOUT EN COURS..." : "AJOUTER"}
                            </button>
                        </form>
                        <button onClick={() => setShowTeamModal(false)} style={cancelButtonStyle}>FERMER</button>
                    </div>
                </div>
            )}

            {/* --- MODAL NAVIGATION --- */}
            {navModal && (<div style={modalOverlayStyle} onClick={() => setNavModal(null)}><div style={modalContentStyle} onClick={e => e.stopPropagation()}><h3 style={modalTitleStyle}>NAVIGATION</h3><div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}><a href={`https://waze.com/ul?ll=${navModal.lat},${navModal.lng}&navigate=yes`} target="_blank" rel="noreferrer" style={gpsLinkStyle}><img src="/waze.png" alt="W" style={gpsIconStyle}/>Waze</a><a href={`http://maps.google.com/maps?q=${navModal.lat},${navModal.lng}`} target="_blank" rel="noreferrer" style={gpsLinkStyle}><img src="/google.png" alt="G" style={gpsIconStyle}/>Google Maps</a></div><button onClick={() => setNavModal(null)} style={cancelButtonStyle}>FERMER</button></div></div>)}

            {/* --- MODAL RESET --- */}
            {showResetModal && (<div style={modalOverlayStyle} onClick={() => !resetLoading && setShowResetModal(false)}><div style={modalContentStyle} onClick={e => e.stopPropagation()}><h3 style={{...modalTitleStyle, color: '#d32f2f'}}>CONFIRMATION</h3><p style={{fontFamily:"'Inter', sans-serif"}}>Tout effacer ?</p><div style={{display:'flex', gap:'10px'}}><button onClick={()=>setShowResetModal(false)} style={{...gpsLinkStyle, justifyContent:'center', background:'white'}}>NON</button><button onClick={confirmReset} style={{...gpsLinkStyle, justifyContent:'center', background:COLORS.DARK, color:'white'}}>{resetLoading ? "..." : "OUI"}</button></div></div></div>)}

            {/* --- MAIN LAYOUT --- */}
            <div style={mapContainerStyle(isMobileView)}>
                <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                    {technicians.map(t => (<Marker key={`tech-${t.id}`} position={[parseFloat(t.start_lat), parseFloat(t.start_lng)]}><Popup>🏠 {t.name}</Popup></Marker>))}
                    {route.map((step, index) => (<Marker key={index} position={[step.lat, step.lng]} icon={createCustomIcon(index, route.length)}><Popup><strong>#{step.step}</strong> {step.client}</Popup></Marker>))}
                    {routePath.length > 0 && <Polyline positions={routePath} color={COLORS.BLUE} weight={5} opacity={0.8} />}
                </MapContainer>
            </div>

            <div style={panelContainerStyle(isMobileView)}>
                <div style={panelHeaderStyle}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                        <div style={{display:'flex', alignItems:'center'}}>
                            <img src="/logo-truck.svg" alt="Logo" style={{height: '36px', marginRight: '15px'}} />
                            <div><h2 style={{margin: 0, color: COLORS.DARK, fontSize: '1.8em', fontFamily: "'Oswald', sans-serif", fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px'}}>OptiRoute <span style={proTagStyle}>PRO</span></h2><div style={{fontSize: '12px', color: COLORS.GRAY_TEXT, marginTop: '2px'}}>{userCompany}</div></div>
                        </div>
                        <button onClick={handleLogout} style={{background: 'transparent', border: 'none', color: COLORS.RED, cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', textDecoration:'underline'}}>Déconnexion</button>
                    </div>
                </div>

                <div style={cardStyle}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                        <div style={{display: 'flex', alignItems: 'center'}}><img src="/icon-plus.svg" alt="+" style={{width:'18px', marginRight:'10px'}} /><h4 style={{margin:0, color: COLORS.DARK, fontSize: '1.1em', fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', letterSpacing: '0.5px'}}>TRAJETS</h4></div>
                        <button onClick={() => setShowTeamModal(true)} style={{background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px', color: COLORS.BLUE, fontFamily: "'Inter', sans-serif", fontWeight: '600', textDecoration: 'underline'}}>👥 Gérer l'équipe</button>
                    </div>
                    
                    <p style={helpTextStyle}>Nouvelle mission pour votre équipe :</p>

                    <form onSubmit={handleAddMission}>
                        <input type="text" placeholder="Nom du client..." value={newName} onChange={(e) => setNewName(e.target.value)} style={inputStyle} />
                        <input type="text" placeholder="Adresse complète (ex: 10 rue de la Paix, Paris)..." value={newAddress} onChange={(e) => setNewAddress(e.target.value)} style={inputStyle} />
                        
                        <div style={{display:'flex', gap:'10px', marginBottom:'15px', alignItems:'flex-end'}}>
                            <div style={{position: 'relative', flex: 1, userSelect: 'none'}}>
                                <label style={{fontSize:'11px', fontWeight:'bold', color:COLORS.GRAY_TEXT, display:'block', marginBottom:'4px'}}>CRÉNEAU</label>
                                <div onClick={() => setIsDropdownOpen(!isDropdownOpen)} style={{...inputStyle, display: 'flex', alignItems: 'center', cursor: 'pointer', position: 'relative', marginBottom:0}}>
                                    <img src={timeSlot === 'morning' ? '/icon-morning.svg' : '/icon-afternoon.svg'} alt="icon" style={{width: '20px', height: '20px', marginRight: '12px'}} />
                                    <span style={{flex: 1, fontSize:'13px'}}>{timeSlot === 'morning' ? 'Matin' : 'Après-midi'}</span>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={COLORS.DARK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s'}}><path d="M6 9l6 6 6-6" /></svg>
                                </div>
                                {isDropdownOpen && (
                                    <div style={{position: 'absolute', top: '110%', left: 0, right: 0, backgroundColor: COLORS.WHITE, border: `1px solid ${COLORS.DARK}`, borderRadius: '20px', zIndex: 100, boxShadow: '0 10px 30px rgba(0,0,0,0.15)', overflow: 'hidden', padding: '5px'}}>
                                        <div onClick={() => { setTimeSlot('morning'); setIsDropdownOpen(false); }} style={dropdownItemStyle}><img src="/icon-morning.svg" alt="M" style={{width: '20px', marginRight: '10px'}} />Matin</div>
                                        <div style={{height: '1px', background: '#eee', margin: '0 10px'}}></div>
                                        <div onClick={() => { setTimeSlot('afternoon'); setIsDropdownOpen(false); }} style={dropdownItemStyle}><img src="/icon-afternoon.svg" alt="A" style={{width: '20px', marginRight: '10px'}} />Après-midi</div>
                                    </div>
                                )}
                            </div>

                            <div style={{width: '90px'}}>
                                <label style={{fontSize:'11px', fontWeight:'bold', color:COLORS.GRAY_TEXT, display:'block', marginBottom:'4px'}}>DURÉE</label>
                                <div style={{position:'relative'}}>
                                    <input type="number" min="5" step="5" value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 30)} style={{...inputStyle, textAlign:'center', marginBottom:0, paddingRight:'30px'}} />
                                    <span style={{position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', fontSize:'11px', color:COLORS.GRAY_TEXT, fontWeight:'bold'}}>min</span>
                                </div>
                            </div>
                        </div>
                        <div style={{fontSize:'11px', color:COLORS.GRAY_TEXT, fontStyle:'italic', marginBottom:'15px', textAlign:'right'}}>ℹ️ Temps estimé sur place</div>

                        <button type="submit" disabled={isAddingMission} style={{...submitButtonStyle, opacity: isAddingMission ? 0.7 : 1}}>
                            {isAddingMission ? "AJOUT..." : "ENREGISTRER LA MISSION"}
                        </button>
                    </form>
                </div>

                {/* --- RECAPITULATIF INTELLIGENT --- */}
                {pendingMissions.length > 0 && (
                    <div style={{marginBottom: '20px', border: `1px dashed ${COLORS.BLUE}`, borderRadius: STANDARD_RADIUS, padding: '15px', backgroundColor: '#e3f2fd'}}>
                         <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
                            <h5 style={{margin:0, color:COLORS.BLUE, fontFamily:"'Oswald', sans-serif"}}>EN ATTENTE ({pendingMissions.length})</h5>
                            <div style={{fontSize:'10px', color:COLORS.BLUE, fontWeight:'bold'}}>Non optimisé</div>
                         </div>
                         <div style={{maxHeight:'100px', overflowY:'auto'}}>
                            {pendingMissions.map((pm, idx) => (
                                <div key={idx} style={{fontSize:'12px', marginBottom:'4px', display:'flex', alignItems:'center'}}>
                                    <div style={{width:'6px', height:'6px', borderRadius:'50%', background:COLORS.BLUE, marginRight:'8px'}}></div>
                                    <span style={{fontWeight:'bold', marginRight:'5px'}}>{pm.name}</span> 
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
                                    <span style={{fontSize: '24px'}}>⚙️</span>
                                    <span style={{fontSize: '12px', color: COLORS.BLUE, fontWeight: 'bold', fontFamily: "'Oswald', sans-serif", marginTop:'5px'}}>CALCUL IA...</span> 
                                </div>
                             ) : (
                                 <div style={{position:'relative'}}>
                                     <img src="/logo-truck.svg" alt="Optimize" style={{ width:'100px', height:'auto' }} />
                                     {pendingMissions.length > 0 && <div style={{position:'absolute', top:'-5px', right:'-5px', background:COLORS.RED, color:'white', borderRadius:'50%', width:'20px', height:'20px', fontSize:'12px', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'bold', border:'2px solid white'}}>{pendingMissions.length}</div>}
                                 </div>
                             )}
                        </button>
                        <button onClick={()=>setShowResetModal(true)} style={resetButtonStyle}>
                            <img src="/icon-trash.svg" alt="Reset" style={{width:'28px'}} />
                        </button>
                    </div>
                    <p style={{...helpTextStyle, textAlign: 'center', marginTop: '15px', marginBottom: '0', width: '100%', maxWidth:'250px'}}>
                        Cliquez sur le camion pour lancer l'optimisation.
                    </p>
                </div>

                <div style={{...cardStyle, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
                    <h4 style={{...cardTitleStyle, marginBottom: '5px', fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', fontSize: '1em', letterSpacing: '1px'}}>FEUILLE DE ROUTE</h4>
                    <div style={missionsListStyle}>
                        {route.length === 0 ? (
                            <div style={{padding: '30px', textAlign: 'center', color: COLORS.DARK, border: `1px dashed ${COLORS.DARK}`, fontSize: '0.9em', fontFamily: "'Inter', sans-serif", borderRadius: STANDARD_RADIUS}}>
                                <span style={{fontSize: '40px', marginBottom: '10px', display:'block'}}>👋</span>
                                <h3 style={{margin: '0 0 10px 0', color: COLORS.DARK, fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', letterSpacing: '1px'}}>Prêt à rouler ?</h3>
                                <p style={{margin: 0, fontFamily: "'Inter', sans-serif", fontSize: '14px', maxWidth: '100%'}}>Ajoutez vos missions ci-dessus.</p>
                            </div>
                        ) : (
                            route.map((step, index) => {
                                const stepColor = getStepColor(index, route.length);
                                return (
                                    <div key={index} style={missionItemStyle}>
                                        <div style={{backgroundColor: stepColor, color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontFamily: "'Inter', sans-serif", marginRight: '15px', boxShadow: '0 2px 5px rgba(0,0,0,0.15)', flexShrink: 0}}>{step.step}</div>
                                        <div style={missionInfoStyle}>
                                            <div style={missionTitleStyle}>{renderClientName(step.client, step.time_slot)}</div>
                                            <div style={missionAddressStyle}>{step.address.substring(0, 40)}...</div>
                                            <div style={{fontSize: '11px', color: COLORS.BLUE, marginTop: '4px', fontWeight: '600', fontFamily: "'Inter', sans-serif"}}>{step.technician_name ? `🚛 ${step.technician_name} • ` : ''}📍 {step.distance_km} km</div>
                                        </div>
                                        <button onClick={() => setNavModal({lat: step.lat, lng: step.lng})} style={compassButtonStyle}><img src="/icon-navigation.svg" alt="GPS" style={{width:'20px'}} /></button>
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

// --- STYLES COMPLÉMENTAIRES ---
const helpTextStyle = { color: COLORS.GRAY_TEXT, fontSize: '12px', fontFamily: "'Inter', sans-serif", fontStyle: 'italic', marginTop: '-5px', marginBottom: '15px', lineHeight: '1.4' };
const rootContainerStyle = (isMobile) => ({ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: isMobile ? 'auto' : '100vh', minHeight: '100vh', fontFamily: "'Inter', sans-serif", backgroundColor: '#f0f0f1', overflow: isMobile ? 'auto' : 'hidden' });
const mapContainerStyle = (isMobile) => ({ flex: isMobile ? 'none' : 1, height: isMobile ? '40vh' : '100%', order: isMobile ? 1 : 2, borderLeft: isMobile ? 'none' : `1px solid ${COLORS.DARK}`, zIndex: 0 });
const panelContainerStyle = (isMobile) => ({ width: isMobile ? '100%' : '450px', height: isMobile ? 'auto' : '100%', minHeight: isMobile ? '60vh' : '100%', backgroundColor: 'rgba(255, 255, 255, 0.75)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', padding: '25px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', order: isMobile ? 2 : 1, zIndex: 1000, borderTop: isMobile ? `2px solid ${COLORS.DARK}` : 'none' });
const panelHeaderStyle = { marginBottom: '25px', paddingBottom: '20px', borderBottom: `2px solid ${COLORS.DARK}` };
const proTagStyle = { fontSize: '0.4em', backgroundColor: COLORS.BLUE, color: COLORS.WHITE, padding: '2px 6px', verticalAlign: 'top', marginLeft: '8px', fontFamily: "'Inter', sans-serif", fontWeight: '600', borderRadius: STANDARD_RADIUS };
const cardStyle = { marginBottom: '25px' };
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
const missionAddressStyle = { color: '#555', fontSize: '13px', marginTop: '4px', fontFamily: "'Inter', sans-serif" };
const compassButtonStyle = { backgroundColor: COLORS.WHITE, border: `1px solid ${COLORS.DARK}`, borderRadius: STANDARD_RADIUS, width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(59, 70, 81, 0.95)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const modalContentStyle = { background: COLORS.WHITE, padding: '35px', borderRadius: STANDARD_RADIUS, width: '90%', maxWidth: '350px', textAlign: 'center', border: `4px solid ${COLORS.BLUE}`, boxSizing: 'border-box' };
const modalTitleStyle = { marginTop: 0, marginBottom: '25px', color: COLORS.DARK, fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', fontSize: '1.4em', letterSpacing: '1px' };
const gpsLinkStyle = { display: 'flex', alignItems: 'center', width: '100%', padding: '18px', backgroundColor: '#f8f9fa', color: COLORS.DARK, textDecoration: 'none', borderRadius: STANDARD_RADIUS, border: `1px solid ${COLORS.DARK}`, fontWeight: '700', fontSize: '15px', fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', letterSpacing: '0.5px', boxSizing: 'border-box' };
const gpsIconStyle = { width: '26px', height: '26px', objectFit: 'contain', marginRight: '18px' };
const cancelButtonStyle = { marginTop: '25px', padding: '14px', width: '100%', border: 'none', background: COLORS.DARK, color: COLORS.WHITE, fontWeight:'700', cursor: 'pointer', borderRadius: STANDARD_RADIUS, fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', letterSpacing: '1px' };

export default App;