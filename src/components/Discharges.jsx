import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { calculateLOS, downloadCSV } from '../utils';

export default function Discharges() {
  const [list, setList] = useState([]);

  useEffect(() => {
    // Buscar pacientes donde discharged == true
    const q = query(collection(db, "patients"), where("discharged", "==", true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
       const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
       // Ordenar en cliente (más fácil que índice compuesto)
       setList(data.sort((a,b) => new Date(b.dischargeDate) - new Date(a.dischargeDate)));
    });
    return () => unsubscribe();
  }, []);

  const exportHistory = () => {
      const data = list.map(p => [
          p.bed, p.name, p.diagnosis, p.admissionDate, 
          p.dischargeDate ? p.dischargeDate.split('T')[0] : '', 
          calculateLOS(p.admissionDate), p.doctor
      ]);
      downloadCSV(data, ["Cama", "Nombre", "Dx", "Ingreso", "Egreso", "Dias", "Tratante"], "Historial_Egresos.csv");
  };

  return (
    <div className="pb-20">
       <div className="flex justify-between items-center mb-4">
           <h2 className="text-xl font-bold text-slate-800">Historial de Egresos</h2>
           <button onClick={exportHistory} className="bg-green-600 text-white text-xs px-3 py-2 rounded font-bold shadow">Descargar CSV</button>
       </div>

       <div className="space-y-2">
           {list.map(p => (
               <div key={p.id} className="bg-white p-3 rounded shadow-sm border flex justify-between items-center opacity-75">
                   <div>
                       <p className="font-bold text-slate-700">{p.name}</p>
                       <p className="text-xs text-gray-500">Egreso: {new Date(p.dischargeDate).toLocaleDateString()}</p>
                       <p className="text-xs text-gray-400">{p.diagnosis}</p>
                   </div>
                   <div className="text-right">
                       <span className="text-xs font-bold bg-gray-100 px-2 py-1 rounded">{calculateLOS(p.admissionDate)} días</span>
                       <p className="text-[10px] text-gray-400 mt-1">{p.doctor}</p>
                   </div>
               </div>
           ))}
           {list.length === 0 && <p className="text-center text-gray-400 mt-10">No hay egresos registrados aún.</p>}
       </div>
    </div>
  );
}
