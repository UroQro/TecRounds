import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, query, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { DOCTORS, RESIDENTS, LOCATIONS } from '../constants';
import { Plus, Trash2, Calendar, Download, Edit, CheckCircle, XCircle } from 'lucide-react';
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
      const data = surgeries.map(s => [s.date, s.time, s.patientName, s.procedure, s.location, s.doctor, s.resident || 'Por Asignar', s.completed ? 'Si':'No']);
      downloadCSV(data, ["Fecha", "Hora", "Paciente", "Procedimiento", "Sede", "Tratante", "Residente", "Completada"], "Historico_Quirofano.csv");
  };

  const handleEdit = (s) => { setEditingSurgery(s); setShowModal(true); };

  const toggleComplete = async (s) => {
      await updateDoc(doc(db, "surgeries", s.id), { completed: !s.completed });
  };

  const toggleCancel = async (s) => {
      if(confirm(s.cancelled ? "¿Reactivar cirugía?" : "¿Cancelar cirugía?")) {
          await updateDoc(doc(db, "surgeries", s.id), { cancelled: !s.cancelled });
      }
  };

  const getStyle = (s) => {
      if (s.cancelled) return "bg-gray-50 border-gray-200 opacity-50"; 
      if (s.completed) {
         if (s.location === 'Instituto') return "bg-green-100 border-green-500";
         return "bg-blue-100 border-blue-600";
      }
      if (s.location === 'HZH') return "bg-red-50 border-red-500";
      if (s.location === 'Instituto') return "bg-orange-50 border-orange-500";
      return "bg-gray-100 border-gray-400";
  };

  const getDayOpacity = (dateStr) => {
      // Comparar fechas para opacidad
      const today = new Date().toISOString().split('T')[0];
      if (dateStr < today) return 'hidden'; // Ocultar pasado
      if (dateStr === today) return 'opacity-100'; // Hoy
      return 'opacity-60'; // Futuro
  };

  // Logic for grouping by date and filtering (Client Side)
  const today = new Date().toISOString().split('T')[0];
  let lastDate = null;
  
  // Filter list: hide past surgeries from view (but keep in DB)
  const filteredList = surgeries.filter(s => { 
      if (s.date < today) return false; // Hide past
      if(!filterRes) return true; 
      if(filterRes === 'Por Asignar') return !s.resident; 
      return s.resident === filterRes; 
  });

  return (
    <div className="pb-24">
       <div className="flex flex-col gap-2 mb-4">
           <div className="flex justify-between items-center"><h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Calendar className="text-blue-600"/> Quirófano</h2><button onClick={exportSurgeries} className="bg-green-600 text-white text-xs px-3 py-1 rounded font-bold shadow flex gap-1 items-center"><Download size={14}/> CSV Histórico</button></div>
           <select className="border rounded p-1 text-xs w-full" value={filterRes} onChange={e=>setFilterRes(e.target.value)}><option value="">Todos los Residentes</option><option value="Por Asignar">Por Asignar</option>{RESIDENTS.map(r=><option key={r} value={r}>{r}</option>)}</select>
       </div>
       <div className="space-y-3">
           {filteredList.map(s => {
               const dateObj = new Date(s.date + 'T12:00:00');
               const dateStr = dateObj.toLocaleDateString('es-MX', {weekday: 'long', day: 'numeric', month: 'long'});
               const showHeader = s.date !== lastDate;
               lastDate = s.date;
               const opacityClass = getDayOpacity(s.date);

               return (
               <React.Fragment key={s.id}>
                   {showHeader && (
                       <h3 className={`text-xs font-bold text-gray-500 uppercase mt-6 mb-2 pl-1 border-b border-gray-200 pb-1 ${opacityClass}`}>
                           {dateStr} {s.date === today && <span className="text-blue-600 ml-2">(HOY)</span>}
                       </h3>
                   )}
                   <div className={`rounded-lg shadow-sm border-l-8 p-3 relative transition-all duration-300 ${getStyle(s)} ${opacityClass}`}>
                       
                       <div className={`flex justify-between text-xs font-bold mb-1 ${s.cancelled ? 'text-gray-400 line-through' : 'text-gray-600'}`}>
                           <span>{s.time} hrs</span>
                           <span className="bg-white/50 px-2 rounded">{s.location}</span>
                       </div>

                       <h3 className={`font-bold text-lg leading-tight ${s.cancelled ? 'text-gray-400 line-through' : 'text-slate-800'}`}>{s.patientName}</h3>
                       <p className={`font-medium text-sm mb-2 ${s.cancelled ? 'text-gray-400 line-through' : 'text-blue-900'}`}>{s.procedure}</p>
                       
                       <div className={`text-xs mt-1 flex justify-between items-center ${s.cancelled ? 'text-gray-300' : 'text-gray-500'}`}>
                           <span>Tx: {s.doctor}</span>
                           <span className={`px-2 py-0.5 rounded ${!s.resident && !s.cancelled ? 'bg-yellow-100 text-yellow-700 font-bold' : ''}`}>
                               R: {s.resident || 'NO ASIGNADO'}
                           </span>
                       </div>

                       <div className="flex justify-end gap-3 mt-3 border-t border-black/5 pt-2">
                           <button onClick={()=>toggleComplete(s)} className="text-gray-400 hover:text-green-600 transition" title="Terminar/Pendiente">
                               {s.completed ? <CheckCircle className="text-green-600 fill-green-100" size={20}/> : <CheckCircle size={20}/>}
                           </button>
                           
                           <button onClick={()=>toggleCancel(s)} className="text-gray-400 hover:text-red-500 transition" title="Cancelar">
                               {s.cancelled ? <XCircle className="text-red-500" size={20}/> : <XCircle size={20}/>}
                           </button>

                           <div className="w-px h-5 bg-gray-300 mx-1"></div>

                           <button onClick={()=>handleEdit(s)} className="text-blue-400 hover:text-blue-600"><Edit size={18}/></button>
                           <button onClick={()=>handleDelete(s.id)} className="text-red-300 hover:text-red-500"><Trash2 size={18}/></button>
                       </div>
                   </div>
               </React.Fragment>
               );
           })}
           {filteredList.length === 0 && <p className="text-center text-gray-400 mt-10">No hay cirugías próximas.</p>}
       </div>
       <button onClick={()=>{setEditingSurgery(null); setShowModal(true)}} className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-xl hover:bg-blue-700 transition z-20"><Plus size={28} /></button>
       {showModal && <SurgeryModal onClose={()=>setShowModal(false)} initialData={editingSurgery} />}
    </div>
  );
}

function SurgeryModal({ onClose, initialData }) {
    const [form, setForm] = useState(initialData || { date: '', time: '', patientName: '', procedure: '', location: '', doctor: '', resident: '', completed: false, cancelled: false });
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
                          <option value="">No Asignado</option>{RESIDENTS.map(r=><option key={r} value={r}>{r}</option>)}<option value="Otro">Otro / Agregar...</option>
                      </select>
                      {isOtherRes && <input placeholder="Nombre Residente" required className="w-full p-2 border border-blue-300 bg-blue-50 rounded text-xs" value={form.resident} onChange={e=>setForm({...form, resident:e.target.value})}/>}
                  </div>
                  <div className="flex gap-2 mt-4 pt-2 border-t"><button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-800 py-3 rounded font-bold">Cancelar</button><button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded font-bold shadow-lg">Guardar</button></div>
              </form>
          </div>
      </div>
    );
}
