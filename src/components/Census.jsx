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

  const getCardColor = (p) => {
    if (p.type === 'NOVER') return "bg-white border-gray-200";
    if (p.preDischarge) return "bg-purple-100 border-purple-500";
    if (p.hasPending) return "bg-yellow-50 border-yellow-500";
    if (p.type === 'SND') { return p.status === 'done' ? "bg-green-50 border-green-500" : "bg-orange-50 border-orange-500"; }
    return p.status === 'done' ? "bg-blue-50 border-blue-500" : "bg-red-50 border-red-500";
  };

  const exportDOP = () => { const data = patients.filter(p => p.doctor === "Dr. Olvera").map(p => [p.bed, p.name, p.diagnosis, calculateLOS(p.admissionDate)]); downloadCSV(data, ["Cama", "Nombre", "Dx", "Dias"], "Censo_Dr_Olvera.csv"); };
  const exportGeneral = () => { const data = patients.map(p => [p.bed, p.type, p.name, p.admissionDate, calculateLOS(p.admissionDate), p.dob, calculateAge(p.dob), p.diagnosis, p.doctor]); downloadCSV(data, ["Cuarto", "IC/HO", "Nombre", "Ingreso", "Dias", "Nacimiento", "Edad", "Dx", "Tratante"], "Censo_General.csv"); };

  if (selectedPatient) return <PatientDetail patient={selectedPatient} onClose={() => setSelectedPatient(null)} user={user} />;

  // SORT: NOVER al final
  const sortedPatients = [...patients].sort((a, b) => {
      if (a.type === 'NOVER' && b.type !== 'NOVER') return 1;
      if (a.type !== 'NOVER' && b.type === 'NOVER') return -1;
      return 0;
  });

  return (
    <div className="pb-24">
      <div className="bg-white p-3 rounded-lg shadow-sm border mb-3 sticky top-0 z-10">
         <div className="flex gap-2 mb-2">
             <select className="flex-1 p-2 border rounded text-xs bg-slate-50" value={filterDoc} onChange={e=>setFilterDoc(e.target.value)}><option value="">Todos los Tratantes</option>{DOCTORS.map(d => <option key={d}>{d}</option>)}<option value="Otro">Otro...</option></select>
             <select className="flex-1 p-2 border rounded text-xs bg-slate-50" value={filterRes} onChange={e=>setFilterRes(e.target.value)}><option value="">Todos los Residentes</option>{RESIDENTS.map(r => <option key={r}>{r}</option>)}</select>
         </div>
         <div className="flex gap-2"><button onClick={exportDOP} className="flex-1 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold border border-blue-200">CSV Olvera</button><button onClick={exportGeneral} className="flex-1 py-1 bg-green-100 text-green-700 rounded text-xs font-bold border border-green-200">CSV General</button></div>
      </div>
      <div className="grid grid-cols-1 gap-3">
         {sortedPatients.filter(p => !filterDoc || p.doctor === filterDoc || (filterDoc === 'Otro' && !DOCTORS.includes(p.doctor))).filter(p => !filterRes || p.resident === filterRes).map(p => (
            <div key={p.id} onClick={() => setSelectedPatient(p)} className={`p-3 rounded-lg border-l-8 shadow-sm cursor-pointer active:scale-95 transition ${getCardColor(p)}`}>
               <div className="flex justify-between items-start">
                  <div className="flex-1 pr-2">
                     <div className="flex items-center gap-2 mb-1"><span className="text-xl font-black text-slate-800">{p.bed}</span><span className={`text-[10px] font-bold px-2 py-0.5 rounded border shadow-sm uppercase tracking-wider ${p.type==='NOVER'?'bg-gray-100 text-gray-500':'bg-white'}`}>{p.type}</span></div>
                     <h3 className="font-bold text-lg text-blue-900 leading-tight mb-1">{p.name}</h3>
                     <p className="text-xs text-gray-600 mb-1">{calculateAge(p.dob)} años • {p.diagnosis}</p>
                     <div className="text-xs text-slate-600 flex justify-between bg-white/50 p-1 rounded"><span>{p.doctor}</span><span className="font-semibold">{p.resident}</span></div>
                  </div>
                  <div className="flex flex-col items-end justify-between h-full gap-2">
                      <button onClick={(e) => toggleStatus(e, p)} className="">{p.status === 'done' ? <CheckSquare size={30} className={p.type === 'SND' ? "text-green-600" : "text-blue-600"}/> : <Square size={30} className={p.type === 'SND' ? "text-orange-400" : "text-red-400"}/>}</button>
                      <div className="flex items-center gap-2 mt-2"><span className="text-[10px] font-bold text-slate-400">{calculateLOS(p.admissionDate)}d</span><button onClick={(e) => dischargePatient(e, p)} className="bg-slate-100 p-1 rounded hover:bg-red-100 text-slate-500 hover:text-red-500 border"><LogOut size={14}/></button></div>
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
