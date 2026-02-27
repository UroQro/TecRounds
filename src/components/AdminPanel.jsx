import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { ArrowLeft, Trash2, UserPlus, ShieldAlert, KeyRound } from 'lucide-react';

export default function AdminPanel({ onClose }) {
    const [authOk, setAuthOk] = useState(false);
    const [adminUser, setAdminUser] = useState('');
    const [adminPass, setAdminPass] = useState('');
    const [activeTab, setActiveTab] = useState('residentes');

    const [residents, setResidents] = useState([]);
    const [banned, setBanned] = useState([]);
    
    const [newRes, setNewRes] = useState('');
    const [newUser, setNewUser] = useState('');
    const [newPass, setNewPass] = useState('');
    const [banUser, setBanUser] = useState('');
    const [resetUser, setResetUser] = useState('');
    const [msg, setMsg] = useState({ text: '', type: '' });

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
        }
    };

    useEffect(() => { if(authOk) fetchSettings(); }, [authOk]);

    const addResident = async () => {
        if(!newRes.trim()) return;
        const formatted = newRes.trim();
        await setDoc(doc(db, 'metadata', 'settings'), { residents: arrayUnion(formatted) }, { merge: true });
        setNewRes(''); fetchSettings(); showMsg("Residente agregado");
    };
    const removeResident = async (res) => {
        if(!confirm(`¿Eliminar a ${res}?`)) return;
        await setDoc(doc(db, 'metadata', 'settings'), { residents: arrayRemove(res) }, { merge: true });
        fetchSettings(); showMsg("Residente eliminado");
    };

    const FAKE_DOMAIN = "@rounds.app";

    const createUser = async (e) => {
        e.preventDefault();
        if(!newUser || !newPass) return;
        try {
            await createUserWithEmailAndPassword(auth, newUser.trim().toUpperCase() + FAKE_DOMAIN, newPass);
            showMsg("Usuario creado exitosamente.");
            setNewUser(''); setNewPass('');
            alert("AVISO: Por seguridad de Firebase, crear un usuario nuevo ha cerrado tu sesión actual y entrado con la nueva. Cierra esta ventana y verás el login o la nueva sesión.");
        } catch(err) { showMsg(err.message, "error"); }
    };

    const banUserHandler = async (e) => {
        e.preventDefault();
        if(!banUser.trim()) return;
        const emailToBan = banUser.trim().toUpperCase() + FAKE_DOMAIN;
        if(!confirm(`¿Dar de baja el acceso a ${emailToBan}?`)) return;
        await setDoc(doc(db, 'metadata', 'settings'), { bannedUsers: arrayUnion(emailToBan) }, { merge: true });
        setBanUser(''); fetchSettings(); showMsg("Usuario dado de baja");
    };

    const unbanUser = async (email) => {
        await setDoc(doc(db, 'metadata', 'settings'), { bannedUsers: arrayRemove(email) }, { merge: true });
        fetchSettings(); showMsg("Acceso restaurado");
    };

    const resetPassword = async (e) => {
        e.preventDefault();
        if(!resetUser.trim()) return;
        const email = resetUser.trim().toUpperCase() + FAKE_DOMAIN;
        try {
            await sendPasswordResetEmail(auth, email);
            showMsg("Correo de recuperación enviado.");
            setResetUser('');
        } catch(err) { showMsg(err.message, "error"); }
    };

    const inputClass = "w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white";

    if(!authOk) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-slate-900">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-xl w-full max-w-sm border-t-4 border-red-600">
                    <button onClick={onClose} className="mb-4 text-gray-500"><ArrowLeft size={20}/></button>
                    <h2 className="text-xl font-black text-center mb-6 text-slate-900 dark:text-white flex justify-center items-center gap-2"><ShieldAlert className="text-red-600"/> Consola Admin</h2>
                    {msg.text && <div className="bg-red-100 text-red-700 p-2 rounded text-sm mb-4">{msg.text}</div>}
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input placeholder="Usuario" className={inputClass} value={adminUser} onChange={e=>setAdminUser(e.target.value.toUpperCase())} />
                        <input type="password" placeholder="Contraseña" className={inputClass} value={adminPass} onChange={e=>setAdminPass(e.target.value)} />
                        <button className="w-full bg-red-600 text-white font-bold py-3 rounded">Ingresar</button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-slate-900 text-slate-900 dark:text-white p-4">
            <div className="max-w-2xl mx-auto">
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={onClose} className="p-2 bg-white dark:bg-slate-800 rounded-full shadow"><ArrowLeft size={20}/></button>
                    <h1 className="text-2xl font-black text-red-600 dark:text-red-500 flex items-center gap-2"><ShieldAlert/> Administración</h1>
                </div>

                {msg.text && <div className={`p-3 rounded mb-4 font-bold text-sm ${msg.type==='error'?'bg-red-100 text-red-700':'bg-green-100 text-green-700'}`}>{msg.text}</div>}

                <div className="flex gap-2 mb-4">
                    <button onClick={()=>setActiveTab('residentes')} className={`flex-1 py-2 font-bold rounded shadow ${activeTab==='residentes'?'bg-red-600 text-white':'bg-white dark:bg-slate-800 text-gray-500'}`}>Residentes</button>
                    <button onClick={()=>setActiveTab('usuarios')} className={`flex-1 py-2 font-bold rounded shadow ${activeTab==='usuarios'?'bg-red-600 text-white':'bg-white dark:bg-slate-800 text-gray-500'}`}>Gestión de Usuarios</button>
                </div>

                {activeTab === 'residentes' && (
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow border dark:border-slate-700">
                        <h2 className="font-bold mb-4 text-gray-500 dark:text-gray-400">Lista de Dropdowns (Residentes)</h2>
                        <div className="flex gap-2 mb-6">
                            <input className={inputClass} placeholder="Ej. Andres" value={newRes} onChange={e=>setNewRes(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addResident()}/>
                            <button onClick={addResident} className="bg-blue-600 text-white px-4 rounded font-bold">Añadir</button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {residents.map(r => (
                                <div key={r} className="flex justify-between items-center bg-gray-50 dark:bg-slate-700 p-2 rounded border dark:border-slate-600">
                                    <span className="text-sm font-semibold">{r}</span>
                                    <button onClick={()=>removeResident(r)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={16}/></button>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-gray-400 mt-4">*Eliminar un residente de aquí no borra el nombre en los expedientes que ya lo tenían asignado.</p>
                    </div>
                )}

                {activeTab === 'usuarios' && (
                    <div className="space-y-4">
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow border dark:border-slate-700">
                            <h2 className="font-bold mb-4 flex items-center gap-2"><UserPlus size={18}/> Agregar Nuevo Usuario</h2>
                            <form onSubmit={createUser} className="flex gap-2">
                                <input required placeholder="Usuario (Ej. PABLO)" className={inputClass} value={newUser} onChange={e=>setNewUser(e.target.value.toUpperCase())}/>
                                <input required type="password" placeholder="Contraseña" className={inputClass} value={newPass} onChange={e=>setNewPass(e.target.value)}/>
                                <button type="submit" className="bg-green-600 text-white px-4 rounded font-bold">Crear</button>
                            </form>
                            <p className="text-[10px] text-gray-400 mt-2">Agregará el sufijo @rounds.app automáticamente.</p>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow border dark:border-slate-700 border-l-4 border-l-red-500">
                            <h2 className="font-bold mb-4 text-red-600 flex items-center gap-2"><Trash2 size={18}/> Dar de Baja (Banear)</h2>
                            <form onSubmit={banUserHandler} className="flex gap-2 mb-4">
                                <input required placeholder="Usuario a bloquear (Ej. PABLO)" className={inputClass} value={banUser} onChange={e=>setBanUser(e.target.value.toUpperCase())}/>
                                <button type="submit" className="bg-red-600 text-white px-4 rounded font-bold">Bloquear</button>
                            </form>
                            {banned.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Usuarios Bloqueados</h3>
                                    <div className="space-y-1">
                                        {banned.map(b => (
                                            <div key={b} className="flex justify-between items-center bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 p-2 rounded text-sm">
                                                <span className="font-mono">{b}</span>
                                                <button onClick={()=>unbanUser(b)} className="text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-white px-2 py-1 rounded shadow">Restaurar Acceso</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow border dark:border-slate-700">
                            <h2 className="font-bold mb-2 flex items-center gap-2 text-blue-600 dark:text-blue-400"><KeyRound size={18}/> Restablecer Contraseña</h2>
                            <p className="text-xs text-gray-500 mb-4">Nota: Firebase enviará un link al correo. Como usamos dominios ficticios (@rounds.app), el correo no llegará a ningún lado. Si el usuario olvidó su contraseña, la solución real es Bloquear su cuenta antigua y Crear una nueva.</p>
                            <form onSubmit={resetPassword} className="flex gap-2">
                                <input required placeholder="Usuario (Ej. PABLO)" className={inputClass} value={resetUser} onChange={e=>setResetUser(e.target.value.toUpperCase())}/>
                                <button type="submit" className="bg-blue-600 text-white px-4 rounded font-bold">Enviar Link</button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
