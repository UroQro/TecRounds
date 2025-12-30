import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, updateDoc, doc, query, orderBy } from 'firebase/firestore';
import { DOCTORS, RESIDENTS } from '../constants';
import { calculateLOS, downloadCSV, calculateAge } from '../utils';
import PatientDetail from './PatientDetail';
import PatientFormModal from './PatientFormModal';
import { Plus, CheckSquare, Square, LogOut } from 'lucide-react';

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

  // COLORS
  const getCardColor = (p) => {
    if (p.type === 'NOVER') return "bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-400";
    if (p.preDischarge) return "bg-white dark:bg-purple-900/30 border-l-[8px] border-purple-600 dark:border-purple-500 shadow-md";
    if (p.hasPending) return "bg-white dark:bg-yellow-900/30 border-l-[8px] border-yellow-500 dark:border-yellow-500 shadow-md";
    if (p.type === 'SND') { return p.status === 'done' ? "bg-white dark:bg-green-900/30 border-l-[8px] border-green-600 dark:border-green-500 shadow-md" : "bg-white dark:bg-orange-900/30 border-l-[8px] border-orange-500 dark:border-orange-500 shadow-md"; }
    return p.status === 'done' ? "bg-white dark:bg-blue-900/30 border-l-[8px] border-blue-600 dark:border-blue-500 shadow-md" : "bg-white dark:bg-slate-800 border-l-[8px] border-red-600 dark:border-red-500 shadow-md";
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
      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-md border border-blue-100 dark:border-slate-700 mb-3 sticky top-0 z-10 transition-colors">
         <div className="flex gap-2 mb-2">
             <select className="flex-1 p-2 border rounded text-xs bg-slate-50 dark:bg-slate-700 dark:text-white dark:border-slate-600" value={filterDoc} onChange={e=>setFilterDoc(e.target.value)}><option value="">Todos los Tratantes</option>{DOCTORS.map(d => <option key={d}>{d}</option>)}<option value="Otro">Otro...</option></select>
             <select className="flex-1 p-2 border rounded text-xs bg-slate-50 dark:bg-slate-700 dark:text-white dark:border-slate-600" value={filterRes} onChange={e=>setFilterRes(e.target.value)}><option value="">Todos los Residentes</option>{RESIDENTS.map(r => <option key={r}>{r}</option>)}</select>
         </div>
         <div className="flex gap-2"><button onClick={exportDOP} className="flex-1 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-200 rounded text-xs font-bold border border-blue-200 dark:border-blue-700">CSV DOP</button><button onClick={exportGeneral} className="flex-1 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-200 rounded text-xs font-bold border border-green-200 dark:border-green-700">CSV General</button></div>
      </div>
      <div className="grid grid-cols-1 gap-3">
         {sortedPatients.filter(p => !filterDoc || p.doctor === filterDoc || (filterDoc === 'Otro' && !DOCTORS.includes(p.doctor))).filter(p => !filterRes || p.resident === filterRes).map(p => (
            <div key={p.id} onClick={() => setSelectedPatient(p)} className={`p-3 rounded-lg cursor-pointer active:scale-95 transition ${getCardColor(p)}`}>
               <div className="flex justify-between items-start">
                  <div className="flex-1 pr-2">
                     <div className="flex items-center gap-2 mb-1"><span className="text-xl font-black text-slate-800 dark:text-slate-200">{p.bed}</span><span className={`text-[10px] font-bold px-2 py-0.5 rounded border border-black/10 dark:border-white/10 uppercase tracking-wider ${p.type==='NOVER'?'bg-gray-100 dark:bg-slate-700 text-gray-500':'bg-white dark:bg-slate-800 dark:text-white'}`}>{p.type}</span></div>
                     <h3 className="font-extrabold text-lg text-blue-700 dark:text-blue-300 leading-tight mb-1">{p.name}</h3>
                     <p className="text-xs opacity-75 mb-1 dark:text-slate-300 text-gray-700">{calculateAge(p.dob)} años • {p.diagnosis}</p>
                     <div className="text-xs opacity-75 flex justify-between bg-black/5 dark:bg-white/5 p-1 rounded dark:text-slate-400 text-slate-600"><span>{p.doctor}</span><span className="font-semibold">{p.resident}</span></div>
                  </div>
                  <div className="flex flex-col items-end justify-between h-full gap-2">
                      <button onClick={(e) => toggleStatus(e, p)} className="">{p.status === 'done' ? <CheckSquare size={30} className={p.type === 'SND' ? "text-green-500 dark:text-green-400" : "text-blue-500 dark:text-blue-400"}/> : <Square size={30} className={p.type === 'SND' ? "text-orange-500" : "text-red-500"}/>}</button>
                      <div className="flex items-center gap-2 mt-2"><span className="text-[10px] font-bold opacity-60 text-slate-800 dark:text-slate-200">{calculateLOS(p.admissionDate)}d</span><button onClick={(e) => dischargePatient(e, p)} className="bg-black/10 dark:bg-white/10 p-1 rounded hover:bg-red-100 hover:text-red-500 dark:text-slate-300"><LogOut size={14}/></button></div>
                  </div>
               </div>
            </div>
         ))}
      </div>
      <button onClick={() => setShowAddModal(true)} className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-xl hover:bg-blue-700 transition z-20"><Plus size={28} /></button>
      {showAddModal && <PatientFormModal onClose={() => setShowAddModal(false)} mode="create" />}
    </div>
  );
}
