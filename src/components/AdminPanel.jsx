import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { ArrowLeft, Trash2, UserPlus, ShieldAlert, KeyRound, CheckCircle2 } from 'lucide-react';

export default function AdminPanel({ onClose }) {
    const [authOk, setAuthOk] = useState(false);
    const [adminUser, setAdminUser] = useState('');
    const [adminPass, setAdminPass] = useState('');
    const [activeTab, setActiveTab] = useState('residentes');

    const [residents, setResidents] = useState([]);
    const [banned, setBanned] = useState([]);
    const [knownUsers, setKnownUsers] = useState([]);
    
    const [newRes, setNewRes] = useState('');
    const [newUser, setNewUser] = useState('');
    const [newPass, setNewPass] = useState('');
    const [msg, setMsg] = useState({ text: '', type: '' });

    const FAKE_DOMAIN = "@rounds.app";

    const showMsg = (text, type='success') => { setMsg({text, type}); setTimeout(()=>setMsg({text:'',type:''}), 5000); };

    const handleLogin = (e) => {
        e.preventDefault();
        if(adminUser === 'ADMIN' && adminPass === '4424671630') setAuthOk(true);
        else showMsg("Credenciales incorrectas", "error");
    };

    const fetchSettings = async () => {
        const snap = await getDoc(doc(db, 'metadata', 'settings'));
        if(snap.exists()) {
            setResidents(snap.data().residents || []);
            setBanned(snap.data().bannedUsers || []);
            setKnownUsers(snap.data().knownUsers || []);
        }
    };

    useEffect(() => { if(authOk) fetchSettings(); }, [authOk]);

    const addResident = async (e) => {
        e.preventDefault();
        if(!newRes.trim()) return;
        const formatted = newRes.trim();
        await setDoc(doc(db, 'metadata', 'settings'), { residents: arrayUnion(formatted) }, { merge: true });
        setNewRes(''); fetchSettings(); showMsg("Residente agregado");
    };
    
    const removeResident = async (res) => {
        if(!confirm(`¿Seguro que deseas eliminar a ${res} de la lista de opciones?`)) return;
        await setDoc(doc(db, 'metadata', 'settings'), { residents: arrayRemove(res) }, { merge: true });
        fetchSettings(); showMsg("Residente eliminado");
    };

    const createUser = async (e) => {
        e.preventDefault();
        if(!newUser || !newPass) return;
        const email = newUser.trim().toUpperCase() + FAKE_DOMAIN;
        try {
            await createUserWithEmailAndPassword(auth, email, newPass);
            await setDoc(doc(db, 'metadata', 'settings'), { knownUsers: arrayUnion(email) }, { merge: true });
            showMsg("Usuario creado exitosamente.");
            setNewUser(''); setNewPass('');
            alert("AVISO: Por seguridad, Firebase ha cerrado tu sesión Admin para entrar con el usuario nuevo. Inicia sesión o regresa al Admin.");
        } catch(err) { showMsg(err.message, "error"); }
    };

    const removeAccess = async (emailToBan) => {
        const display = emailToBan.split('@')[0];
        if(!confirm(`¿Quitar acceso al usuario ${display}? No podrá volver a entrar al sistema.`)) return;
        await setDoc(doc(db, 'metadata', 'settings'), { bannedUsers: arrayUnion(emailToBan) }, { merge: true });
        fetchSettings(); showMsg(`Acceso revocado para ${display}`);
    };

    const restoreAccess = async (email) => {
        await setDoc(doc(db, 'metadata', 'settings'), { bannedUsers: arrayRemove(email) }, { merge: true });
        fetchSettings(); showMsg("Acceso restaurado");
    };

    const inputClass = "w-full p-3 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white";
    
    // Filtrar los usuarios que no están baneados para mostrarlos en "Activos"
    const activeUsers = knownUsers.filter(u => !banned.includes(u));

    if(!authOk) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-slate-900">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-xl w-full max-w-sm border-t-4 border-red-600">
                    <button onClick={onClose} className="mb-4 text-gray-500 hover:text-gray-900 dark:hover:text-white"><ArrowLeft size={20}/></button>
                    <h2 className="text-xl font-black text-center mb-6 text-slate-900 dark:text-white flex justify-center items-center gap-2"><ShieldAlert className="text-red-600"/> Consola Admin</h2>
                    {msg.text && <div className="bg-red-100 text-red-700 p-2 rounded text-sm mb-4">{msg.text}</div>}
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input placeholder="Usuario" className={inputClass} value={adminUser} onChange={e=>setAdminUser(e.target.value.toUpperCase())} />
                        <input type="password" placeholder="Contraseña" className={inputClass} value={adminPass} onChange={e=>setAdminPass(e.target.value)} />
                        <button className="w-full bg-red-600 text-white font-bold py-3 rounded shadow hover:bg-red-700 transition">Ingresar</button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-slate-900 text-slate-900 dark:text-white p-4 pb-20">
            <div className="max-w-xl mx-auto">
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={onClose} className="p-2 bg-white dark:bg-slate-800 rounded-full shadow hover:bg-gray-50 transition"><ArrowLeft size={20}/></button>
                    <h1 className="text-2xl font-black text-red-600 dark:text-red-500 flex items-center gap-2"><ShieldAlert/> Administración</h1>
                </div>

                {msg.text && <div className={`p-3 rounded mb-6 font-bold text-sm shadow-sm ${msg.type==='error'?'bg-red-100 text-red-700 border-l-4 border-red-500':'bg-green-100 text-green-700 border-l-4 border-green-500'}`}>{msg.text}</div>}

                <div className="flex gap-2 mb-6">
                    <button onClick={()=>setActiveTab('residentes')} className={`flex-1 py-3 font-bold rounded shadow transition ${activeTab==='residentes'?'bg-red-600 text-white':'bg-white dark:bg-slate-800 text-gray-500 hover:bg-gray-50'}`}>Residentes</button>
                    <button onClick={()=>setActiveTab('usuarios')} className={`flex-1 py-3 font-bold rounded shadow transition ${activeTab==='usuarios'?'bg-red-600 text-white':'bg-white dark:bg-slate-800 text-gray-500 hover:bg-gray-50'}`}>Usuarios App</button>
                </div>

                {activeTab === 'residentes' && (
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow border dark:border-slate-700">
                        <h2 className="font-bold mb-2 text-lg">Menú de Residentes</h2>
                        <p className="text-sm text-gray-500 mb-6">Agrega o elimina nombres de la lista de opciones para nuevos pacientes. No afecta los registros anteriores.</p>
                        
                        <form onSubmit={addResident} className="flex gap-2 mb-6">
                            <input className={inputClass} placeholder="Nombre del Residente" value={newRes} onChange={e=>setNewRes(e.target.value)} />
                            <button type="submit" className="bg-blue-600 text-white px-6 rounded font-bold hover:bg-blue-700 transition">Añadir</button>
                        </form>

                        <div className="space-y-2">
                            {residents.length === 0 && <p className="text-gray-400 text-center py-4">No hay residentes en la lista.</p>}
                            {residents.map(r => (
                                <div key={r} className="flex justify-between items-center bg-gray-50 dark:bg-slate-700 p-3 rounded-lg border dark:border-slate-600 shadow-sm">
                                    <span className="font-bold text-slate-800 dark:text-slate-100">{r}</span>
                                    <button onClick={()=>removeResident(r)} className="text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/50 p-2 rounded transition" title="Eliminar residente">
                                        <Trash2 size={18}/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'usuarios' && (
                    <div className="space-y-6">
                        
                        {/* AGREGAR USUARIO */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow border dark:border-slate-700">
                            <h2 className="font-bold mb-4 flex items-center gap-2 text-lg"><UserPlus size={20}/> Nuevo Usuario</h2>
                            <form onSubmit={createUser} className="flex flex-col sm:flex-row gap-2">
                                <input required placeholder="Usuario (Ej. ANDRES)" className={`flex-1 ${inputClass}`} value={newUser} onChange={e=>setNewUser(e.target.value.toUpperCase())}/>
                                <input required type="password" placeholder="Contraseña" className={`flex-1 ${inputClass}`} value={newPass} onChange={e=>setNewPass(e.target.value)}/>
                                <button type="submit" className="bg-green-600 text-white px-6 py-3 rounded font-bold hover:bg-green-700 transition">Crear</button>
                            </form>
                            <p className="text-xs text-gray-400 mt-2">* Si un usuario olvidó su contraseña, la solución es "Eliminar su acceso" abajo y crearle uno nuevo aquí.</p>
                        </div>

                        {/* LISTA DE USUARIOS ACTIVOS */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow border dark:border-slate-700">
                            <h2 className="font-bold mb-2 flex items-center gap-2 text-lg text-blue-600 dark:text-blue-400"><CheckCircle2 size={20}/> Usuarios Activos</h2>
                            <p className="text-sm text-gray-500 mb-4">Los usuarios irán apareciendo en esta lista conforme inicien sesión en la aplicación.</p>
                            <div className="space-y-2">
                                {activeUsers.length === 0 && <p className="text-gray-400 text-center py-4">Aún no hay usuarios detectados.</p>}
                                {activeUsers.map(u => (
                                    <div key={u} className="flex justify-between items-center bg-blue-50 dark:bg-slate-700 p-3 rounded-lg border border-blue-100 dark:border-slate-600 shadow-sm">
                                        <span className="font-bold font-mono text-blue-900 dark:text-blue-100">{u.split('@')[0]}</span>
                                        <button onClick={()=>removeAccess(u)} className="flex items-center gap-1 text-sm bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/50 text-red-600 px-3 py-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition shadow-sm" title="Quitar acceso al sistema">
                                            <Trash2 size={16}/> Eliminar
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* USUARIOS BLOQUEADOS */}
                        {banned.length > 0 && (
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow border dark:border-slate-700 border-l-4 border-l-red-500">
                                <h2 className="font-bold mb-4 text-red-600 flex items-center gap-2"><ShieldAlert size={20}/> Acceso Eliminado (Bloqueados)</h2>
                                <div className="space-y-2">
                                    {banned.map(b => (
                                        <div key={b} className="flex justify-between items-center bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-900/30">
                                            <span className="font-bold font-mono text-red-800 dark:text-red-200 strike-through">{b.split('@')[0]}</span>
                                            <button onClick={()=>restoreAccess(b)} className="text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-600 text-slate-800 dark:text-white px-3 py-1.5 rounded shadow-sm hover:bg-gray-50 transition">Restaurar</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
