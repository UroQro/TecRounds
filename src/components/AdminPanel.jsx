import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, setDoc, arrayUnion, arrayRemove, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, Trash2, ShieldAlert } from 'lucide-react';
import { DEFAULT_RESIDENTS } from '../constants'; 

export default function AdminPanel({ onClose }) {
    const [authOk, setAuthOk] = useState(false);
    const [adminUser, setAdminUser] = useState('');
    const [adminPass, setAdminPass] = useState('');

    const [residents, setResidents] = useState([]);
    const [newRes, setNewRes] = useState('');
    const [msg, setMsg] = useState({ text: '', type: '' });

    const showMsg = (text, type='success') => { setMsg({text, type}); setTimeout(()=>setMsg({text:'',type:''}), 5000); };

    const handleLogin = (e) => {
        e.preventDefault();
        if(adminUser === 'ADMIN' && adminPass === '4424671630') setAuthOk(true);
        else showMsg("Credenciales incorrectas", "error");
    };

    // Uso de onSnapshot para ver la lista inmediatamente y mantenerla sincronizada
    useEffect(() => { 
        if(authOk) {
            const unsub = onSnapshot(doc(db, 'metadata', 'settings'), (docSnap) => {
                if (docSnap.exists() && docSnap.data().residents) {
                    setResidents(docSnap.data().residents.sort());
                } else {
                    // Si no hay lista en Firebase, subimos la predeterminada inmediatamente
                    setDoc(doc(db, 'metadata', 'settings'), { residents: DEFAULT_RESIDENTS }, { merge: true });
                }
            });
            return () => unsub();
        }
    }, [authOk]);

    const addResident = async (e) => {
        e.preventDefault();
        if(!newRes.trim()) return;
        const formatted = newRes.trim();
        await setDoc(doc(db, 'metadata', 'settings'), { residents: arrayUnion(formatted) }, { merge: true });
        setNewRes(''); showMsg("Residente agregado");
    };
    
    const removeResident = async (res) => {
        if(!confirm(`¿Seguro que deseas eliminar a ${res} de la lista de opciones?`)) return;
        await setDoc(doc(db, 'metadata', 'settings'), { residents: arrayRemove(res) }, { merge: true });
        showMsg("Residente eliminado");
    };

    const inputClass = "w-full p-3 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white";

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
            <div className="max-w-2xl mx-auto">
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={onClose} className="p-2 bg-white dark:bg-slate-800 rounded-full shadow hover:bg-gray-50 transition"><ArrowLeft size={20}/></button>
                    <h1 className="text-2xl font-black text-red-600 dark:text-red-500 flex items-center gap-2"><ShieldAlert/> Administración</h1>
                </div>

                {msg.text && <div className={`p-3 rounded mb-6 font-bold text-sm shadow-sm ${msg.type==='error'?'bg-red-100 text-red-700 border-l-4 border-red-500':'bg-green-100 text-green-700 border-l-4 border-green-500'}`}>{msg.text}</div>}

                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow border dark:border-slate-700">
                    <h2 className="font-bold mb-2 text-lg text-slate-800 dark:text-white">Directorio de Residentes</h2>
                    <p className="text-sm text-gray-500 mb-6">Agrega o elimina nombres de la lista de opciones para la asignación de pacientes. No afecta los registros anteriores.</p>
                    
                    <form onSubmit={addResident} className="flex gap-2 mb-6">
                        <input className={inputClass} placeholder="Nombre del Residente a agregar..." value={newRes} onChange={e=>setNewRes(e.target.value)} />
                        <button type="submit" className="bg-blue-600 text-white px-6 rounded font-bold hover:bg-blue-700 transition">Añadir</button>
                    </form>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {residents.length === 0 && <p className="text-gray-400 py-4 col-span-2">Cargando residentes...</p>}
                        {residents.map(r => (
                            <div key={r} className="flex justify-between items-center bg-gray-50 dark:bg-slate-700 p-3 rounded-lg border dark:border-slate-600 shadow-sm">
                                <span className="font-bold text-slate-800 dark:text-slate-100 text-lg">{r}</span>
                                <button onClick={()=>removeResident(r)} className="flex items-center gap-1 text-sm bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/50 text-red-600 px-3 py-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition shadow-sm">
                                    <Trash2 size={16}/> Eliminar
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
