import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, updateDoc, doc, query, orderBy } from 'firebase/firestore';
import PatientDetail from './PatientDetail';
import { CheckSquare, Square } from 'lucide-react';

export default function Surgery({ user, dynamicResidents, dynamicDoctors, dynamicLocations }) {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [filterDoc, setFilterDoc] = useState('');
  const [filterRes, setFilterRes] = useState('');

  useEffect(() => {
    const q = query(collection(db, "patients"), orderBy("bed"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Filtramos para mostrar los activos
      setPatients(data.filter(p => !p.discharged));
    });
    return () => unsubscribe();
  }, []);

  const toggleStatus = async (e, p) => { 
      e.stopPropagation(); 
      const newStatus = p.status === 'done' ? 'pending' : 'done'; 
      await updateDoc(doc(db, "patients", p.id), { status: newStatus }); 
  };

  if (selectedPatient) return <PatientDetail patient={selectedPatient} onClose={() => setSelectedPatient(null)} user={user} dynamicResidents={dynamicResidents} dynamicDoctors={dynamicDoctors} dynamicLocations={dynamicLocations} />;

  // Usar listas dinámicas si existen, si no fallback
  const docs = dynamicDoctors || [];
  const resi = dynamicResidents || [];

  return (
    <div className="pb-24">
      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-md border border-blue-100 dark:border-slate-700 mb-3 sticky top-0 z-10 transition-colors">
         <div className="flex gap-2 mb-2">
             <select className="flex-1 p-2 border rounded text-xs bg-slate-50 dark:bg-slate-700 dark:text-white dark:border-slate-600" value={filterDoc} onChange={e=>setFilterDoc(e.target.value)}>
                 <option value="">Todos los Tratantes</option>{docs.map(d => <option key={d}>{d}</option>)}<option value="Otro">Otro...</option>
             </select>
             <select className="flex-1 p-2 border rounded text-xs bg-slate-50 dark:bg-slate-700 dark:text-white dark:border-slate-600" value={filterRes} onChange={e=>setFilterRes(e.target.value)}>
                 <option value="">Todos los Residentes</option>{resi.map(r => <option key={r}>{r}</option>)}
             </select>
         </div>
      </div>
      <div className="grid grid-cols-1 gap-3">
         {patients.filter(p => !filterDoc || p.doctor === filterDoc || (filterDoc === 'Otro' && !docs.includes(p.doctor))).filter(p => !filterRes || p.resident === filterRes).map(p => (
            <div key={p.id} onClick={() => setSelectedPatient(p)} className="p-3 rounded-lg cursor-pointer active:scale-95 transition bg-white dark:bg-slate-800 border-l-[8px] border-blue-500 shadow-md">
               <div className="flex justify-between items-start">
                  <div className="flex-1 pr-2">
                     <div className="flex items-center gap-2 mb-1">
                        <span className="bg-black text-white px-2 py-1 rounded font-black text-lg shadow-sm border border-slate-700">{p.bed}</span>
                        {p.hospital && <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-900 px-1 rounded">{p.hospital}</span>}
                     </div>
                     <h3 className="font-extrabold text-lg text-blue-700 dark:text-blue-300 leading-tight mb-1">{p.name}</h3>
                     <p className="text-xs opacity-75 mb-1 dark:text-slate-300 text-gray-700">{p.diagnosis}</p>
                     <div className="text-xs opacity-75 flex justify-between bg-black/5 dark:bg-white/5 p-1 rounded dark:text-slate-400 text-slate-600"><span>{p.doctor}</span><span className="font-semibold">{p.resident}</span></div>
                  </div>
                  <div className="flex flex-col items-end justify-between h-full gap-2">
                      <button onClick={(e) => toggleStatus(e, p)}>{p.status === 'done' ? <CheckSquare size={30} className="text-blue-600 dark:text-blue-400"/> : <Square size={30} className="text-red-500"/>}</button>
                  </div>
               </div>
            </div>
         ))}
         {patients.length === 0 && <p className="text-center text-gray-500 mt-4">No hay pacientes activos.</p>}
      </div>
    </div>
  );
}
