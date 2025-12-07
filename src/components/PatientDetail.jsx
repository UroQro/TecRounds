import React, { useState } from 'react';
import Fishbone from './Fishbone';
import { ArrowLeft, Save, Copy } from 'lucide-react';

const PatientDetail = ({ patient, onBack, onUpdate, user }) => {
  const [tab, setTab] = useState('notes');
  const [noteForm, setNoteForm] = useState({ 
      subj: '', ta: '', fc: '', temp: '', gu: '', drains: '', 
      labs: { na:'', cl:'', bun:'', glu:'', k:'', co2:'', cr:'' } 
  });
  const [newTask, setNewTask] = useState('');

  const handleSaveNote = () => {
     if(!noteForm.subj) return alert("Escribe el subjetivo");
     const newEntry = {
        id: Date.now(),
        author: user?.name,
        date: new Date().toISOString(),
        content: noteForm,
        type: 'visita'
     };
     const updated = { ...patient, notes: [newEntry, ...(patient.notes || [])] };
     onUpdate(updated);
     setNoteForm({ subj: '', ta: '', fc: '', temp: '', gu: '', drains: '', labs: {} });
     alert("Nota guardada");
  };

  const copyMSJ = () => {
      const txt = `Pac: ${patient.name}\nSubj: ${noteForm.subj}\nSV: ${noteForm.ta} ${noteForm.fc}\nGU: ${noteForm.gu}`;
      navigator.clipboard.writeText(txt);
      alert("Copiado al portapapeles");
  };

  const addTask = () => {
      if(!newTask) return;
      const updated = { ...patient, checklist: [...(patient.checklist||[]), {task: newTask, done: false}] };
      onUpdate(updated);
      setNewTask('');
  };

  const toggleTask = (idx) => {
      const list = [...patient.checklist];
      list[idx].done = !list[idx].done;
      onUpdate({...patient, checklist: list});
  };

  return (
    <div className="bg-white min-h-full pb-10 shadow-lg rounded-lg overflow-hidden">
       {/* Header */}
       <div className="bg-blue-50 p-4 border-b flex items-start gap-3">
          <button onClick={onBack}><ArrowLeft className="text-slate-500"/></button>
          <div className="flex-1">
             <h2 className="text-xl font-bold text-blue-900">{patient.name}</h2>
             <div className="text-sm text-gray-600">
                {patient.bed} ({patient.type}) • {patient.diagnosis}
             </div>
          </div>
       </div>

       {/* Tabs */}
       <div className="flex border-b text-sm font-medium text-center">
          <button onClick={()=>setTab('notes')} className={`flex-1 p-3 ${tab==='notes' ? 'border-b-2 border-blue-600 text-blue-900': 'text-gray-400'}`}>Evolución</button>
          <button onClick={()=>setTab('info')} className={`flex-1 p-3 ${tab==='info' ? 'border-b-2 border-blue-600 text-blue-900': 'text-gray-400'}`}>Datos</button>
       </div>

       <div className="p-4">
          {tab === 'notes' ? (
             <div className="space-y-4">
                {/* Note Creator */}
                <div className="bg-slate-50 p-3 rounded border shadow-sm">
                   <label className="text-xs font-bold uppercase text-slate-400 mb-2 block">Nueva Nota Visita</label>
                   <textarea className="w-full p-2 text-sm border rounded h-20 mb-2" placeholder="Subjetivo..."
                      value={noteForm.subj} onChange={e => setNoteForm({...noteForm, subj: e.target.value})}/>
                   
                   <div className="flex gap-2 mb-2">
                      <input placeholder="TA" className="w-1/3 p-1 text-center text-sm border rounded" value={noteForm.ta} onChange={e=>setNoteForm({...noteForm, ta: e.target.value})}/>
                      <input placeholder="FC" className="w-1/3 p-1 text-center text-sm border rounded" value={noteForm.fc} onChange={e=>setNoteForm({...noteForm, fc: e.target.value})}/>
                      <input placeholder="Temp" className="w-1/3 p-1 text-center text-sm border rounded" value={noteForm.temp} onChange={e=>setNoteForm({...noteForm, temp: e.target.value})}/>
                   </div>
                   
                   <div className="mb-2">
                       <Fishbone labs={noteForm.labs} onChange={(l) => setNoteForm({...noteForm, labs: l})} />
                   </div>

                   <div className="flex gap-2 mt-3">
                      <button onClick={handleSaveNote} className="flex-1 bg-blue-600 text-white py-2 rounded text-sm font-bold flex items-center justify-center gap-2"><Save size={16}/> Guardar</button>
                      <button onClick={copyMSJ} className="bg-purple-100 text-purple-700 px-4 rounded border border-purple-200 font-bold text-xs"><Copy size={16}/> MSJ</button>
                   </div>
                </div>

                {/* Checklist */}
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                    <h4 className="font-bold text-yellow-800 text-sm mb-2">Pendientes</h4>
                    {patient.checklist?.map((t, i) => (
                        <div key={i} className="flex items-center gap-2 mb-1">
                           <input type="checkbox" checked={t.done} onChange={()=>toggleTask(i)} className="rounded text-yellow-600"/>
                           <span className={`text-sm ${t.done ? 'line-through text-gray-400': 'text-gray-800'}`}>{t.task}</span>
                        </div>
                    ))}
                    <div className="flex gap-2 mt-2">
                       <input className="flex-1 border p-1 text-sm rounded" placeholder="Nuevo..." value={newTask} onChange={e=>setNewTask(e.target.value)}/>
                       <button onClick={addTask} className="bg-yellow-500 text-white px-2 rounded">+</button>
                    </div>
                </div>

                {/* History */}
                <div className="space-y-2">
                    {patient.notes?.map(n => (
                        <div key={n.id} className="bg-white border-l-4 border-blue-400 p-3 shadow-sm rounded">
                           <div className="text-xs text-gray-400 flex justify-between">
                              <span>{new Date(n.date).toLocaleString()}</span>
                              <span>{n.author}</span>
                           </div>
                           <p className="text-sm mt-1">{n.content.subj}</p>
                           {n.content.labs && <div className="mt-2 scale-75 origin-left"><Fishbone labs={n.content.labs} readOnly /></div>}
                        </div>
                    ))}
                </div>
             </div>
          ) : (
             <div className="text-center text-gray-500 mt-10">Datos generales editables aquí...</div>
          )}
       </div>
    </div>
  );
};
export default PatientDetail;
