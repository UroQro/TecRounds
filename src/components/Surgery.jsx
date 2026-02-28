import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, query, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Plus, Trash2, Calendar, Download, Edit, CheckCircle, XCircle } from 'lucide-react';
import { downloadCSV, getLocalISODate } from '../utils';

export default function Surgery({ user, dynamicResidents, dynamicDoctors, dynamicLocations }) {
  const [surgeries, setSurgeries] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingSurgery, setEditingSurgery] = useState(null);
  const [filterRes, setFilterRes] = useState('');

  // Fallback si no han cargado
  const resiList = dynamicResidents || [];

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
  const toggleComplete = async (s) => { await updateDoc(doc(db, "surgeries", s.id), { completed: !s.completed }); };
  const toggleCancel = async (s) => { if(confirm(s.cancelled ? "¿Reactivar cirugía?" : "¿Cancelar cirugía?")) { await updateDoc(doc(db, "surgeries", s.id), { cancelled: !s.cancelled }); } };
  
  const getStyle = (s) => {
      if (s.cancelled) return "bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 opacity-50"; 
      if (s.completed) return "bg-white dark:bg-green-900/30 border-l-[8px] border-green-600 dark:border-green-500 shadow-md"; 
      
      // LOCATION BASED COLORS
      if (s.location === 'HZH') return "bg-white dark:bg-blue-900/30 border-l-[8px] border-blue-600 dark:border-blue-600 shadow-md"; // BLUE FOR ZAMBRANO
      if (s.location === 'Instituto') return "bg-white dark:bg-orange-900/30 border-l-[8px] border-orange-500 dark:border-orange-500 shadow-md"; // ORANGE FOR INSTITUTE
      
      // DEFAULT / OTHERS
      return "bg-white dark:bg-slate-800 border-l-[8px] border-gray-400 dark:border-slate-600 shadow-md";
  };

  const getDayOpacity = (dateStr) => {
      const today = getLocalISODate();
      if (dateStr < today) return 'hidden'; 
      if (dateStr === today) return 'opacity-100'; 
      return 'opacity-75'; 
  };

  const today = getLocalISODate();
  let lastDate = null;
  const filteredList = surgeries.filter(s => { 
      if (s.date < today) return false; 
      if(!filterRes) return true; 
      if(filterRes === 'Por Asignar') return !s.resident; 
      return s.resident === filterRes || s.resident2 === filterRes; 
  });

  return (
    <div className="pb-24">
       <div className="flex flex-col gap-2 mb-4 bg-white dark:bg-slate-800 p-3 rounded border border-blue-100 dark:border-slate-700 shadow-md dark:shadow-sm transition-colors">
           <div className="flex justify-between items-center"><h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><Calendar className="text-blue-600 dark:text-blue-400"/> Quirófano</h2><button onClick={exportSurgeries} className="bg-green-600 text-white text-xs px-3 py-1 rounded font-bold shadow flex gap-1 items-center hover:bg-green-700"><Download size={14}/> CSV</button></div>
           <select className="border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-slate-900 dark:text-white rounded p-1 text-xs w-full" value={filterRes} onChange={e=>setFilterRes(e.target.value)}><option value="">Todos los Residentes</option><option value="Por Asignar">Por Asignar</option>{resiList.map(r=><option key={r} value={r}>{r}</option>)}</select>
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
                   {showHeader && <h3 className={`text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mt-6 mb-2 pl-1 border-b border-gray-200 dark:border-slate-700 pb-1 ${opacityClass}`}>{dateStr} {s.date === today && <span className="text-blue-600 dark:text-blue-400 ml-2">(HOY)</span>}</h3>}
                   <div className={`rounded-lg p-3 relative transition-all duration-300 ${getStyle(s)} ${opacityClass}`}>
                       <div className={`flex justify-between text-xs font-bold mb-1 ${s.cancelled ? 'text-gray-400 line-through' : 'text-gray-600 dark:text-slate-300'}`}><span>{s.time} hrs</span><span className="bg-gray-100 dark:bg-white/10 px-2 rounded uppercase">{s.location}</span></div>
                       <h3 className={`font-black text-lg leading-tight ${s.cancelled ? 'text-gray-400 line-through' : 'text-slate-900 dark:text-white'}`}>{s.patientName}</h3>
                       <p className={`font-bold text-sm mb-2 ${s.cancelled ? 'text-gray-400 line-through' : 'text-blue-700 dark:text-blue-300'}`}>{s.procedure}</p>
                       
                       <div className="flex flex-col gap-1 mt-2">
                           <div className={`text-xs flex justify-between items-center ${s.cancelled ? 'text-gray-600' : 'text-gray-500 dark:text-gray-400'}`}>
                               <span>Tx: {s.doctor}</span>
                           </div>
                           <div className="flex gap-2">
                               <span className={`px-2 py-0.5 rounded text-xs font-bold ${!s.resident ? 'bg-yellow-100 text-yellow-800' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200'}`}>
                                   {s.resident || 'No Asignado'}
                               </span>
                               {s.resident2 && (
                                   <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200">
                                       {s.resident2}
                                   </span>
                               )}
                           </div>
                       </div>

                       <div className="flex justify-end gap-3 mt-3 border-t border-gray-100 dark:border-white/10 pt-2">
                           <button onClick={()=>toggleComplete(s)} className="text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400 transition">{s.completed ? <CheckCircle className="text-green-600 dark:text-green-500 fill-green-100 dark:fill-transparent" size={20}/> : <CheckCircle size={20}/>}</button>
                           <button onClick={()=>toggleCancel(s)} className="text-gray-400 dark:text-gray-500 hover:text-red-500 transition">{s.cancelled ? <XCircle className="text-red-500" size={20}/> : <XCircle size={20}/>}</button>
                           <div className="w-px h-5 bg-gray-300 dark:bg-slate-600 mx-1"></div>
                           <button onClick={()=>handleEdit(s)} className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"><Edit size={18}/></button>
                           <button onClick={()=>handleDelete(s.id)} className="text-red-400 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300"><Trash2 size={18}/></button>
                       </div>
                   </div>
               </React.Fragment>
               );
           })}
           {filteredList.length === 0 && <p className="text-center text-gray-500 dark:text-slate-500 mt-10">No hay cirugías próximas.</p>}
       </div>
       <button onClick={()=>{setEditingSurgery(null); setShowModal(true)}} className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-xl hover:bg-blue-700 transition z-20"><Plus size={28} /></button>
       {showModal && <SurgeryModal onClose={()=>setShowModal(false)} initialData={editingSurgery} dynamicResidents={dynamicResidents} dynamicDoctors={dynamicDoctors} dynamicLocations={dynamicLocations} />}
    </div>
  );
}

function SurgeryModal({ onClose, initialData, dynamicResidents, dynamicDoctors, dynamicLocations }) {
    const [form, setForm] = useState(initialData || { date: '', time: '', patientName: '', procedure: '', location: '', doctor: '', resident: '', resident2: '', completed: false, cancelled: false });
    const [isOtherDoc, setIsOtherDoc] = useState(false);
    const [isOtherRes, setIsOtherRes] = useState(false);
    
    const resOptions = [...(dynamicResidents || [])];
    if (initialData && form.resident && !resOptions.includes(form.resident) && form.resident !== 'Otro') resOptions.push(form.resident);
    if (initialData && form.resident2 && !resOptions.includes(form.resident2)) resOptions.push(form.resident2);
    resOptions.sort();

    const docOptions = [...(dynamicDoctors || [])];
    if (initialData && form.doctor && !docOptions.includes(form.doctor) && form.doctor !== 'Otro') docOptions.push(form.doctor);
    docOptions.sort();

    const locOptions = [...(dynamicLocations || [])];
    if (initialData && form.location && !locOptions.includes(form.location) && form.location !== 'Otro') locOptions.push(form.location);
    locOptions.sort();

    useEffect(() => {
        if(initialData && !initialData.resident2) setForm(prev => ({...prev, resident2: ''}));
        if(initialData) {
            if(!docOptions.includes(initialData.doctor) && initialData.doctor) setIsOtherDoc(true);
            if(!resOptions.includes(initialData.resident) && initialData.resident) setIsOtherRes(true);
        }
    }, [initialData, docOptions, resOptions]);

    const handleSubmit = async (e) => { e.preventDefault(); try { if (initialData) { await updateDoc(doc(db, "surgeries", initialData.id), form); } else { await addDoc(collection(db, "surgeries"), form); } onClose(); } catch(err) { alert(err.message); } };
    
    const inputClass = "w-full p-2 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white bg-white dark:bg-slate-700";

    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto text-slate-900 dark:text-white">
              <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-white">{initialData ? 'Editar Cirugía' : 'Agendar Cirugía'}</h2>
              <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="flex gap-2"><input type="date" required className={`flex-1 ${inputClass}`} value={form.date} onChange={e=>setForm({...form, date:e.target.value})} /><input type="time" required className={`flex-1 ${inputClass}`} value={form.time} onChange={e=>setForm({...form, time:e.target.value})} /></div>
                  <select required className={inputClass} value={form.location} onChange={e=>setForm({...form, location:e.target.value})}><option value="">Sede...</option>{locOptions.map(l=><option key={l} value={l}>{l}</option>)}</select>
                  <input required placeholder="Paciente" className={inputClass} value={form.patientName} onChange={e=>setForm({...form, patientName:e.target.value})} />
                  <input required placeholder="Procedimiento" className={inputClass} value={form.procedure} onChange={e=>setForm({...form, procedure:e.target.value})} />
                  
                  {/* DOCTOR SELECT */}
                  <div className="space-y-1"><select required={!isOtherDoc} className={`text-xs ${inputClass}`} value={isOtherDoc ? 'Otro' : form.doctor} onChange={e=>{ if(e.target.value==='Otro') { setIsOtherDoc(true); setForm({...form, doctor: ''}); } else { setIsOtherDoc(false); setForm({...form, doctor:e.target.value}); }}}> <option value="">Tratante</option>{docOptions.map(d=><option key={d} value={d}>{d}</option>)}<option value="Otro">Otro / Agregar...</option></select>{isOtherDoc && <input placeholder="Nombre Tratante" required className={`text-xs bg-blue-50 ${inputClass}`} value={form.doctor} onChange={e=>setForm({...form, doctor:e.target.value})}/>}</div>
                  
                  {/* RESIDENT 1 SELECT */}
                  <div className="space-y-1"><label className="text-xs font-bold text-gray-500">Residente Principal</label><select className={`text-xs ${inputClass}`} value={isOtherRes ? 'Otro' : form.resident} onChange={e=>{ if(e.target.value==='Otro') { setIsOtherRes(true); setForm({...form, resident: ''}); } else { setIsOtherRes(false); setForm({...form, resident:e.target.value}); }}}> <option value="">No Asignado</option>{resOptions.map(r=><option key={r} value={r}>{r}</option>)}<option value="Otro">Otro / Agregar...</option></select>{isOtherRes && <input placeholder="Nombre Residente" required className={`text-xs bg-blue-50 ${inputClass}`} value={form.resident} onChange={e=>setForm({...form, resident:e.target.value})}/>}</div>
                  
                  {/* RESIDENT 2 SELECT */}
                  <div className="space-y-1"><label className="text-xs font-bold text-gray-500">2do Residente (Opcional)</label><select className={`text-xs ${inputClass}`} value={form.resident2 || ''} onChange={e=>setForm({...form, resident2:e.target.value})}> <option value="">Ninguno</option>{resOptions.map(r=><option key={r} value={r}>{r}</option>)}</select></div>

                  <div className="flex gap-2 mt-4 pt-2 border-t dark:border-slate-700"><button type="button" onClick={onClose} className="flex-1 bg-gray-100 dark:bg-slate-600 text-gray-800 dark:text-white py-3 rounded font-bold">Cancelar</button><button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded font-bold shadow-lg">Guardar</button></div>
              </form>
          </div>
      </div>
    );
}
