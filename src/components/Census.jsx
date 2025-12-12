import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, updateDoc, doc, query, orderBy } from 'firebase/firestore';
import { DOCTORS, RESIDENTS } from '../constants';
import { calculateLOS, downloadCSV, calculateAge } from '../utils';
import PatientDetail from './PatientDetail';
import PatientFormModal from './PatientFormModal';
import { Plus, CheckSquare, Square, LogOut, Filter } from 'lucide-react';

export default function Census({ user }) {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterDoc, setFilterDoc] = useState('');
  const [filterRes, setFilterRes] = useState('');

  useEffect(() => {
    const q = query(collection(db, "patients"), orderBy("bed"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPatients(data.filter(p => !p.discharged));
    });
    return () => unsubscribe();
  }, []);

  const toggleStatus = async (e, p) => { e.stopPropagation(); const newStatus = p.status === 'done' ? 'pending' : 'done'; await updateDoc(doc(db, "patients", p.id), { status: newStatus }); };
  const dischargePatient = async (e, p) => { e.stopPropagation(); if(confirm(`¿Egresar a ${p.name}?`)) { await updateDoc(doc(db, "patients", p.id), { discharged: true, dischargeDate: new Date().toISOString() }); } };

  const getCardColor = (p) => {
    if (p.type === 'NOVER') return "bg-white border-slate-200";
    if (p.preDischarge) return "bg-purple-50 border-purple-500";
    if (p.hasPending) return "bg-yellow-50 border-yellow-500";
    if (p.type === 'SND') { return p.status === 'done' ? "bg-green-50 border-green-500" : "bg-orange-50 border-orange-400"; }
    return p.status === 'done' ? "bg-blue-50 border-blue-500" : "bg-red-50 border-red-500";
  };

  const exportDOP = () => { const data = patients.filter(p => p.doctor === "Dr. Olvera").map(p => [p.bed, p.name, p.diagnosis, calculateLOS(p.admissionDate)]); downloadCSV(data, ["Cama", "Nombre", "Dx", "Dias"], "Censo_Dr_Olvera.csv"); };
  const exportGeneral = () => { const data = patients.map(p => [p.bed, p.type, p.name, p.admissionDate, calculateLOS(p.admissionDate), p.dob, calculateAge(p.dob), p.diagnosis, p.doctor]); downloadCSV(data, ["Cuarto", "IC/HO", "Nombre", "Ingreso", "Dias", "Nacimiento", "Edad", "Dx", "Tratante"], "Censo_General.csv"); };

  if (selectedPatient) return <PatientDetail patient={selectedPatient} onClose={() => setSelectedPatient(null)} user={user} />;

  const sortedPatients = [...patients].sort((a, b) => {
      if (a.type === 'NOVER' && b.type !== 'NOVER') return 1;
      if (a.type !== 'NOVER' && b.type === 'NOVER') return -1;
      return 0;
  });

  return (
    <div className="pb-24">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-4 sticky top-0 z-10 backdrop-blur-md bg-white/95">
         <div className="flex gap-2 mb-3">
             <div className="relative flex-1"><select className="w-full p-2 pl-2 border rounded-lg text-xs bg-slate-50 appearance-none font-medium text-slate-600" value={filterDoc} onChange={e=>setFilterDoc(e.target.value)}><option value="">Todos los Tratantes</option>{DOCTORS.map(d => <option key={d}>{d}</option>)}<option value="Otro">Otro...</option></select></div>
             <div className="relative flex-1"><select className="w-full p-2 pl-2 border rounded-lg text-xs bg-slate-50 appearance-none font-medium text-slate-600" value={filterRes} onChange={e=>setFilterRes(e.target.value)}><option value="">Todos los Residentes</option>{RESIDENTS.map(r => <option key={r}>{r}</option>)}</select></div>
         </div>
         <div className="flex gap-2 justify-end">
             <button onClick={exportDOP} className="text-[10px] bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full font-bold border border-blue-100 hover:bg-blue-100 transition">CSV Olvera</button>
             <button onClick={exportGeneral} className="text-[10px] bg-green-50 text-green-700 px-3 py-1.5 rounded-full font-bold border border-green-100 hover:bg-green-100 transition">CSV General</button>
         </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
         {sortedPatients.filter(p => !filterDoc || p.doctor === filterDoc || (filterDoc === 'Otro' && !DOCTORS.includes(p.doctor))).filter(p => !filterRes || p.resident === filterRes).map(p => (
            <div key={p.id} onClick={() => setSelectedPatient(p)} className={`p-4 rounded-xl border-l-[6px] shadow-sm cursor-pointer active:scale-[0.99] transition-all duration-200 bg-white ${getCardColor(p)}`}>
               <div className="flex justify-between items-start">
                  <div className="flex-1 pr-3">
                     <div className="flex items-center gap-2 mb-1.5">
                         <span className="text-2xl font-black text-slate-800 tracking-tight">{p.bed}</span>
                         <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${p.type==='NOVER'?'bg-slate-100 text-slate-500 border-slate-200':'bg-white border-slate-200 shadow-sm'}`}>{p.type}</span>
                         {p.preDischarge && <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-purple-200 bg-purple-600 text-white shadow-sm tracking-wider animate-pulse">PRE-ALTA</span>}
                     </div>
                     <h3 className="font-bold text-lg text-blue-900 leading-snug">{p.name}</h3>
                     <div className="text-sm font-medium text-slate-600 mt-1">{calculateAge(p.dob)} años • <span className="italic text-slate-500">{p.diagnosis}</span></div>
                     <div className="text-xs text-slate-400 flex justify-between bg-white/60 p-1.5 rounded-lg mt-2 border border-black/5">
                         <span className="font-semibold text-slate-600">{p.doctor}</span>
                         <span>{p.resident}</span>
                     </div>
                  </div>
                  <div className="flex flex-col items-end justify-between h-full gap-4 pt-1">
                      <button onClick={(e) => toggleStatus(e, p)} className="transform hover:scale-110 transition">{p.status === 'done' ? <CheckSquare size={32} className={p.type === 'SND' ? "text-green-600 drop-shadow-sm" : "text-blue-600 drop-shadow-sm"}/> : <Square size={32} className={p.type === 'SND' ? "text-orange-400 drop-shadow-sm" : "text-red-400 drop-shadow-sm"}/>}</button>
                      <div className="flex items-center gap-2">
                         <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{calculateLOS(p.admissionDate)}d</span>
                         <button onClick={(e) => dischargePatient(e, p)} className="bg-white p-1.5 rounded-full hover:bg-red-50 text-slate-300 hover:text-red-500 border border-slate-100 shadow-sm transition"><LogOut size={14}/></button>
                      </div>
                  </div>
               </div>
            </div>
         ))}
      </div>
      <button onClick={() => setShowAddModal(true)} className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-2xl hover:bg-blue-700 transition z-20 hover:scale-105 active:scale-95"><Plus size={28} /></button>
      {showAddModal && <PatientFormModal onClose={() => setShowAddModal(false)} mode="create" />}
    </div>
  );
}
