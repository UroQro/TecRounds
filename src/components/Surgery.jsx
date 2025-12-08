import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { DOCTORS, RESIDENTS, LOCATIONS } from '../constants';
import { Plus, Trash2, Calendar, Filter } from 'lucide-react';

export default function Surgery({ user }) {
  const [surgeries, setSurgeries] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [filterRes, setFilterRes] = useState('');

  useEffect(() => {
    const q = query(collection(db, "surgeries"), orderBy("date"), orderBy("time"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSurgeries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const handleDelete = async (id) => {
      if(confirm("¿Borrar cirugía?")) await deleteDoc(doc(db, "surgeries", id));
  };

  return (
    <div className="pb-24">
       <div className="flex justify-between items-center mb-4">
           <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Calendar className="text-blue-600"/> Quirófano</h2>
           <select className="border rounded p-1 text-xs" value={filterRes} onChange={e=>setFilterRes(e.target.value)}>
               <option value="">Todos los Residentes</option>
               <option value="Por Asignar">Por Asignar</option>
               {RESIDENTS.map(r=><option key={r} value={r}>{r}</option>)}
           </select>
       </div>
       
       <div className="space-y-3">
           {surgeries
               .filter(s => {
                   if(!filterRes) return true;
                   if(filterRes === 'Por Asignar') return !s.resident;
                   return s.resident === filterRes;
               })
               .map(s => (
               <div key={s.id} className="bg-white rounded-lg shadow-sm border-l-4 border-blue-600 p-3 relative">
                   <div className="flex justify-between text-xs text-gray-500 font-bold mb-1">
                       <span>{new Date(s.date + 'T' + s.time).toLocaleDateString('es-MX', {weekday: 'short', day:'numeric', month:'short'})} - {s.time} hrs</span>
                       <span className="bg-blue-100 text-blue-800 px-2 rounded">{s.location}</span>
                   </div>
                   <h3 className="font-bold text-lg text-slate-800">{s.patientName}</h3>
                   <p className="text-blue-600 font-medium text-sm">{s.procedure}</p>
                   <div className="text-xs text-gray-500 mt-2 flex justify-between items-center">
                       <span>Tx: {s.doctor}</span>
                       <span className={`px-2 py-0.5 rounded ${s.resident ? 'bg-slate-100' : 'bg-yellow-100 text-yellow-700 font-bold'}`}>
                           R: {s.resident || 'POR ASIGNAR'}
                       </span>
                   </div>
                   <button onClick={()=>handleDelete(s.id)} className="absolute bottom-2 right-2 text-red-300 hover:text-red-500"><Trash2 size={16}/></button>
               </div>
           ))}
           {surgeries.length === 0 && <p className="text-center text-gray-400 mt-10">No hay cirugías programadas.</p>}
       </div>

       <button onClick={()=>setShowModal(true)} className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-xl hover:bg-blue-700 transition z-20"><Plus size={28} /></button>
       {showModal && <SurgeryModal onClose={()=>setShowModal(false)} />}
    </div>
  );
}

function SurgeryModal({ onClose }) {
    const [form, setForm] = useState({ date: '', time: '', patientName: '', procedure: '', location: '', doctor: '', resident: '' });
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await addDoc(collection(db, "surgeries"), form);
            onClose();
        } catch(err) { alert(err.message); }
    };

    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4 text-slate-800">Agendar Cirugía</h2>
              <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="flex gap-2">
                      <input type="date" required className="flex-1 p-2 border rounded" onChange={e=>setForm({...form, date:e.target.value})} />
                      <input type="time" required className="flex-1 p-2 border rounded" onChange={e=>setForm({...form, time:e.target.value})} />
                  </div>
                  <select required className="w-full p-2 border rounded" onChange={e=>setForm({...form, location:e.target.value})}>
                      <option value="">Sede...</option>
                      {LOCATIONS.map(l=><option key={l} value={l}>{l}</option>)}
                  </select>
                  <input required placeholder="Paciente" className="w-full p-2 border rounded" onChange={e=>setForm({...form, patientName:e.target.value})} />
                  <input required placeholder="Procedimiento" className="w-full p-2 border rounded" onChange={e=>setForm({...form, procedure:e.target.value})} />
                  
                  <div className="grid grid-cols-2 gap-2">
                      <select required className="p-2 border rounded text-xs" onChange={e=>setForm({...form, doctor:e.target.value})}><option value="">Tratante</option>{DOCTORS.map(d=><option key={d} value={d}>{d}</option>)}</select>
                      <select className="p-2 border rounded text-xs" onChange={e=>setForm({...form, resident:e.target.value})}>
                          <option value="">Residente (Opcional)</option>
                          {RESIDENTS.map(r=><option key={r} value={r}>{r}</option>)}
                      </select>
                  </div>

                  <div className="flex gap-2 mt-4 pt-2 border-t">
                      <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-800 py-3 rounded font-bold">Cancelar</button>
                      <button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded font-bold shadow-lg">Agendar</button>
                  </div>
              </form>
          </div>
      </div>
    );
}
