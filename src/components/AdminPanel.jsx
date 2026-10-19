import React, { useState, useEffect, useMemo } from 'react';
import { db, auth, authSecondary } from '../firebase';
import { createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, arrayUnion, arrayRemove, onSnapshot } from 'firebase/firestore';
import {
    ArrowLeft, Trash2, ShieldAlert, Building2, User, Stethoscope, Users,
    UserPlus, RotateCcw, XCircle, Search, X, Edit2, Check, Copy, Mail, CheckCircle2, MapPin, Palette
} from 'lucide-react';
import { DEFAULT_RESIDENTS, DOCTORS, LOCATIONS } from '../constants';
import { normalizeText, USER_COLORS, ROLE_OPTIONS, getMemberProfile, computeMarchPromotion, buildGuardCycleABCD } from '../utils';

export default function AdminPanel({ onClose, onOpenRotation }) {
    const [authOk, setAuthOk] = useState(false);
    const [adminUser, setAdminUser] = useState('');
    const [adminPass, setAdminPass] = useState('');
    const [activeTab, setActiveTab] = useState('residentes');

    const [residents, setResidents] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [locations, setLocations] = useState([]);
    const [knownUsers, setKnownUsers] = useState([]);
    const [bannedUsers, setBannedUsers] = useState([]);
    const [settingsMeta, setSettingsMeta] = useState({ profiles: {}, hzhRotation: {} });

    // Formulario nuevo usuario (por defecto inicia como R2 Azul)
    const [newUserDisplayName, setNewUserDisplayName] = useState('');
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPass, setNewUserPass] = useState('');
    const [newUserRole, setNewUserRole] = useState('r2');
    const [newUserColor, setNewUserColor] = useState('blue');
    const [lastCreatedCreds, setLastCreatedCreds] = useState(null);

    // Catálogos: nuevo item, jerarquía/color al añadir residente (por defecto R2 Azul), búsqueda y edición
    const [newItem, setNewItem] = useState('');
    const [newResRole, setNewResRole] = useState('r2');
    const [newResColor, setNewResColor] = useState('blue');
    const [catalogSearch, setCatalogSearch] = useState('');
    const [editingItem, setEditingItem] = useState(null);
    const [editValue, setEditValue] = useState('');

    // Usuarios: búsqueda y filtro
    const [userSearch, setUserSearch] = useState('');
    const [userFilter, setUserFilter] = useState('all'); // 'all' | 'active' | 'banned'

    const [msg, setMsg] = useState({ text: '', type: '' });

    const showMsg = (text, type = 'success') => {
        setMsg({ text, type });
        setTimeout(() => setMsg({ text: '', type: '' }), 5000);
    };

    const handleLogin = (e) => {
        e.preventDefault();
        if (adminUser === 'ADMIN' && adminPass === '4424671630') setAuthOk(true);
        else showMsg("Credenciales incorrectas", "error");
    };

    useEffect(() => {
        if (authOk) {
            const unsub = onSnapshot(doc(db, 'metadata', 'settings'), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setResidents(data.residents ? [...data.residents].sort() : DEFAULT_RESIDENTS);
                    setDoctors(data.doctors ? [...data.doctors].sort() : DOCTORS);
                    setLocations(data.locations ? [...data.locations].sort() : LOCATIONS);
                    setKnownUsers(data.knownUsers ? [...data.knownUsers].sort() : []);
                    setBannedUsers(data.bannedUsers || []);
                    setSettingsMeta({
                        profiles: data.profiles || {},
                        hzhRotation: data.hzhRotation || {},
                        lastPromotionYear: data.lastPromotionYear
                    });
                }
            }, (error) => {
                showMsg("Error conectando a Firebase: " + error.message, "error");
            });
            return () => unsub();
        }
    }, [authOk]);

    // Guardar o actualizar perfil (jerarquía, color, nombre) en metadata/settings.profiles
    const updateMemberProfile = async (keyOrName, updates, alsoSyncCatalog = true) => {
        const key = normalizeText(keyOrName);
        if (!key) return;
        const currentProfiles = { ...(settingsMeta.profiles || {}) };
        const existing = currentProfiles[key] || getMemberProfile(keyOrName, settingsMeta);
        const targetRole = updates.role !== undefined ? updates.role : (existing.role || 'r2');
        const roleDef = ROLE_OPTIONS.find(r => r.id === targetRole);
        const merged = {
            name: updates.name !== undefined ? updates.name : (existing.name || keyOrName),
            email: updates.email !== undefined ? updates.email : (existing.email || ''),
            role: targetRole,
            color: updates.color !== undefined
                ? updates.color
                : (updates.role !== undefined && roleDef?.defaultColor ? roleDef.defaultColor : (existing.colorId || roleDef?.defaultColor || 'blue'))
        };
        currentProfiles[key] = merged;

        // Si también tiene nombre distinto al email prefix, sincronizar ambas llaves para homologación total
        if (merged.name) {
            const nameKey = normalizeText(merged.name);
            if (nameKey && nameKey !== key) {
                currentProfiles[nameKey] = { ...currentProfiles[nameKey], ...merged };
            }
        }

        const payload = { profiles: currentProfiles };
        const isExcludedFromResidents = targetRole === 'profesor' || targetRole === 'adscrito' || targetRole === 'ext';

        // Si se marca como 'profesor' o 'ext' (Ex-Residente), asegurarnos de que NO salga en el dropdown de residentes
        if (alsoSyncCatalog && isExcludedFromResidents) {
            const matchingRes = residents.filter(r =>
                normalizeText(r) === key ||
                (merged.name && normalizeText(r) === normalizeText(merged.name))
            );
            if (matchingRes.length > 0) {
                payload.residents = residents.filter(r => !matchingRes.includes(r));
            }
        } else if (alsoSyncCatalog && updates.role && !isExcludedFromResidents && merged.name) {
            // Si es residente activo (R5, R4, R3, R2) y tiene nombre corto limpio, asegurar que esté en el catálogo de residentes
            const cleanName = merged.name.includes('@') ? '' : (merged.name.charAt(0).toUpperCase() + merged.name.slice(1).toLowerCase());
            if (cleanName && !residents.some(r => normalizeText(r) === normalizeText(cleanName))) {
                payload.residents = [...residents, cleanName].sort();
            }
        }

        try {
            await setDoc(doc(db, 'metadata', 'settings'), payload, { merge: true });
            showMsg(`Perfil de "${merged.name || keyOrName}" actualizado.`);
        } catch (err) {
            showMsg("Error guardando perfil: " + err.message, "error");
        }
    };

    // Ejecutar promoción anual de ciclo (1 de Marzo: R5->EXT, R4->R5, R3->R4, R2->R3)
    const handleMarchPromotionManual = async () => {
        if (!confirm('¿Ejecutar promoción anual de ciclo académico?\n\n• R5 → EXT (Ex-Residente, sale de selectores)\n• R4 → R5 (Dorado)\n• R3 → R4 (Plata)\n• R2 → R3 (Bronce)')) return;
        try {
            const { nextProfiles, nextResidents } = computeMarchPromotion(settingsMeta.profiles, residents);
            await setDoc(doc(db, 'metadata', 'settings'), {
                profiles: nextProfiles,
                residents: nextResidents,
                lastPromotionYear: new Date().getFullYear()
            }, { merge: true });
            showMsg('Promoción anual aplicada: R5→EXT, R4→R5, R3→R4, R2→R3.');
        } catch (err) {
            showMsg('Error en promoción anual: ' + err.message, 'error');
        }
    };

    // Alternar si un residente está rotando este mes en Zambrano (HZH)
    const toggleResidentHzh = async (resName) => {
        const currentRot = settingsMeta.hzhRotation || {};
        const currentList = currentRot.residents || [];
        const exists = currentList.some(r => normalizeText(r) === normalizeText(resName));
        const nextList = exists
            ? currentList.filter(r => normalizeText(r) !== normalizeText(resName))
            : [...currentList, resName];
        const nextCycle = buildGuardCycleABCD(nextList, settingsMeta, currentRot.cycleOrder || []);

        try {
            await setDoc(doc(db, 'metadata', 'settings'), {
                hzhRotation: {
                    ...currentRot,
                    residents: nextList,
                    cycleOrder: nextCycle
                }
            }, { merge: true });
            showMsg(exists ? `${resName} quitado de rotación HZH` : `📍 ${resName} marcado rotando en HZH`);
        } catch (err) {
            showMsg("Error actualizando rotación HZH: " + err.message, "error");
        }
    };

    const switchTab = (tab) => {
        setActiveTab(tab);
        setCatalogSearch('');
        setEditingItem(null);
        setEditValue('');
        setNewItem('');
    };

    const getFieldForTab = (tab = activeTab) => {
        if (tab === 'residentes') return 'residents';
        if (tab === 'doctores') return 'doctors';
        if (tab === 'hospitales') return 'locations';
        return '';
    };

    const currentList = activeTab === 'residentes' ? residents : activeTab === 'doctores' ? doctors : locations;

    const filteredCatalog = useMemo(() => {
        const q = normalizeText(catalogSearch);
        let list = currentList;
        if (q) {
            list = currentList.filter(item => normalizeText(item).includes(q));
        }
        if (activeTab === 'residentes') {
            return [...list].sort((a, b) => {
                const pa = getMemberProfile(a, settingsMeta);
                const pb = getMemberProfile(b, settingsMeta);
                if (pa.inHzh !== pb.inHzh) return pa.inHzh ? -1 : 1;
                if (pa.rank !== pb.rank) return pa.rank - pb.rank;
                return a.localeCompare(b);
            });
        }
        return list;
    }, [currentList, catalogSearch, activeTab, settingsMeta]);

    const handleAddItem = async (e) => {
        e.preventDefault();
        if (!newItem.trim()) return;
        const formatted = newItem.trim();
        const field = getFieldForTab();
        if (!field) return;

        const exists = currentList.some(item => normalizeText(item) === normalizeText(formatted));
        if (exists) {
            return showMsg(`"${formatted}" ya existe en la lista.`, "error");
        }

        try {
            const payload = { [field]: arrayUnion(formatted) };
            if (activeTab === 'residentes') {
                const key = normalizeText(formatted);
                payload.profiles = {
                    ...(settingsMeta.profiles || {}),
                    [key]: {
                        name: formatted,
                        role: newResRole,
                        color: newResColor
                    }
                };
            }
            await setDoc(doc(db, 'metadata', 'settings'), payload, { merge: true });
            setNewItem('');
            showMsg(`"${formatted}" agregado correctamente.`);
        } catch (err) {
            showMsg("Error: " + err.message, "error");
        }
    };

    const handleRemoveItem = async (item) => {
        if (!confirm(`¿Seguro que deseas eliminar a "${item}" de la lista de opciones?`)) return;
        const field = getFieldForTab();

        try {
            await setDoc(doc(db, 'metadata', 'settings'), { [field]: arrayRemove(item) }, { merge: true });
            showMsg(`"${item}" eliminado correctamente.`);
        } catch (err) {
            showMsg("Error: " + err.message, "error");
        }
    };

    const startEditItem = (item) => {
        setEditingItem(item);
        setEditValue(item);
    };

    const handleSaveEditItem = async (oldItem) => {
        const trimmed = editValue.trim();
        if (!trimmed || trimmed === oldItem) {
            setEditingItem(null);
            return;
        }
        const field = getFieldForTab();
        const updatedArray = currentList.map(x => x === oldItem ? trimmed : x).sort();

        try {
            await setDoc(doc(db, 'metadata', 'settings'), { [field]: updatedArray }, { merge: true });
            setEditingItem(null);
            showMsg(`Actualizado: "${oldItem}" → "${trimmed}"`);
        } catch (err) {
            showMsg("Error al editar: " + err.message, "error");
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        if (!newUserEmail || !newUserPass || !newUserDisplayName) return;

        const email = newUserEmail.includes('@') ? newUserEmail.trim().toLowerCase() : newUserEmail.trim().toUpperCase() + "@rounds.app";
        const displayNameUpper = newUserDisplayName.trim().toUpperCase();
        const residentFormatted = newUserDisplayName.trim().charAt(0).toUpperCase() + newUserDisplayName.trim().slice(1).toLowerCase();
        const roleObj = ROLE_OPTIONS.find(r => r.id === newUserRole);
        const isResidentRole = roleObj ? roleObj.isResident : true;

        try {
            const userCred = await createUserWithEmailAndPassword(authSecondary, email, newUserPass);
            await updateProfile(userCred.user, { displayName: displayNameUpper });

            const emailPrefixKey = normalizeText(email.split('@')[0]);
            const nameKey = normalizeText(residentFormatted);
            const profileData = {
                name: residentFormatted,
                email,
                role: newUserRole,
                color: newUserColor
            };

            const nextProfiles = {
                ...(settingsMeta.profiles || {}),
                [emailPrefixKey]: profileData,
                [nameKey]: profileData
            };

            const updatePayload = {
                knownUsers: arrayUnion(email),
                profiles: nextProfiles
            };

            // Solo agregar a la lista de residentes si NO es Adscrito / Maestro
            if (isResidentRole) {
                updatePayload.residents = arrayUnion(residentFormatted);
            } else {
                // Si existía por error en residentes, quitarlo
                updatePayload.residents = arrayRemove(residentFormatted);
            }

            await setDoc(doc(db, 'metadata', 'settings'), updatePayload, { merge: true });
            setLastCreatedCreds({
                name: displayNameUpper,
                email,
                pass: newUserPass,
                roleLabel: roleObj?.label || ''
            });
            showMsg(`Usuario ${displayNameUpper} (${roleObj?.short || ''}) creado exitosamente.`);
            setNewUserEmail('');
            setNewUserPass('');
            setNewUserDisplayName('');
        } catch (err) {
            showMsg("Error al crear: " + err.message, "error");
        }
    };

    const copyCredentialsWA = () => {
        if (!lastCreatedCreds) return;
        const text = `🏥 *Acceso Urología TecSalud*\n👤 Usuario/Firma: *${lastCreatedCreds.name}* (${lastCreatedCreds.roleLabel})\n📧 Correo: *${lastCreatedCreds.email}*\n🔑 Contraseña: *${lastCreatedCreds.pass}*`;
        navigator.clipboard.writeText(text);
        showMsg("Credenciales copiadas al portapapeles para WhatsApp.");
    };

    const handleSendResetEmail = async (email) => {
        if (email.endsWith('@rounds.app')) {
            return showMsg("Esta cuenta usa un alias interno (@rounds.app) y no recibe correos externos.", "error");
        }
        if (!confirm(`¿Enviar correo de restablecimiento de contraseña a ${email}?`)) return;
        try {
            await sendPasswordResetEmail(auth, email);
            showMsg(`Enlace de recuperación enviado a ${email}`);
        } catch (err) {
            showMsg("Error enviando correo: " + err.message, "error");
        }
    };

    const toggleBanStatus = async (email, isBanned) => {
        try {
            if (isBanned) {
                await setDoc(doc(db, 'metadata', 'settings'), { bannedUsers: arrayRemove(email) }, { merge: true });
                showMsg(`Acceso restaurado para ${email}`);
            } else {
                if (!confirm(`¿Revocar acceso a ${email}? El sistema lo expulsará inmediatamente.`)) return;
                await setDoc(doc(db, 'metadata', 'settings'), { bannedUsers: arrayUnion(email) }, { merge: true });
                showMsg(`Acceso bloqueado para ${email}`, "error");
            }
        } catch (err) {
            showMsg("Error: " + err.message, "error");
        }
    };

    const userStats = useMemo(() => {
        const total = knownUsers.length;
        const banned = knownUsers.filter(u => bannedUsers.includes(u)).length;
        const active = total - banned;
        return { total, active, banned };
    }, [knownUsers, bannedUsers]);

    const filteredUsers = useMemo(() => {
        const q = normalizeText(userSearch);
        return knownUsers.filter(u => {
            const isBanned = bannedUsers.includes(u);
            if (userFilter === 'active' && isBanned) return false;
            if (userFilter === 'banned' && !isBanned) return false;
            const prof = getMemberProfile(u, settingsMeta);
            if (q && !normalizeText(`${u} ${prof.name} ${prof.roleLabel}`).includes(q)) return false;
            return true;
        });
    }, [knownUsers, bannedUsers, userSearch, userFilter, settingsMeta]);

    const inputClass = "w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500";

    if (!authOk) {
        return (
            <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-sm border-t-4 border-red-600">
                    <button onClick={onClose} className="mb-4 text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center gap-1 text-xs font-bold"><ArrowLeft size={18}/> Volver</button>
                    <h2 className="text-xl font-black text-center mb-2 text-slate-900 dark:text-white flex justify-center items-center gap-2"><ShieldAlert className="text-red-600"/> Panel de Administración</h2>
                    <p className="text-xs text-center text-gray-500 dark:text-slate-400 mb-6">Urología TecSalud • Control de Catálogos, Jerarquías y Accesos</p>
                    {msg.text && <div className="bg-red-100 text-red-700 p-2.5 rounded-lg text-xs font-bold mb-4">{msg.text}</div>}
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input placeholder="Usuario Admin" className={inputClass} value={adminUser} onChange={e=>setAdminUser(e.target.value.toUpperCase())} required />
                        <input type="password" placeholder="Clave Maestra" className={inputClass} value={adminPass} onChange={e=>setAdminPass(e.target.value)} required />
                        <button className="w-full bg-red-600 text-white font-bold py-3 rounded-lg shadow hover:bg-red-700 transition">Desbloquear Panel</button>
                    </form>
                </div>
            </div>
        );
    }

    const tabMeta = {
        residentes: { title: 'Catálogo de Residentes y Jerarquía', subtitle: 'Asigna rango (R2–R5), color distintivo y quiénes rotan en Zambrano (HZH). Promoción automática cada 1 de marzo.', placeholder: 'Ej. Patricio, Mariana...' },
        doctores: { title: 'Catálogo de Médicos Tratantes', subtitle: 'Urólogos y tratantes disponibles en los selectores.', placeholder: 'Ej. Dr. Olvera, Dra. Martínez...' },
        hospitales: { title: 'Catálogo de Hospitales y Sedes', subtitle: 'Sedes quirúrgicas y de hospitalización.', placeholder: 'Ej. HZH, San José, Instituto...' }
    };

    return (
        <div className="fixed inset-0 bg-gray-100 dark:bg-slate-900 text-slate-900 dark:text-white z-[100] overflow-y-auto p-3 sm:p-6 pb-24">
            <div className="max-w-4xl mx-auto pt-safe mt-2">
                {/* Cabecera del Dashboard */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-5 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-slate-700 rounded-full hover:bg-gray-200 dark:hover:bg-slate-600 transition" title="Cerrar Admin">
                            <ArrowLeft size={20}/>
                        </button>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <ShieldAlert className="text-red-600 dark:text-red-500" size={22}/> Administración UroTec
                            </h1>
                            <p className="text-xs text-gray-500 dark:text-slate-400">Homologación de Usuarios, Jerarquías, Colores y Rotación HZH</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={handleMarchPromotionManual}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition flex items-center gap-1 shadow-sm"
                            title="Se ejecuta automáticamente cada 1 de marzo (R5→EXT, R4→R5, R3→R4, R2→R3)"
                        >
                            🎓 Ciclo 1 Mar (R2→R5→EXT)
                        </button>
                        {onOpenRotation && (
                            <button
                                onClick={() => { onClose(); onOpenRotation(); }}
                                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition flex items-center gap-1 shadow-sm"
                            >
                                <MapPin size={14}/> Rol Mensual HZH / Guardias
                            </button>
                        )}
                        <button onClick={onClose} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200">
                            Salir
                        </button>
                    </div>
                </div>

                {msg.text && (
                    <div className={`p-3 rounded-xl mb-5 font-bold text-xs sm:text-sm shadow-sm flex items-center justify-between ${msg.type==='error'?'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 border-l-4 border-red-500':'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 border-l-4 border-emerald-500'}`}>
                        <span>{msg.text}</span>
                        <button onClick={() => setMsg({ text: '', type: '' })}><X size={16}/></button>
                    </div>
                )}

                {/* Pestañas con contadores */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
                    <button
                        onClick={() => switchTab('residentes')}
                        className={`p-3 font-bold rounded-xl shadow-sm flex items-center justify-between border transition ${activeTab==='residentes'?'bg-blue-600 text-white border-blue-600':'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50'}`}
                    >
                        <span className="flex items-center gap-2 text-xs sm:text-sm"><User size={16}/> Residentes</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-black ${activeTab==='residentes'?'bg-white/20 text-white':'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}`}>{residents.length}</span>
                    </button>

                    <button
                        onClick={() => switchTab('doctores')}
                        className={`p-3 font-bold rounded-xl shadow-sm flex items-center justify-between border transition ${activeTab==='doctores'?'bg-blue-600 text-white border-blue-600':'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50'}`}
                    >
                        <span className="flex items-center gap-2 text-xs sm:text-sm"><Stethoscope size={16}/> Doctores</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-black ${activeTab==='doctores'?'bg-white/20 text-white':'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}`}>{doctors.length}</span>
                    </button>

                    <button
                        onClick={() => switchTab('hospitales')}
                        className={`p-3 font-bold rounded-xl shadow-sm flex items-center justify-between border transition ${activeTab==='hospitales'?'bg-blue-600 text-white border-blue-600':'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50'}`}
                    >
                        <span className="flex items-center gap-2 text-xs sm:text-sm"><Building2 size={16}/> Hospitales</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-black ${activeTab==='hospitales'?'bg-white/20 text-white':'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}`}>{locations.length}</span>
                    </button>

                    <button
                        onClick={() => switchTab('usuarios')}
                        className={`p-3 font-bold rounded-xl shadow-sm flex items-center justify-between border transition ${activeTab==='usuarios'?'bg-red-600 text-white border-red-600':'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50'}`}
                    >
                        <span className="flex items-center gap-2 text-xs sm:text-sm"><Users size={16}/> Usuarios</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-black ${activeTab==='usuarios'?'bg-white/20 text-white':'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}`}>{userStats.active}</span>
                    </button>
                </div>

                {/* VISTA: GESTIÓN DE USUARIOS / ACCESOS Y JERARQUÍA */}
                {activeTab === 'usuarios' && (
                    <div className="space-y-6">
                        {/* Tarjeta Alta de Usuario Homologado */}
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
                            <h2 className="font-bold mb-1 flex items-center gap-2 text-base sm:text-lg text-slate-800 dark:text-white">
                                <UserPlus size={20} className="text-emerald-600"/> Alta Rápida de Usuario Homologado
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
                                Asigna su jerarquía (si es <strong>Adscrito / Maestro</strong> como Roberto, tendrá acceso completo pero <strong>nunca</strong> saldrá en el dropdown de residentes).
                            </p>
                            <form onSubmit={handleCreateUser} className="space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                    <div>
                                        <label className="text-[11px] font-bold text-gray-500 dark:text-slate-400 block mb-1">Nombre / Firma</label>
                                        <input required placeholder="Ej. ROBERTO o PATRICIO" className={`${inputClass} uppercase`} value={newUserDisplayName} onChange={e=>setNewUserDisplayName(e.target.value)}/>
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-bold text-gray-500 dark:text-slate-400 block mb-1">Correo Electrónico</label>
                                        <input required placeholder="usuario@tecsalud.mx" className={inputClass} value={newUserEmail} onChange={e=>setNewUserEmail(e.target.value)}/>
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-bold text-gray-500 dark:text-slate-400 block mb-1">Contraseña Inicial</label>
                                        <input required type="text" minLength={6} placeholder="Mínimo 6 caracteres" className={inputClass} value={newUserPass} onChange={e=>setNewUserPass(e.target.value)}/>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 items-end">
                                    <div>
                                        <label className="text-[11px] font-bold text-gray-500 dark:text-slate-400 block mb-1">Jerarquía / Rango</label>
                                        <select
                                            className={inputClass}
                                            value={newUserRole}
                                            onChange={e => {
                                                const rId = e.target.value;
                                                setNewUserRole(rId);
                                                const rDef = ROLE_OPTIONS.find(ro => ro.id === rId);
                                                if (rDef?.defaultColor) setNewUserColor(rDef.defaultColor);
                                            }}
                                        >
                                            {ROLE_OPTIONS.map(ro => (
                                                <option key={ro.id} value={ro.id}>
                                                    {ro.label} {!ro.isResident ? '(No sale en Residentes)' : ro.canManageSchedule ? '(Asigna Cx y Guardias)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-bold text-gray-500 dark:text-slate-400 block mb-1">Color Distintivo</label>
                                        <div className="flex items-center gap-1.5 p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 overflow-x-auto">
                                            {USER_COLORS.map(c => (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => setNewUserColor(c.id)}
                                                    className={`w-5 h-5 rounded-full flex-shrink-0 transition ${c.dot} ${newUserColor === c.id ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-white scale-110' : 'opacity-60 hover:opacity-100'}`}
                                                    title={c.label}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <button type="submit" className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-bold text-sm hover:bg-emerald-700 transition shadow-sm whitespace-nowrap">
                                        + Crear Cuenta
                                    </button>
                                </div>
                            </form>

                            {lastCreatedCreds && (
                                <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                    <div className="text-xs text-emerald-900 dark:text-emerald-200">
                                        <p className="font-bold flex items-center gap-1"><CheckCircle2 size={14}/> Cuenta lista: {lastCreatedCreds.name} ({lastCreatedCreds.roleLabel})</p>
                                        <p className="font-mono opacity-80">{lastCreatedCreds.email} • Clave: {lastCreatedCreds.pass}</p>
                                    </div>
                                    <button
                                        onClick={copyCredentialsWA}
                                        className="bg-emerald-600 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 hover:bg-emerald-700 transition shadow-sm"
                                    >
                                        <Copy size={13}/> Copiar para WhatsApp
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Directorio de Cuentas con Homologación de Jerarquía y Color */}
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                                <div>
                                    <h2 className="font-bold flex items-center gap-2 text-base sm:text-lg text-slate-800 dark:text-white">
                                        <Users size={20} className="text-blue-600"/> Directorio de Cuentas y Jerarquías ({knownUsers.length})
                                    </h2>
                                    <p className="text-xs text-gray-500 dark:text-slate-400">
                                        Configura aquí quién es <strong>Adscrito / Maestro</strong> (para excluirlo de Residentes) o el año y color de cada Residente.
                                    </p>
                                </div>

                                <div className="flex gap-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg text-xs font-bold self-start">
                                    <button onClick={() => setUserFilter('all')} className={`px-2.5 py-1 rounded-md transition ${userFilter === 'all' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'}`}>Todos ({userStats.total})</button>
                                    <button onClick={() => setUserFilter('active')} className={`px-2.5 py-1 rounded-md transition ${userFilter === 'active' ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500'}`}>Activos ({userStats.active})</button>
                                    <button onClick={() => setUserFilter('banned')} className={`px-2.5 py-1 rounded-md transition ${userFilter === 'banned' ? 'bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 shadow-sm' : 'text-slate-500'}`}>Bloqueados ({userStats.banned})</button>
                                </div>
                            </div>

                            {/* Buscador de usuarios */}
                            <div className="relative mb-4">
                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                <input
                                    type="text"
                                    value={userSearch}
                                    onChange={e => setUserSearch(e.target.value)}
                                    placeholder="Buscar cuenta por correo, nombre o rol (ej. roberto, R4)..."
                                    className="w-full pl-9 pr-8 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-xs bg-gray-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                                />
                                {userSearch && (
                                    <button onClick={() => setUserSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            <div className="space-y-2.5">
                                {filteredUsers.length === 0 && (
                                    <p className="text-gray-400 text-center py-6 text-xs">No se encontraron cuentas con ese criterio.</p>
                                )}

                                {filteredUsers.map(u => {
                                    const isBanned = bannedUsers.includes(u);
                                    const isRealEmail = !u.endsWith('@rounds.app');
                                    const prof = getMemberProfile(u, settingsMeta);
                                    const emailPrefix = u.split('@')[0];

                                    return (
                                        <div key={u} className={`flex flex-col gap-2.5 p-3.5 rounded-xl border transition-all ${isBanned ? 'bg-red-50/70 dark:bg-red-900/15 border-red-200 dark:border-red-900/50' : 'bg-gray-50 dark:bg-slate-700/40 border-gray-200 dark:border-slate-700'}`}>
                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className={`px-2.5 py-1 rounded-lg border text-xs font-extrabold inline-flex items-center gap-1.5 ${prof.colorObj.badge}`}>
                                                        <span className={`w-2 h-2 rounded-full ${prof.colorObj.dot}`} />
                                                        {prof.name && !prof.name.includes('@') ? prof.name : emailPrefix.toUpperCase()}
                                                        {prof.roleShort && <span className="opacity-80">({prof.roleShort})</span>}
                                                    </span>
                                                    <span className={`font-mono text-xs break-all ${isBanned ? 'text-red-800 dark:text-red-300 line-through opacity-75' : 'text-slate-600 dark:text-slate-300'}`}>
                                                        {u}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2 self-end sm:self-center">
                                                    {isRealEmail && !isBanned && (
                                                        <button
                                                            onClick={() => handleSendResetEmail(u)}
                                                            className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-600 hover:bg-blue-50 transition"
                                                            title="Enviar correo de recuperación de contraseña"
                                                        >
                                                            <Mail size={13}/> Reset Clave
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={()=>toggleBanStatus(u, isBanned)}
                                                        className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition ${isBanned ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-100' : 'bg-red-600 text-white hover:bg-red-700'}`}
                                                    >
                                                        {isBanned ? <><RotateCcw size={13}/> Restaurar</> : <><XCircle size={13}/> Bloquear</>}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Controles de Homologación: Nombre vinculado, Jerarquía y Color */}
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-gray-200/70 dark:border-slate-600/60 items-center">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 whitespace-nowrap">Nombre en App:</span>
                                                    <select
                                                        value={residents.find(r => normalizeText(r) === normalizeText(prof.name)) || ''}
                                                        onChange={e => {
                                                            if (e.target.value) {
                                                                updateMemberProfile(u, { name: e.target.value, email: u });
                                                            }
                                                        }}
                                                        className="flex-1 p-1.5 text-xs border border-gray-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
                                                    >
                                                        <option value="">{prof.name && !prof.name.includes('@') ? prof.name : 'Vincular con lista...'}</option>
                                                        {residents.map(r => <option key={r} value={r}>{r}</option>)}
                                                    </select>
                                                </div>

                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 whitespace-nowrap">Jerarquía:</span>
                                                    <select
                                                        value={prof.role || ''}
                                                        onChange={e => updateMemberProfile(u, { role: e.target.value, email: u })}
                                                        className="flex-1 p-1.5 text-xs border border-gray-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                                                    >
                                                        <option value="">— Sin jerarquía —</option>
                                                        {ROLE_OPTIONS.map(ro => (
                                                            <option key={ro.id} value={ro.id}>
                                                                {ro.label} {!ro.isResident ? '(Maestro)' : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div className="flex items-center gap-1.5 justify-between sm:justify-end">
                                                    <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400">Color:</span>
                                                    <div className="flex items-center gap-1">
                                                        {USER_COLORS.map(c => (
                                                            <button
                                                                key={c.id}
                                                                type="button"
                                                                onClick={() => updateMemberProfile(u, { color: c.id, email: u }, false)}
                                                                className={`w-4 h-4 rounded-full transition ${c.dot} ${prof.colorId === c.id ? 'ring-2 ring-offset-1 ring-slate-900 dark:ring-white scale-110' : 'opacity-45 hover:opacity-100'}`}
                                                                title={c.label}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* VISTA: CATÁLOGOS (RESIDENTES, DOCTORES, HOSPITALES) */}
                {activeTab !== 'usuarios' && (
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
                            <div>
                                <h2 className="font-bold text-lg text-slate-800 dark:text-white">{tabMeta[activeTab]?.title}</h2>
                                <p className="text-xs text-gray-500 dark:text-slate-400">{tabMeta[activeTab]?.subtitle}</p>
                            </div>
                            <span className="text-xs font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full self-start sm:self-center">
                                Total: {currentList.length}
                            </span>
                        </div>

                        {/* Formulario para agregar nuevo elemento */}
                        <form onSubmit={handleAddItem} className="flex flex-col sm:flex-row gap-2 mb-4">
                            <input
                                className={inputClass}
                                placeholder={tabMeta[activeTab]?.placeholder}
                                value={newItem}
                                onChange={e => setNewItem(e.target.value)}
                            />
                            {activeTab === 'residentes' && (
                                <select
                                    value={newResRole}
                                    onChange={e => {
                                        const rId = e.target.value;
                                        setNewResRole(rId);
                                        const rDef = ROLE_OPTIONS.find(ro => ro.id === rId);
                                        if (rDef?.defaultColor) setNewResColor(rDef.defaultColor);
                                    }}
                                    className="p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-xs font-bold sm:w-44"
                                >
                                    {ROLE_OPTIONS.filter(r => r.isResident).map(ro => (
                                        <option key={ro.id} value={ro.id}>{ro.label}</option>
                                    ))}
                                </select>
                            )}
                            <button type="submit" className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-blue-700 transition whitespace-nowrap shadow-sm">
                                + Añadir
                            </button>
                        </form>

                        {/* Buscador dentro del catálogo */}
                        <div className="relative mb-4">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            <input
                                type="text"
                                value={catalogSearch}
                                onChange={e => setCatalogSearch(e.target.value)}
                                placeholder={`Buscar en ${activeTab} (${currentList.length})...`}
                                className="w-full pl-9 pr-8 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-xs bg-gray-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                            />
                            {catalogSearch && (
                                <button onClick={() => setCatalogSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white">
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        <div className={activeTab === 'residentes' ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5"}>
                            {filteredCatalog.length === 0 && (
                                <p className="text-gray-400 py-6 text-center text-xs col-span-full">
                                    No se encontraron resultados para "{catalogSearch}".
                                </p>
                            )}
                            {filteredCatalog.map(item => {
                                const isEditing = editingItem === item;
                                const prof = activeTab === 'residentes' ? getMemberProfile(item, settingsMeta) : null;

                                return (
                                    <div key={item} className={`flex flex-col gap-2 bg-gray-50 dark:bg-slate-700/60 p-3 rounded-xl border shadow-sm ${prof?.inHzh ? 'border-orange-300 dark:border-orange-700 bg-orange-50/30 dark:bg-orange-950/20' : 'border-gray-200 dark:border-slate-600'}`}>
                                        <div className="flex justify-between items-center">
                                            {isEditing ? (
                                                <div className="flex items-center gap-1.5 flex-1 mr-1">
                                                    <input
                                                        type="text"
                                                        value={editValue}
                                                        onChange={e => setEditValue(e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && handleSaveEditItem(item)}
                                                        className="w-full px-2 py-1 text-xs border border-blue-400 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                                        autoFocus
                                                    />
                                                    <button onClick={() => handleSaveEditItem(item)} className="p-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700" title="Guardar">
                                                        <Check size={14}/>
                                                    </button>
                                                    <button onClick={() => setEditingItem(null)} className="p-1.5 bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-200 rounded" title="Cancelar">
                                                        <X size={14}/>
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        {prof ? (
                                                            <span className={`px-2.5 py-1 rounded-lg border text-xs font-extrabold inline-flex items-center gap-1.5 truncate ${prof.colorObj.badge}`}>
                                                                <span className={`w-2 h-2 rounded-full ${prof.colorObj.dot}`} />
                                                                {item}
                                                                {prof.roleShort && <span className="opacity-75">· {prof.roleShort}</span>}
                                                            </span>
                                                        ) : (
                                                            <span className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate pr-2" title={item}>{item}</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1 flex-shrink-0">
                                                        {activeTab === 'residentes' && (
                                                            <button
                                                                onClick={() => toggleResidentHzh(item)}
                                                                className={`px-2 py-1 rounded-lg text-[10px] font-black border transition ${prof?.inHzh ? 'bg-orange-500 text-white border-orange-500 shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-500 border-gray-200 dark:border-slate-600 hover:border-orange-400'}`}
                                                                title="Marcar/desmarcar rotando en Hospital Zambrano Hellion (aparece primero en los dropdowns)"
                                                            >
                                                                📍 HZH
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => startEditItem(item)}
                                                            className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/40 p-1.5 rounded transition"
                                                            title="Renombrar"
                                                        >
                                                            <Edit2 size={15}/>
                                                        </button>
                                                        <button
                                                            onClick={() => handleRemoveItem(item)}
                                                            className="text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/50 p-1.5 rounded transition"
                                                            title="Eliminar del menú"
                                                        >
                                                            <Trash2 size={15}/>
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* Si estamos en Residentes: Selector de Jerarquía (R1-R5 o Maestro) y Paleta de Color */}
                                        {activeTab === 'residentes' && prof && (
                                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-200/70 dark:border-slate-600/50">
                                                <select
                                                    value={prof.role || ''}
                                                    onChange={e => updateMemberProfile(item, { name: item, role: e.target.value })}
                                                    className="p-1 text-[11px] font-bold border border-gray-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                                                >
                                                    <option value="">Jerarquía (R1–R5)...</option>
                                                    {ROLE_OPTIONS.map(ro => (
                                                        <option key={ro.id} value={ro.id}>
                                                            {ro.label} {!ro.isResident ? '(Quitar de Residentes)' : ''}
                                                        </option>
                                                    ))}
                                                </select>

                                                <div className="flex items-center gap-1">
                                                    {USER_COLORS.map(c => (
                                                        <button
                                                            key={c.id}
                                                            type="button"
                                                            onClick={() => updateMemberProfile(item, { name: item, color: c.id }, false)}
                                                            className={`w-4 h-4 rounded-full transition ${c.dot} ${prof.colorId === c.id ? 'ring-2 ring-offset-1 ring-slate-900 dark:ring-white scale-110' : 'opacity-45 hover:opacity-100'}`}
                                                            title={c.label}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
