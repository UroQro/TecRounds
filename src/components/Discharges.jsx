import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { calculateAge } from '../utils';

export default function Discharges() {
  const [patients, setPatients] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "patients"), where("discharged", "==", true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b.dischargeDate || 0) - new Date(a.dischargeDate || 0));
      setPatients(data);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="pb-24 pt-2">
       <h2 className="font-bold text-xl mb-4 text-slate-800 dark:text-white px-2">Pacientes Egresados</h2>
       <div className="grid grid-cols-1 gap-3">
         {patients.map(p => (
            <div key={p.id} className="p-3 rounded-lg bg-gray-200 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 opacity-70">
               <div className="flex justify-between items-start">
                  <div className="flex-1 pr-2">
                     <div className="flex items-center gap-2 mb-1">
                        <span className="bg-gray-400 text-white px-2 py-1 rounded font-black text-lg">{p.bed}</span>
                        {p.hospital && <span className="text-[10px] font-bold text-gray-500 bg-gray-100 dark:bg-slate-900 px-1 rounded">{p.hospital}</span>}
                     </div>
                     <h3 className="font-extrabold text-lg text-gray-700 dark:text-gray-300 leading-tight mb-1">{p.name}</h3>
                     <p className="text-xs mb-1 text-gray-600 dark:text-gray-400">{calculateAge(p.dob)} años • {p.diagnosis}</p>
                     <p className="text-[10px] text-gray-500 font-mono">Egresado: {p.dischargeDate ? new Date(p.dischargeDate).toLocaleDateString() : 'N/A'}</p>
                  </div>
               </div>
            </div>
         ))}
         {patients.length === 0 && <p className="text-center text-gray-400 py-10">No hay egresos recientes.</p>}
      </div>
    </div>
  );
}
