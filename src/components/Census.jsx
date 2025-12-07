import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { DOCTORS, RESIDENTS } from '../constants';
import { calculateLOS, downloadCSV, calculateAge } from '../utils';
import PatientDetail from './PatientDetail';
import { Search, Download, Plus, CheckSquare, Square, Filter } from 'lucide-react';

export default function Census({ user }) {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Filtros
  const [filterDoc, setFilterDoc] = useState('');
  const [filterRes, setFilterRes] = useState('');

  // Suscripción a Firestore (Tiempo Real)
  useEffect(() => {
    const q = query(collection(db, "patients"), orderBy("bed"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Filtrar solo pacientes activos (no egresados)
      setPatients(data.filter(p => !p.discharged));
    });
    return () => unsubscribe();
  }, []);

  const toggleStatus = async (e, p) => {
    e.stopPropagation();
    const newStatus = p.status === 'done' ? 'pending' : 'done';
    await updateDoc(doc(db, "patients", p.id), { status: newStatus });
  };

  const getCardColor = (p) => {
    if (p.hasPending) return "bg-yellow-50 border-yellow-500";
    if (p.status === 'done') return "bg-blue-50 border-blue-500";
    return "bg-red-50 border-red-500";
  };

  // Exportar DOP (Olvera)
  const exportDOP = () => {
    const data = patients
       .filter(p => p.doctor === "Dr. Olvera")
       .map(p => [p.bed, p.name, p.diagnosis, calculateLOS(p.admissionDate)]);
    downloadCSV(data, ["Cama", "Nombre", "Dx", "Dias"], "Censo_Dr_Olvera.csv");
  };

  // Exportar General
  const exportGeneral = () => {
    const data = patients.map(p => [
       p.bed, p.type, p.name, p.admissionDate, calculateLOS(p.admissionDate), 
       p.dob, calculateAge(p.dob), p.diagnosis, "N/A", "N/A", p.doctor
    ]);
    const headers = ["Cuarto", "IC/HO", "Nombre", "Fecha Ingreso", "Dias Estancia", "Fecha Nac", "Edad", "Dx", "Ultimos Labs", "Antibioticos", "Tratante"];
    downloadCSV(data, headers, "Censo_General.csv");
  };

  if (selectedPatient) {
    return <PatientDetail patient={selectedPatient} onClose={() => setSelectedPatient(null)} user={user} />;
  }

  return (
    <div className="pb-20">
      {/* Controls */}
      <div className="bg-white p-4 rounded-lg shadow-sm border mb-4 sticky top-0 z-10">
         <div className="flex gap-2 mb-3">
             <select className="flex-1 p-2 border rounded text-sm" value={filterDoc} onChange={e=>setFilterDoc(e.target.value)}>
                <option value="">Todos los Tratantes</option>
                {DOCTORS.map(d => <option key={d}>{d}</option>)}
             </select>
             <select className="flex-1 p-2 border rounded text-sm" value={filterRes} onChange={e=>setFilterRes(e.target.value)}>
                <option value="">Todos los Residentes</option>
                {RESIDENTS.map(r => <option key={r}>{r}</option>)}
             </select>
         </div>
         <div className="flex justify-between items-center">
             <div className="flex gap-2">
                <button onClick={exportDOP} className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold border border-blue-200">CSV Olvera</button>
                <button onClick={exportGeneral} className="px-3 py-1 bg-green-100 text-green-700 rounded text-xs font-bold border border-green-200">CSV General</button>
             </div>
         </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
         {patients
            .filter(p => !filterDoc || p.doctor === filterDoc)
            .filter(p => !filterRes || p.resident === filterRes)
            .map(p => (
            <div key={p.id} onClick={() => setSelectedPatient(p)} 
                 className={`p-4 rounded-lg border-l-8 shadow-sm relative cursor-pointer active:scale-95 transition ${getCardColor(p)}`}>
               <div className="flex justify-between items-start">
                  <div className="flex-1">
                     <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl font-black text-slate-700">{p.bed}</span>
                        <span className="text-xs font-bold bg-white px-2 py-0.5 rounded border shadow-sm">{p.type}</span>
                     </div>
                     <h3 className="font-bold text-lg text-blue-900 leading-tight">{p.name}</h3>
                     <div className="text-xs text-slate-500 mt-2 grid grid-cols-2">
                        <span>Tx: {p.doctor}</span>
                        <span>R: {p.resident}</span>
                     </div>
                     <div className="text-xs text-slate-400 mt-1">Estancia: {calculateLOS(p.admissionDate)} días</div>
                  </div>
                  <button onClick={(e) => toggleStatus(e, p)} className="p-2 hover:bg-white/50 rounded-full transition">
                      {p.status === 'done' 
                        ? <CheckSquare size={28} className="text-blue-600"/> 
                        : <Square size={28} className="text-red-400"/>}
                  </button>
               </div>
            </div>
         ))}
      </div>

      {/* FAB Add */}
      <button onClick={() => setShowAddModal(true)} 
              className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-xl hover:bg-blue-700 transition z-20">
         <Plus size={24} />
      </button>

      {/* Modal Add Patient */}
      {showAddModal && <AddPatientModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}

// Subcomponente para agregar paciente
function AddPatientModal({ onClose }) {
  const [form, setForm] = useState({
      name: '', bed: '', type: 'HO', doctor: '', resident: '', admissionDate: new Date().toISOString().split('T')[0], dob: '', diagnosis: ''
  });

  const handleSubmit = async (e) => {
      e.preventDefault();
      try {
          await addDoc(collection(db, "patients"), {
              ...form,
              status: 'pending',
              hasPending: false,
              discharged: false,
              notes: [],
              checklist: []
          });
          onClose();
      } catch (err) {
          alert("Error al guardar: " + err.message);
      }
  };

  return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">Nuevo Paciente</h2>
              <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="flex gap-2">
                      <input required placeholder="Cama" className="w-1/3 p-2 border rounded" value={form.bed} onChange={e=>setForm({...form, bed:e.target.value})} />
                      <select className="w-1/3 p-2 border rounded" value={form.type} onChange={e=>setForm({...form, type:e.target.value})}>
                          <option>HO</option><option>IC</option>
                      </select>
                  </div>
                  <input required placeholder="Nombre Completo" className="w-full p-2 border rounded" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
                  
                  <div className="grid grid-cols-2 gap-2">
                      <select required className="p-2 border rounded text-sm" value={form.doctor} onChange={e=>setForm({...form, doctor:e.target.value})}>
                          <option value="">Tratante...</option>
                          {DOCTORS.map(d=><option key={d} value={d}>{d}</option>)}
                      </select>
                      <select required className="p-2 border rounded text-sm" value={form.resident} onChange={e=>setForm({...form, resident:e.target.value})}>
                          <option value="">Residente...</option>
                          {RESIDENTS.map(r=><option key={r} value={r}>{r}</option>)}
                      </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                      <div>
                          <label className="text-xs text-gray-500">Ingreso</label>
                          <input type="date" required className="w-full p-2 border rounded text-sm" value={form.admissionDate} onChange={e=>setForm({...form, admissionDate:e.target.value})} />
                      </div>
                      <div>
                          <label className="text-xs text-gray-500">Nacimiento</label>
                          <input type="date" className="w-full p-2 border rounded text-sm" value={form.dob} onChange={e=>setForm({...form, dob:e.target.value})} />
                      </div>
                  </div>

                  <input required placeholder="Diagnóstico de Ingreso" className="w-full p-2 border rounded" value={form.diagnosis} onChange={e=>setForm({...form, diagnosis:e.target.value})} />

                  <div className="flex gap-2 mt-4">
                      <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded font-bold">Guardar</button>
                      <button type="button" onClick={onClose} className="flex-1 bg-gray-200 text-gray-800 py-2 rounded">Cancelar</button>
                  </div>
              </form>
          </div>
      </div>
  );
}
