import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { calculateAge, applyPrivacy } from '../utils';
import { RefreshCw } from 'lucide-react';

export default function Discharges({ privacyMode }) {
  const [archived, setArchived] = useState([]);
  const [legacy, setLegacy] = useState([]);
  const [daysBack, setDaysBack] = useState(30);

  useEffect(() => {
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - daysBack);
    const limitStr = limitDate.toISOString();

    const qArchived = query(collection(db, "archived_patients"), where("dischargeDate", ">=", limitStr));
    const unsubArchived = onSnapshot(qArchived, (snapshot) => {
      setArchived(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => { console.error(error); });

    const qLegacy = query(collection(db, "patients"), where("discharged", "==", true));
    const unsubLegacy = onSnapshot(qLegacy, (snapshot) => {
      const allLegacy = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const recentLegacy = allLegacy.filter(p => (p.dischargeDate || "") >= limitStr);
      setLegacy(recentLegacy);
    }, (error) => { console.error(error); });

    return () => { unsubArchived(); unsubLegacy(); };
  }, [daysBack]);

  const patients = [...archived, ...legacy].sort((a, b) => new Date(b.dischargeDate || 0) - new Date(a.dischargeDate || 0));

  const handleReingreso = async (p) => {
      if(confirm(`¿Estás seguro de reingresar a ${applyPrivacy(p.name, privacyMode, 'name')} al censo activo?`)) {
          try {
              const pRef = doc(db, "patients", p.id);
              const aRef = doc(db, "archived_patients", p.id);
              
              const reingresoData = { ...p, discharged: false, status: 'pending', bed: p.bed || 'Por asignar' };
              delete reingresoData.dischargeDate;
              
              await setDoc(pRef, reingresoData);
              
              // Intentamos borrar de la colección archivada por si venía de ahí
              try { await deleteDoc(aRef); } catch(e) {}
              
              alert("Paciente reingresado exitosamente al Censo Activo.");
          } catch(err) {
              alert("Error al reingresar: " + err.message);
          }
      }
  };

  return (
    <div className="pb-24 pt-2">
       <h2 className="font-bold text-xl mb-4 text-slate-800 dark:text-white px-2">Historial de Egresos</h2>
       <p className="text-xs text-gray-500 mb-4 px-2">Mostrando los últimos {daysBack} días.</p>
       
       <div className="grid grid-cols-1 gap-3">
         {patients.map(p => (
            <div key={p.id} className="p-3 rounded-lg bg-gray-200 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 opacity-70 relative group">
               <div className="flex justify-between items-start">
                  <div className="flex-1 pr-2">
                     <div className="flex items-center gap-2 mb-1">
                        <span className="bg-gray-400 text-white px-2 py-1 rounded font-black text-lg">{applyPrivacy(p.bed, privacyMode, 'bed')}</span>
                        {p.hospital && <span className="text-[10px] font-bold text-gray-500 bg-gray-100 dark:bg-slate-900 px-1 rounded">{p.hospital}</span>}
                     </div>
                     <h3 className="font-extrabold text-lg text-gray-700 dark:text-gray-300 leading-tight mb-1">{applyPrivacy(p.name, privacyMode, 'name')}</h3>
                     <p className="text-xs mb-1 text-gray-600 dark:text-gray-400">{calculateAge(p.dob)} años • {p.diagnosis}</p>
                     <p className="text-[10px] text-gray-500 font-mono">Egresado: {p.dischargeDate ? new Date(p.dischargeDate).toLocaleDateString() : 'N/A'}</p>
                  </div>
                  
                  <button onClick={() => handleReingreso(p)} className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 transition shadow-sm mt-1" title="Reingresar al censo">
                      <RefreshCw size={18} />
                  </button>
               </div>
            </div>
         ))}
         {patients.length === 0 && <p className="text-center text-gray-400 py-10">No hay egresos en este periodo.</p>}
         
         <div className="text-center mt-6">
             <button onClick={() => setDaysBack(daysBack + 30)} className="text-xs font-bold text-gray-600 dark:text-gray-400 bg-gray-200 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 py-2 px-6 rounded-full hover:opacity-80 transition shadow-sm">
                 Cargar 30 días más...
             </button>
         </div>
      </div>
    </div>
  );
}
