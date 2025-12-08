import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, query, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { DOCTORS, RESIDENTS, LOCATIONS } from '../constants';
import { Plus, Trash2, Calendar, Download, Edit } from 'lucide-react';
import { downloadCSV } from '../utils';

export default function Surgery({ user }) {
  const [surgeries, setSurgeries] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingSurgery, setEditingSurgery] = useState(null);
  const [filterRes, setFilterRes] = useState('');

  useEffect(() => {
    const q = query(collection(db, "surgeries"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a,b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time));
      setSurgeries(data);
    });
    return () => unsubscribe();
  }, []);

  const handleDelete = async (id) => { if(confirm("¿Borrar cirugía?")) await deleteDoc(doc(db, "surgeries", id)); };

  const exportSurgeries = () => {
      const data = surgeries.map(s => [s.date, s.time, s.patientName, s.procedure, s.location, s.doctor, s.resident || 'Por Asignar']);
      downloadCSV(data, ["Fecha", "Hora", "Paciente", "Procedimiento", "Sede", "Tratante", "Residente"], "Historico_Quirofano.csv");
  };

  const handleEdit = (s) => {
      setEditingSurgery(s);
      setShowModal(true);
  };

  return (
    <div className="pb-24">
       <div className="flex flex-col gap-2 mb-4">
           <div className="flex justify-between items-center"><h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Calendar className="text-blue-600"/> Quirófano</h2><button onClick={exportSurgeries} className="bg-green-600 text-white text-xs px-3 py-1 rounded font-bold shadow flex gap-1 items-center"><Download size={14}/> CSV Histórico</button></div>
           <select className="border rounded p-1 text-xs w-full" value={filterRes} onChange={e=>setFilterRes(e.target.value)}><option value="">Todos los Residentes</option><option value="Por Asignar">Por Asignar</option>{RESIDENTS.map(r=><option key={r} value={r}>{r}</option>)}</select>
       </div>
       <div className="space-y-3">
           {surgeries.filter(s => { if(!filterRes) return true; if(filterRes === 'Por Asignar') return !s.resident; return s.resident === filterRes; }).map(s => (
               <div key={s.id} className="bg-white rounded-lg shadow-sm border-l-4 border-blue-600 p-3 relative">
                   <div className="flex justify-between text-xs text-gray-500 font-bold mb-1"><span>{new Date(s.date + 'T' + s.time).toLocaleDateString('es-MX', {weekday: 'short', day:'numeric', month:'short'})} - {s.time} hrs</span><span className="bg-blue-100 text-blue-800 px-2 rounded">{s.location}</span></div>
                   <h3 className="font-bold text-lg text-slate-800">{s.patientName}</h3>
                   <p className="text-blue-600 font-medium text-sm">{s.procedure}</p>
                   <div className="text-xs text-gray-500 mt-2 flex justify-between items-center"><span>Tx: {s.doctor}</span><span className={`px-2 py-0.5 rounded ${s.resident ? 'bg-slate-100' : 'bg-yellow-100 text-yellow-700 font-bold'}`}>R: {s.resident || 'POR ASIGNAR'}</span></div>
                   <div className="absolute bottom-2 right-2 flex gap-2">
                       <button onClick={()=>handleEdit(s)} className="text-blue-400 hover:text-blue-600"><Edit size={16}/></button>
                       <button onClick={()=>handleDelete(s.id)} className="text-red-300 hover:text-red-500"><Trash2 size={16}/></button>
                   </div>
               </div>
           ))}
           {surgeries.length === 0 && <p className="text-center text-gray-400 mt-10">No hay cirugías programadas.</p>}
       </div>
       <button onClick={()=>{setEditingSurgery(null); setShowModal(true)}} className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-xl hover:bg-blue-700 transition z-20"><Plus size={28} /></button>
       {showModal && <SurgeryModal onClose={()=>setShowModal(false)} initialData={editingSurgery} />}
    </div>
  );
}

function SurgeryModal({ onClose, initialData }) {
    const [form, setForm] = useState(initialData || { date: '', time: '', patientName: '', procedure: '', location: '', doctor: '', resident: '' });
    const [isOtherDoc, setIsOtherDoc] = useState(false);
    const [isOtherRes, setIsOtherRes] = useState(false);

    const handleSubmit = async (e) => { 
        e.preventDefault(); 
        try { 
            if (initialData) { await updateDoc(doc(db, "surgeries", initialData.id), form); } 
            else { await addDoc(collection(db, "surgeries"), form); }
            onClose(); 
        } catch(err) { alert(err.message); } 
    };

    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4 text-slate-800">{initialData ? 'Editar Cirugía' : 'Agendar Cirugía'}</h2>
              <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="flex gap-2"><input type="date" required className="flex-1 p-2 border rounded" value={form.date} onChange={e=>setForm({...form, date:e.target.value})} /><input type="time" required className="flex-1 p-2 border rounded" value={form.time} onChange={e=>setForm({...form, time:e.target.value})} /></div>
                  <select required className="w-full p-2 border rounded" value={form.location} onChange={e=>setForm({...form, location:e.target.value})}><option value="">Sede...</option>{LOCATIONS.map(l=><option key={l} value={l}>{l}</option>)}</select>
                  <input required placeholder="Paciente" className="w-full p-2 border rounded" value={form.patientName} onChange={e=>setForm({...form, patientName:e.target.value})} />
                  <input required placeholder="Procedimiento" className="w-full p-2 border rounded" value={form.procedure} onChange={e=>setForm({...form, procedure:e.target.value})} />
                  <div className="space-y-1">
                      <select required={!isOtherDoc} className="w-full p-2 border rounded text-xs" value={isOtherDoc ? 'Otro' : form.doctor} onChange={e=>{ if(e.target.value==='Otro') { setIsOtherDoc(true); setForm({...form, doctor: ''}); } else { setIsOtherDoc(false); setForm({...form, doctor:e.target.value}); }}}>
                          <option value="">Tratante</option>{DOCTORS.map(d=><option key={d} value={d}>{d}</option>)}<option value="Otro">Otro / Agregar...</option>
                      </select>
                      {isOtherDoc && <input placeholder="Nombre Tratante" required className="w-full p-2 border border-blue-300 bg-blue-50 rounded text-xs" value={form.doctor} onChange={e=>setForm({...form, doctor:e.target.value})}/>}
                  </div>
                  <div className="space-y-1">
                      <select className="w-full p-2 border rounded text-xs" value={isOtherRes ? 'Otro' : form.resident} onChange={e=>{ if(e.target.value==='Otro') { setIsOtherRes(true); setForm({...form, resident: ''}); } else { setIsOtherRes(false); setForm({...form, resident:e.target.value}); }}}>
                          <option value="">Residente (Opcional)</option>{RESIDENTS.map(r=><option key={r} value={r}>{r}</option>)}<option value="Otro">Otro / Agregar...</option>
                      </select>
                      {isOtherRes && <input placeholder="Nombre Residente" required className="w-full p-2 border border-blue-300 bg-blue-50 rounded text-xs" value={form.resident} onChange={e=>setForm({...form, resident:e.target.value})}/>}
                  </div>
                  <div className="flex gap-2 mt-4 pt-2 border-t"><button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-800 py-3 rounded font-bold">Cancelar</button><button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded font-bold shadow-lg">Guardar</button></div>
              </form>
          </div>
      </div>
    );
}

import { Undo } from 'lucide-react';

export function Discharges() {
  const [list, setList] = useState([]);
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

  return (
    <div className="pb-20">
       <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold text-slate-800">Historial de Egresos</h2><button onClick={exportHistory} className="bg-green-600 text-white text-xs px-3 py-2 rounded font-bold shadow">Descargar CSV</button></div>
       <div className="space-y-2">
           {list.map(p => (
               <div key={p.id} className="bg-white p-3 rounded shadow-sm border flex justify-between items-center opacity-75 hover:opacity-100 transition">
                   <div><p className="font-bold text-slate-700">{p.name}</p><p className="text-xs text-gray-500">Egreso: {new Date(p.dischargeDate).toLocaleDateString()}</p><p className="text-xs text-gray-400">{p.diagnosis}</p></div>
                   <div className="flex flex-col items-end gap-2">
                       <span className="text-xs font-bold bg-gray-100 px-2 py-1 rounded">{calculateLOS(p.admissionDate)} días</span>
                       <div className="flex gap-2">
                           <button onClick={()=>handleReadmit(p)} className="text-blue-500 bg-blue-50 p-1 rounded hover:bg-blue-200" title="Reingresar"><Undo size={14}/></button>
                           <button onClick={()=>handleDelete(p)} className="text-red-500 bg-red-50 p-1 rounded hover:bg-red-200" title="Eliminar Definitivamente"><Trash2 size={14}/></button>
                       </div>
                   </div>
               </div>
           ))}
           {list.length === 0 && <p className="text-center text-gray-400 mt-10">No hay egresos registrados aún.</p>}
       </div>
    </div>
  );
}
