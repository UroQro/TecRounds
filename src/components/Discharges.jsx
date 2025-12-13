import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { calculateLOS, downloadCSV } from '../utils';
import { Undo, Trash2, Search } from 'lucide-react';

export default function Discharges() {
  const [list, setList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, "patients"), where("discharged", "==", true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
       const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
       setList(data.sort((a,b) => new Date(b.dischargeDate) - new Date(a.dischargeDate)));
    });
    return () => unsubscribe();
  }, []);

  const exportHistory = () => {
      const data = list.map(p => [p.bed, p.name, p.diagnosis, p.admissionDate, p.dischargeDate ? p.dischargeDate.split('T')[0] : '', calculateLOS(p.admissionDate), p.doctor]);
      downloadCSV(data, ["Cama", "Nombre", "Dx", "Ingreso", "Egreso", "Dias", "Tratante"], "Historial_Egresos.csv");
  };

  const handleReadmit = async (p) => {
      if(confirm(`¿Reingresar a ${p.name} al Censo Activo?`)) {
          await updateDoc(doc(db, "patients", p.id), { discharged: false, status: 'pending' });
      }
  };

  const handleDelete = async (p) => {
      if(confirm(`¿ELIMINAR PERMANENTEMENTE el registro de ${p.name}? Esta acción no se puede deshacer.`)) {
          await deleteDoc(doc(db, "patients", p.id));
      }
  };
  
  const filteredList = list.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.diagnosis.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.doctor.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="pb-20">
       {/* Filter Bar: Vivid White + Blue border in day */}
       <div className="flex flex-col gap-3 mb-4 bg-white dark:bg-slate-800 p-3 rounded border border-blue-100 dark:border-slate-700 shadow-md dark:shadow-sm transition-colors">
           <div className="flex justify-between items-center"><h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Historial de Egresos</h2><button onClick={exportHistory} className="bg-green-600 text-white text-xs px-3 py-2 rounded font-bold shadow hover:bg-green-700">Descargar CSV</button></div>
           <div className="relative">
               <Search className="absolute left-3 top-2.5 text-gray-400 dark:text-slate-400" size={16}/>
               <input placeholder="Buscar por nombre, dx o doctor..." className="w-full pl-9 p-2 rounded bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-slate-900 dark:text-white text-sm focus:border-blue-500 outline-none" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/>
           </div>
       </div>
       
       <div className="space-y-2">
           {filteredList.map(p => (
               /* Cards: Stronger shadow (shadow-md) in day mode */
               <div key={p.id} className="bg-white dark:bg-slate-800 p-3 rounded shadow-md dark:shadow-sm border border-gray-200 dark:border-slate-700 flex justify-between items-center opacity-90 hover:opacity-100 transition">
                   <div><p className="font-bold text-slate-900 dark:text-slate-200">{p.name}</p><p className="text-xs text-gray-500 dark:text-slate-400">Egreso: {new Date(p.dischargeDate).toLocaleDateString()}</p><p className="text-xs text-gray-500 dark:text-slate-500">{p.diagnosis} • {p.doctor}</p></div>
                   <div className="flex flex-col items-end gap-2">
                       <span className="text-xs font-bold bg-gray-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded border border-gray-200 dark:border-slate-600">{calculateLOS(p.admissionDate)} días</span>
                       <div className="flex gap-2">
                           <button onClick={()=>handleReadmit(p)} className="text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 p-1 rounded hover:bg-blue-100" title="Reingresar"><Undo size={14}/></button>
                           <button onClick={()=>handleDelete(p)} className="text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-1 rounded hover:bg-red-100" title="Eliminar Definitivamente"><Trash2 size={14}/></button>
                       </div>
                   </div>
               </div>
           ))}
           {filteredList.length === 0 && <p className="text-center text-gray-400 dark:text-slate-500 mt-10">No se encontraron egresos.</p>}
       </div>
    </div>
  );
}
