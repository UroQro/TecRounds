import React, { useState } from 'react';
import { DOCTORS, RESIDENTS } from '../data/lists';
import { calculateLOS, downloadCSV } from '../utils';
import { Search, Download, CheckSquare, Square, Plus } from 'lucide-react';

const Census = ({ patients, setPatients, onSelect }) => {
  const [filters, setFilters] = useState({ doc: '', res: '' });

  const toggleStatus = (e, pid) => {
    e.stopPropagation();
    setPatients(patients.map(p => 
       p.id === pid ? { ...p, status: p.status === 'done' ? 'pending' : 'done' } : p
    ));
  };

  const getCardColor = (p) => {
      const hasPending = p.checklist?.some(x => !x.done);
      if(hasPending) return "bg-yellow-50 border-yellow-500";
      if(p.status === 'done') return "bg-blue-50 border-blue-500";
      return "bg-red-50 border-red-500";
  };

  const exportDOP = () => {
    const data = patients.filter(p => p.doctor === "Dr. Olvera").map(p => 
      [p.bed, p.name, p.diagnosis, calculateLOS(p.admissionDate)]
    );
    downloadCSV([["Cama", "Nombre", "Dx", "Dias"], ...data], "Pacientes_Dr_Olvera.csv");
  };

  const exportGeneral = () => {
    const headers = ["Cuarto", "IC/HO", "Nombre", "Ingreso", "Estancia", "Nacimiento", "Dx", "Tratante"];
    const rows = patients.map(p => [
        p.bed, p.type, p.name, p.admissionDate, calculateLOS(p.admissionDate), p.dob, p.diagnosis, p.doctor
    ]);
    downloadCSV([headers, ...rows], "Censo_General.csv");
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border space-y-3">
         <div className="flex gap-2">
            <select className="w-1/2 p-2 border rounded text-sm bg-slate-50" onChange={e => setFilters({...filters, doc: e.target.value})}>
               <option value="">Todos los Tratantes</option>
               {DOCTORS.map(d => <option key={d}>{d}</option>)}
            </select>
            <select className="w-1/2 p-2 border rounded text-sm bg-slate-50" onChange={e => setFilters({...filters, res: e.target.value})}>
               <option value="">Todos los Residentes</option>
               {RESIDENTS.map(r => <option key={r}>{r}</option>)}
            </select>
         </div>
         <div className="flex justify-between">
            <button onClick={exportDOP} className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded font-bold border border-blue-200">
               CSV Dr. Olvera
            </button>
            <button onClick={exportGeneral} className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded font-bold border border-green-200">
               CSV General
            </button>
         </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
         {patients
            .filter(p => !filters.doc || p.doctor === filters.doc)
            .filter(p => !filters.res || p.resident === filters.res)
            .map(p => (
            <div key={p.id} onClick={() => onSelect(p)} 
                 className={`p-4 rounded-lg border-l-4 shadow-sm relative cursor-pointer hover:shadow-md transition ${getCardColor(p)}`}>
               <div className="flex justify-between items-start">
                  <div>
                     <h3 className="font-bold text-gray-800 text-lg">{p.bed} <span className="text-sm font-normal text-gray-500">({p.type})</span></h3>
                     <p className="font-semibold text-blue-900">{p.name}</p>
                     <p className="text-xs text-gray-600 mt-1">{p.doctor} | {p.resident}</p>
                     <p className="text-xs text-gray-400">Estancia: {calculateLOS(p.admissionDate)} días</p>
                  </div>
                  <button onClick={(e) => toggleStatus(e, p.id)} className="p-1">
                      {p.status === 'done' ? <CheckSquare className="text-blue-600"/> : <Square className="text-red-400"/>}
                  </button>
               </div>
            </div>
         ))}
      </div>

      <button className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-xl hover:bg-blue-700">
         <Plus />
      </button>
    </div>
  );
};

export default Census;
