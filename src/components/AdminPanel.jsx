import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, setDoc, arrayUnion, arrayRemove, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, Trash2, ShieldAlert, Building2, User, Stethoscope, RefreshCcw } from 'lucide-react';
import { DEFAULT_RESIDENTS, DOCTORS, LOCATIONS } from '../constants'; 

export default function AdminPanel({ onClose }) {
    const [authOk, setAuthOk] = useState(false);
    const [adminUser, setAdminUser] = useState('');
    const [adminPass, setAdminPass] = useState('');
    const [activeTab, setActiveTab] = useState('residentes');

    const [residents, setResidents] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [locations, setLocations] = useState([]);
    
    const [newItem, setNewItem] = useState('');
    const [msg, setMsg] = useState({ text: '', type: '' });

    const showMsg = (text, type='success') => { setMsg({text, type}); setTimeout(()=>setMsg({text:'',type:''}), 5000); };

    const handleLogin = (e) => {
        e.preventDefault();
        if(adminUser === 'ADMIN' && adminPass === '4424671630') setAuthOk(true);
        else showMsg("Credenciales incorrectas", "error");
    };

    useEffect(() => { 
        if(authOk) {
            const unsub = onSnapshot(doc(db, 'metadata', 'settings'), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setResidents(data.residents ? data.residents.sort() : DEFAULT_RESIDENTS);
                    setDoctors(data.doctors ? data.doctors.sort() : DOCTORS);
                    setLocations(data.locations ? data.locations.sort() : LOCATIONS);
                }
            }, (error) => {
                showMsg("Error conectando a Firebase: " + error.message, "error");
            });
            return () => unsub();
        }
    }, [authOk]);

    const handleAddItem = async (e) => {
        e.preventDefault();
        if(!newItem.trim()) return;
        const formatted = newItem.trim();
        let field = '';
        if(activeTab === 'residentes') field = 'residents';
        if(activeTab === 'doctores') field = 'doctors';
        if(activeTab === 'hospitales') field = 'locations';

        try {
            await setDoc(doc(db, 'metadata', 'settings'), { [field]: arrayUnion(formatted) }, { merge: true });
            setNewItem(''); showMsg("Agregado correctamente");
        } catch (err) {
            showMsg("Error: " + err.message, "error");
        }
    };
    
    const handleRemoveItem = async (item) => {
        if(!confirm(`¿Seguro que deseas eliminar a ${item} de la lista de opciones?`)) return;
        let field = '';
        if(activeTab === 'residentes') field = 'residents';
        if(activeTab === 'doctores') field = 'doctors';
        if(activeTab === 'hospitales') field = 'locations';

        try {
            await setDoc(doc(db, 'metadata', 'settings'), { [field]: arrayRemove(item) }, { merge: true });
            showMsg("Eliminado correctamente");
        } catch (err) {
            showMsg("Error: " + err.message, "error");
        }
    };

    const resetToDefaults = async () => {
        if(!confirm(`¿RESTABLECER ${activeTab.toUpperCase()}? Esto borrará tus cambios manuales en esta pestaña y cargará la lista oficial.`)) return;
        let field = '';
        let defaultData = [];
        if(activeTab === 'residentes') { field = 'residents'; defaultData = DEFAULT_RESIDENTS; }
        if(activeTab === 'doctores') { field = 'doctors'; defaultData = DOCTORS; }
        if(activeTab === 'hospitales') { field = 'locations'; defaultData = LOCATIONS; }

        try {
            await setDoc(doc(db, 'metadata', 'settings'), { [field]: defaultData }, { merge: true });
            showMsg("Lista restaurada exitosamente");
        } catch (err) {
            showMsg("Error: " + err.message, "error");
        }
    };

    const inputClass = "w-full p-3 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white";

    if(!authOk) {
        return (
            <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-2xl w-full max-w-sm border-t-4 border-red-600">
                    <button onClick={onClose} className="mb-4 text-gray-500 hover:text-gray-900 dark:hover:text-white"><ArrowLeft size={20}/></button>
                    <h2 className="text-xl font-black text-center mb-6 text-slate-900 dark:text-white flex justify-center items-center gap-2"><ShieldAlert className="text-red-600"/> Acceso Restringido</h2>
                    {msg.text && <div className="bg-red-100 text-red-700 p-2 rounded text-sm mb-4">{msg.text}</div>}
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input placeholder="Usuario Admin" className={inputClass} value={adminUser} onChange={e=>setAdminUser(e.target.value.toUpperCase())} />
                        <input type="password" placeholder="Clave Maestra" className={inputClass} value={adminPass} onChange={e=>setAdminPass(e.target.value)} />
                        <button className="w-full bg-red-600 text-white font-bold py-3 rounded shadow hover:bg-red-700 transition">Entrar al Sistema</button>
                    </form>
                </div>
            </div>
        );
    }

    const currentList = activeTab === 'residentes' ? residents : activeTab === 'doctores' ? doctors : locations;
    const placeholderText = activeTab === 'hospitales' ? "Ej. Zambrano" : "Nombre...";

    return (
        <div className="fixed inset-0 bg-gray-100 dark:bg-slate-900 text-slate-900 dark:text-white z-[100] overflow-y-auto p-4 pb-20">
            <div className="max-w-3xl mx-auto pt-safe mt-4">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <button onClick={onClose} className="p-2 bg-white dark:bg-slate-800 rounded-full shadow hover:bg-gray-50 transition"><ArrowLeft size={20}/></button>
                        <h1 className="text-2xl font-black text-red-600 dark:text-red-500 flex items-center gap-2"><ShieldAlert/> Data Admin</h1>
                    </div>
                </div>

                {msg.text && <div className={`p-3 rounded mb-6 font-bold text-sm shadow-sm ${msg.type==='error'?'bg-red-100 text-red-700 border-l-4 border-red-500':'bg-green-100 text-green-700 border-l-4 border-green-500'}`}>{msg.text}</div>}

                <div className="flex flex-col sm:flex-row gap-2 mb-6">
                    <button onClick={()=>setActiveTab('residentes')} className={`flex-1 py-3 font-bold rounded shadow flex justify-center items-center gap-2 transition ${activeTab==='residentes'?'bg-blue-600 text-white':'bg-white dark:bg-slate-800 text-gray-500 hover:bg-gray-50'}`}><User size={18}/> Residentes</button>
                    <button onClick={()=>setActiveTab('doctores')} className={`flex-1 py-3 font-bold rounded shadow flex justify-center items-center gap-2 transition ${activeTab==='doctores'?'bg-blue-600 text-white':'bg-white dark:bg-slate-800 text-gray-500 hover:bg-gray-50'}`}><Stethoscope size={18}/> Doctores</button>
                    <button onClick={()=>setActiveTab('hospitales')} className={`flex-1 py-3 font-bold rounded shadow flex justify-center items-center gap-2 transition ${activeTab==='hospitales'?'bg-blue-600 text-white':'bg-white dark:bg-slate-800 text-gray-500 hover:bg-gray-50'}`}><Building2 size={18}/> Hospitales</button>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow border dark:border-slate-700">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="font-bold text-lg text-slate-800 dark:text-white capitalize">Listado de {activeTab}</h2>
                            <p className="text-sm text-gray-500 mt-1">Modifica las opciones disponibles en los menús de la aplicación.</p>
                        </div>
                        <button onClick={resetToDefaults} className="flex items-center gap-1 bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-500 px-3 py-1 rounded text-xs font-bold shadow-sm transition">
                            <RefreshCcw size={14}/> Restaurar Original
                        </button>
                    </div>
                    
                    <form onSubmit={handleAddItem} className="flex gap-2 mb-6">
                        <input className={inputClass} placeholder={placeholderText} value={newItem} onChange={e=>setNewItem(e.target.value)} />
                        <button type="submit" className="bg-green-600 text-white px-6 rounded font-bold hover:bg-green-700 transition whitespace-nowrap">Añadir</button>
                    </form>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {currentList.length === 0 && <p className="text-gray-400 py-4 col-span-3">Cargando datos (Asegúrate de estar conectado a internet)...</p>}
                        {currentList.map(item => (
                            <div key={item} className="flex justify-between items-center bg-gray-50 dark:bg-slate-700 p-3 rounded-lg border dark:border-slate-600 shadow-sm">
                                <span className="font-bold text-slate-800 dark:text-slate-100 truncate pr-2" title={item}>{item}</span>
                                <button onClick={()=>handleRemoveItem(item)} className="text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/50 p-2 rounded transition flex-shrink-0" title="Eliminar">
                                    <Trash2 size={18}/>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
