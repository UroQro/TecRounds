import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, query, orderBy } from 'firebase/firestore';
import { DOCTORS, RESIDENTS } from '../constants';
import { calculateLOS, downloadCSV, calculateAge } from '../utils';
import PatientDetail from './PatientDetail';
import { Plus, CheckSquare, Square, Search, LogOut } from 'lucide-react';

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

  const toggleStatus = async (e, p) => {
    e.stopPropagation();
    const newStatus = p.status === 'done' ? 'pending' : 'done';
    await updateDoc(doc(db, "patients", p.id), { status: newStatus });
  };

  const dischargePatient = async (e, p) => {
      e.stopPropagation();
      if(confirm(`¿Egresar (Dar de Alta) a ${p.name}?`)) {
          await updateDoc(doc(db, "patients", p.id), { 
              discharged: true, 
              dischargeDate: new Date().toISOString() 
          });
      }
  };

  const getCardColor = (p) => {
    if (p.hasPending) return "bg-yellow-50 border-yellow-500";
    if (p.status === 'done') return "bg-blue-50 border-blue-500";
    return "bg-red-50 border-red-500";
  };

  const exportDOP = () => {
    const data = patients.filter(p => p.doctor === "Dr. Olvera").map(p => [p.bed, p.name, p.diagnosis, calculateLOS(p.admissionDate)]);
    downloadCSV(data, ["Cama", "Nombre", "Dx", "Dias"], "Censo_Dr_Olvera.csv");
  };

  const exportGeneral = () => {
    const data = patients.map(p => [
       p.bed, p.type, p.name, p.admissionDate, calculateLOS(p.admissionDate), 
       p.dob, calculateAge(p.dob), p.diagnosis, p.doctor
    ]);
    downloadCSV(data, ["Cuarto", "IC/HO", "Nombre", "Ingreso", "Dias", "Nacimiento", "Edad", "Dx", "Tratante"], "Censo_General.csv");
  };

  if (selectedPatient) return <PatientDetail patient={selectedPatient} onClose={() => setSelectedPatient(null)} user={user} />;

  return (
    <div className="pb-24">
      <div className="bg-white p-3 rounded-lg shadow-sm border mb-3 sticky top-0 z-10">
         <div className="flex gap-2 mb-2">
             <select className="flex-1 p-2 border rounded text-xs bg-slate-50" value={filterDoc} onChange={e=>setFilterDoc(e.target.value)}>
                <option value="">Todos los Tratantes</option>
                {DOCTORS.map(d => <option key={d}>{d}</option>)}
                <option value="Otro">Otro...</option>
             </select>
             <select className="flex-1 p-2 border rounded text-xs bg-slate-50" value={filterRes} onChange={e=>setFilterRes(e.target.value)}>
                <option value="">Todos los Residentes</option>
                {RESIDENTS.map(r => <option key={r}>{r}</option>)}
             </select>
         </div>
         <div className="flex gap-2">
            <button onClick={exportDOP} className="flex-1 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold border border-blue-200">CSV Olvera</button>
            <button onClick={exportGeneral} className="flex-1 py-1 bg-green-100 text-green-700 rounded text-xs font-bold border border-green-200">CSV General</button>
         </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
         {patients
            .filter(p => !filterDoc || p.doctor === filterDoc || (filterDoc === 'Otro' && !DOCTORS.includes(p.doctor)))
            .filter(p => !filterRes || p.resident === filterRes)
            .map(p => (
            <div key={p.id} onClick={() => setSelectedPatient(p)} 
                 className={`p-3 rounded-lg border-l-8 shadow-sm cursor-pointer active:scale-95 transition ${getCardColor(p)}`}>
               <div className="flex justify-between items-start">
                  <div className="flex-1 pr-2">
                     <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl font-black text-slate-800">{p.bed}</span>
                        <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded border shadow-sm uppercase tracking-wider">{p.type}</span>
                     </div>
                     <h3 className="font-bold text-lg text-blue-900 leading-tight mb-1">{p.name}</h3>
                     <div className="text-xs text-slate-600 flex justify-between bg-white/50 p-1 rounded">
                        <span>{p.doctor}</span>
                        <span className="font-semibold">{p.resident}</span>
                     </div>
                  </div>
                  <div className="flex flex-col items-end justify-between h-full gap-2">
                      <button onClick={(e) => toggleStatus(e, p)} className="">
                          {p.status === 'done' ? <CheckSquare size={30} className="text-blue-600"/> : <Square size={30} className="text-red-400"/>}
                      </button>
                      
                      <div className="flex items-center gap-2 mt-2">
                         <span className="text-[10px] font-bold text-slate-400">{calculateLOS(p.admissionDate)}d</span>
                         <button onClick={(e) => dischargePatient(e, p)} className="bg-slate-100 p-1 rounded hover:bg-red-100 text-slate-500 hover:text-red-500 border">
                             <LogOut size={14}/>
                         </button>
                      </div>
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

export function PatientFormModal({ onClose, mode, initialData }) {
  const [form, setForm] = useState(initialData || { 
      name: '', bed: '', type: 'HO', doctor: '', resident: '', admissionDate: new Date().toISOString().split('T')[0], dob: '', diagnosis: '',
      antecedents: { dm: false, has: false, cancer: false, other: '' },
      allergies: ''
  });
  
  const [isOtherDoc, setIsOtherDoc] = useState(false);
  const [isOtherRes, setIsOtherRes] = useState(false);

  useEffect(() => {
     if(mode === 'edit' && initialData) {
         if(!DOCTORS.includes(initialData.doctor) && initialData.doctor) setIsOtherDoc(true);
         if(!RESIDENTS.includes(initialData.resident) && initialData.resident) setIsOtherRes(true);
     }
  }, [mode, initialData]);

  const handleSubmit = async (e) => {
      e.preventDefault();
      try {
          if (mode === 'create') {
            await addDoc(collection(db, "patients"), { ...form, status: 'pending', hasPending: false, discharged: false, notes: [], checklist: [] });
          } else {
            await updateDoc(doc(db, "patients", form.id), form);
          }
          onClose();
      } catch (err) { alert("Error: " + err.message); }
  };

  return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4 text-slate-800">{mode==='create'?'Nuevo Paciente':'Editar Paciente'}</h2>
              <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="flex gap-2">
                      <input required placeholder="Cama" className="w-1/3 p-2 border rounded" value={form.bed} onChange={e=>setForm({...form, bed:e.target.value})} />
                      <select className="w-1/3 p-2 border rounded" value={form.type} onChange={e=>setForm({...form, type:e.target.value})}><option>HO</option><option>IC</option></select>
                  </div>
                  <input required placeholder="Nombre Completo" className="w-full p-2 border rounded" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
                  
                  {/* ANTECEDENTES Y ALERGIAS (NUEVO) */}
                  <div className="bg-slate-50 p-2 rounded border">
                      <p className="text-xs font-bold text-gray-500 mb-1">Antecedentes</p>
                      <div className="flex gap-2 mb-2 text-sm">
                         <label className="flex items-center gap-1"><input type="checkbox" checked={form.antecedents.dm} onChange={e=>setForm({...form, antecedents: {...form.antecedents, dm:e.target.checked}})}/> DM</label>
                         <label className="flex items-center gap-1"><input type="checkbox" checked={form.antecedents.has} onChange={e=>setForm({...form, antecedents: {...form.antecedents, has:e.target.checked}})}/> HAS</label>
                         <label className="flex items-center gap-1"><input type="checkbox" checked={form.antecedents.cancer} onChange={e=>setForm({...form, antecedents: {...form.antecedents, cancer:e.target.checked}})}/> Onco</label>
                      </div>
                      <input placeholder="Otros antecedentes..." className="w-full p-1 border rounded text-xs mb-2" value={form.antecedents.other} onChange={e=>setForm({...form, antecedents: {...form.antecedents, other:e.target.value}})} />
                      <input placeholder="Alergias (Negar o especificar)" className="w-full p-1 border rounded text-xs border-red-200" value={form.allergies} onChange={e=>setForm({...form, allergies:e.target.value})} />
                  </div>

                  <div className="space-y-1">
                      <select required={!isOtherDoc} className="w-full p-2 border rounded text-xs" 
                              value={isOtherDoc ? 'Otro' : form.doctor} 
                              onChange={e=>{
                                  if(e.target.value==='Otro') { setIsOtherDoc(true); setForm({...form, doctor: ''}); }
                                  else { setIsOtherDoc(false); setForm({...form, doctor:e.target.value}); }
                              }}>
                          <option value="">Seleccionar Tratante...</option>
                          {DOCTORS.map(d=><option key={d} value={d}>{d}</option>)}
                          <option value="Otro">Otro / Agregar Nuevo</option>
                      </select>
                      {isOtherDoc && <input placeholder="Escribe nombre del Tratante" className="w-full p-2 border border-blue-300 rounded text-xs bg-blue-50" value={form.doctor} onChange={e=>setForm({...form, doctor:e.target.value})} required />}
                  </div>

                  <div className="space-y-1">
                      <select required={!isOtherRes} className="w-full p-2 border rounded text-xs" 
                              value={isOtherRes ? 'Otro' : form.resident} 
                              onChange={e=>{
                                  if(e.target.value==='Otro') { setIsOtherRes(true); setForm({...form, resident: ''}); }
                                  else { setIsOtherRes(false); setForm({...form, resident:e.target.value}); }
                              }}>
                          <option value="">Seleccionar Residente...</option>
                          {RESIDENTS.map(r=><option key={r} value={r}>{r}</option>)}
                          <option value="Otro">Otro / Agregar Nuevo</option>
                      </select>
                      {isOtherRes && <input placeholder="Escribe nombre del Residente" className="w-full p-2 border border-blue-300 rounded text-xs bg-blue-50" value={form.resident} onChange={e=>setForm({...form, resident:e.target.value})} required />}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col"><label className="text-[10px] text-gray-500">Ingreso</label><input type="date" required className="p-2 border rounded text-xs" value={form.admissionDate} onChange={e=>setForm({...form, admissionDate:e.target.value})} /></div>
                      <div className="flex flex-col"><label className="text-[10px] text-gray-500">Nacimiento</label><input type="date" className="p-2 border rounded text-xs" value={form.dob} onChange={e=>setForm({...form, dob:e.target.value})} /></div>
                  </div>
                  <input required placeholder="Diagnóstico" className="w-full p-2 border rounded" value={form.diagnosis} onChange={e=>setForm({...form, diagnosis:e.target.value})} />
                  
                  <div className="flex gap-2 mt-4 pt-2 border-t">
                      <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-800 py-3 rounded font-bold">Cancelar</button>
                      <button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded font-bold shadow-lg">Guardar</button>
                  </div>
              </form>
          </div>
      </div>
  );
}
