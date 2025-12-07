import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { calculateAge } from '../utils';
import { ArrowLeft, Save, Copy, Trash2, Link as LinkIcon } from 'lucide-react';

export default function PatientDetail({ patient, onClose, user }) {
  const [activeTab, setActiveTab] = useState('notes');
  const [noteType, setNoteType] = useState('visita');
  
  // Daily Visit Form
  const [visitForm, setVisitForm] = useState({
      subj: '', ta: '', fc: '', temp: '', gu: '', drains: '', plan: '',
      // Labs planos
      hb: '', leu: '', plq: '', glu: '', cr: '', bun: '', na: '', k: '', cl: '', tp: '', ttp: '', inr: ''
  });

  const [simpleNote, setSimpleNote] = useState('');
  const [newTask, setNewTask] = useState('');

  // --- LOGIC ---

  const saveNote = async () => {
      let content = {};
      if (noteType === 'visita') {
          if(!visitForm.subj) return alert("Falta subjetivo");
          content = { ...visitForm };
      } else {
          if(!simpleNote) return alert("Nota vacía");
          content = { text: simpleNote };
      }

      const newNote = {
          id: Date.now().toString(),
          type: noteType,
          author: user.email.split('@')[0],
          timestamp: new Date().toISOString(),
          content
      };

      try {
          const ref = doc(db, "patients", patient.id);
          await updateDoc(ref, {
              notes: arrayUnion(newNote)
          });
          // Reset
          setVisitForm({ subj: '', ta: '', fc: '', temp: '', gu: '', drains: '', plan: '', hb: '', leu: '', plq: '', glu: '', cr: '', bun: '', na: '', k: '', cl: '', tp: '', ttp: '', inr: '' });
          setSimpleNote('');
          alert("Nota agregada");
      } catch (err) {
          console.error(err);
      }
  };

  const copyMSJ = () => {
      const f = visitForm;
      const text = `*PACIENTE:* ${patient.name}
*SUBJ:* ${f.subj}
*SV:* TA ${f.ta} | FC ${f.fc} | T ${f.temp}
*GU:* ${f.gu} ml | *Drenajes:* ${f.drains}
*LABS:* Hb ${f.hb} Leu ${f.leu} Plq ${f.plq} | Cr ${f.cr} BUN ${f.bun} | Na ${f.na} K ${f.k} Cl ${f.cl}
*PLAN:* ${f.plan}`;
      navigator.clipboard.writeText(text);
      alert("Resumen copiado para WhatsApp");
  };

  const updateInfo = async (field, val) => {
      await updateDoc(doc(db, "patients", patient.id), { [field]: val });
  };

  const toggleTask = async (idx) => {
      const newList = [...(patient.checklist || [])];
      newList[idx].done = !newList[idx].done;
      const hasPending = newList.some(x => !x.done);
      await updateDoc(doc(db, "patients", patient.id), { checklist: newList, hasPending });
  };

  const addTask = async () => {
      if(!newTask) return;
      const newList = [...(patient.checklist || []), { task: newTask, done: false }];
      await updateDoc(doc(db, "patients", patient.id), { checklist: newList, hasPending: true });
      setNewTask('');
  };

  const deleteNote = async (noteId) => {
      if(!confirm("¿Borrar nota?")) return;
      const newNotes = patient.notes.filter(n => n.id !== noteId);
      await updateDoc(doc(db, "patients", patient.id), { notes: newNotes });
  };

  return (
    <div className="bg-white min-h-full pb-20">
      {/* Header */}
      <div className="bg-blue-50 border-b p-4 sticky top-0 z-20 flex gap-2 items-start shadow-sm">
          <button onClick={onClose} className="mt-1"><ArrowLeft className="text-slate-500"/></button>
          <div className="flex-1">
              <h2 className="text-xl font-bold text-blue-900 leading-none">{patient.name}</h2>
              <div className="text-sm text-slate-600 mt-1">
                  Cama {patient.bed} • {calculateAge(patient.dob)} años • {patient.type}
              </div>
              <input className="text-xs w-full bg-transparent border-none p-0 text-slate-500" 
                     defaultValue={patient.diagnosis} onBlur={(e) => updateInfo('diagnosis', e.target.value)} />
          </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b text-sm font-bold text-center bg-white">
          <button onClick={()=>setActiveTab('notes')} className={`flex-1 p-3 ${activeTab==='notes'?'border-b-2 border-blue-600 text-blue-900':'text-gray-400'}`}>Evolución</button>
          <button onClick={()=>setActiveTab('info')} className={`flex-1 p-3 ${activeTab==='info'?'border-b-2 border-blue-600 text-blue-900':'text-gray-400'}`}>Ficha</button>
      </div>

      <div className="p-4 space-y-4">
        {activeTab === 'notes' ? (
            <>
                {/* CHECKLIST */}
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                   <h4 className="text-xs font-bold text-yellow-800 uppercase mb-2">Pendientes</h4>
                   {patient.checklist?.map((t, i) => (
                       <div key={i} className="flex items-center gap-2 mb-1">
                           <input type="checkbox" checked={t.done} onChange={()=>toggleTask(i)} className="w-4 h-4"/>
                           <span className={`text-sm ${t.done?'line-through text-gray-400':'text-gray-800'}`}>{t.task}</span>
                       </div>
                   ))}
                   <div className="flex gap-2 mt-2">
                       <input className="flex-1 border text-sm p-1 rounded" placeholder="Nuevo..." value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTask()}/>
                       <button onClick={addTask} className="bg-yellow-500 text-white px-2 rounded">+</button>
                   </div>
                </div>

                {/* NEW NOTE FORM */}
                <div className="border rounded-lg p-3 shadow-sm bg-slate-50">
                    <div className="flex justify-between mb-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Nueva Nota</label>
                        <select className="text-xs border rounded p-1" value={noteType} onChange={e=>setNoteType(e.target.value)}>
                            <option value="visita">Visita Diaria</option>
                            <option value="vitales">Signos Vitales</option>
                            <option value="imagen">Link Imagen</option>
                            <option value="sonda">Sonda/Drenaje</option>
                        </select>
                    </div>

                    {noteType === 'visita' ? (
                        <div className="space-y-2">
                            <textarea className="w-full border rounded p-2 text-sm h-16" placeholder="Subjetivo" value={visitForm.subj} onChange={e=>setVisitForm({...visitForm, subj:e.target.value})}/>
                            
                            <div className="grid grid-cols-3 gap-2">
                                <input placeholder="TA" className="border text-center text-sm p-1 rounded" value={visitForm.ta} onChange={e=>setVisitForm({...visitForm, ta:e.target.value})}/>
                                <input placeholder="FC" className="border text-center text-sm p-1 rounded" value={visitForm.fc} onChange={e=>setVisitForm({...visitForm, fc:e.target.value})}/>
                                <input placeholder="Temp" className="border text-center text-sm p-1 rounded" value={visitForm.temp} onChange={e=>setVisitForm({...visitForm, temp:e.target.value})}/>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2">
                                <input placeholder="Gasto U (ml)" className="border text-center text-sm p-1 rounded" value={visitForm.gu} onChange={e=>setVisitForm({...visitForm, gu:e.target.value})}/>
                                <input placeholder="Drenajes" className="border text-center text-sm p-1 rounded" value={visitForm.drains} onChange={e=>setVisitForm({...visitForm, drains:e.target.value})}/>
                            </div>

                            <div className="p-2 border rounded bg-white">
                                <p className="text-xs font-bold mb-1 text-gray-400">Laboratorios</p>
                                <div className="grid grid-cols-3 gap-1 mb-1">
                                    <input placeholder="Hb" className="border p-1 text-xs text-center" value={visitForm.hb} onChange={e=>setVisitForm({...visitForm, hb:e.target.value})}/>
                                    <input placeholder="Leu" className="border p-1 text-xs text-center" value={visitForm.leu} onChange={e=>setVisitForm({...visitForm, leu:e.target.value})}/>
                                    <input placeholder="Plq" className="border p-1 text-xs text-center" value={visitForm.plq} onChange={e=>setVisitForm({...visitForm, plq:e.target.value})}/>
                                </div>
                                <div className="grid grid-cols-3 gap-1 mb-1">
                                    <input placeholder="Glu" className="border p-1 text-xs text-center" value={visitForm.glu} onChange={e=>setVisitForm({...visitForm, glu:e.target.value})}/>
                                    <input placeholder="Cr" className="border p-1 text-xs text-center font-bold bg-yellow-50" value={visitForm.cr} onChange={e=>setVisitForm({...visitForm, cr:e.target.value})}/>
                                    <input placeholder="BUN" className="border p-1 text-xs text-center" value={visitForm.bun} onChange={e=>setVisitForm({...visitForm, bun:e.target.value})}/>
                                </div>
                                <div className="grid grid-cols-3 gap-1 mb-1">
                                    <input placeholder="Na" className="border p-1 text-xs text-center" value={visitForm.na} onChange={e=>setVisitForm({...visitForm, na:e.target.value})}/>
                                    <input placeholder="K" className="border p-1 text-xs text-center" value={visitForm.k} onChange={e=>setVisitForm({...visitForm, k:e.target.value})}/>
                                    <input placeholder="Cl" className="border p-1 text-xs text-center" value={visitForm.cl} onChange={e=>setVisitForm({...visitForm, cl:e.target.value})}/>
                                </div>
                            </div>

                            <textarea className="w-full border rounded p-2 text-sm h-16" placeholder="Análisis y Plan" value={visitForm.plan} onChange={e=>setVisitForm({...visitForm, plan:e.target.value})}/>
                            
                            <div className="flex gap-2">
                                <button onClick={saveNote} className="flex-1 bg-blue-600 text-white py-2 rounded font-bold text-sm"><Save size={16} className="inline mr-1"/> Guardar</button>
                                <button onClick={copyMSJ} className="bg-green-600 text-white px-4 rounded font-bold text-sm">MSJ</button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <textarea className="w-full border rounded p-2 text-sm h-20" placeholder={noteType === 'imagen' ? 'Pega el link aquí...' : 'Escribe nota...'} value={simpleNote} onChange={e=>setSimpleNote(e.target.value)}/>
                            <button onClick={saveNote} className="w-full bg-blue-600 text-white py-2 rounded font-bold text-sm">Guardar</button>
                        </div>
                    )}
                </div>

                {/* HISTORIAL */}
                <div className="space-y-3 pt-2">
                    {patient.notes?.slice().reverse().map(note => (
                        <div key={note.id} className="bg-white border rounded shadow-sm p-3 relative group">
                             <div className="flex justify-between text-xs text-gray-400 mb-1 border-b pb-1">
                                 <span>{new Date(note.timestamp).toLocaleString('es-MX', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})} - {note.author}</span>
                                 <span className="uppercase font-bold text-blue-300">{note.type}</span>
                             </div>
                             
                             <button onClick={() => deleteNote(note.id)} className="absolute top-2 right-2 text-red-300 opacity-0 group-hover:opacity-100"><Trash2 size={14}/></button>

                             {note.type === 'visita' && (
                                 <div className="text-sm">
                                     <p><span className="font-bold">S:</span> {note.content.subj}</p>
                                     <p className="text-xs bg-slate-50 p-1 my-1 rounded">
                                         TA:{note.content.ta} FC:{note.content.fc} T:{note.content.temp} GU:{note.content.gu} Cr:{note.content.cr}
                                     </p>
                                     <p><span className="font-bold">P:</span> {note.content.plan}</p>
                                 </div>
                             )}
                             {note.type === 'imagen' && (
                                 <a href={note.content.text} target="_blank" className="text-blue-600 underline flex items-center gap-1"><LinkIcon size={12}/> Ver Imagen</a>
                             )}
                             {note.type !== 'visita' && note.type !== 'imagen' && (
                                 <p className="text-sm">{note.content.text}</p>
                             )}
                        </div>
                    ))}
                </div>
            </>
        ) : (
            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-xs text-gray-500">Alergias</label>
                    <input className="w-full border p-2 rounded" defaultValue={patient.allergies} onBlur={e=>updateInfo('allergies', e.target.value)} />
                </div>
                {/* Más campos editables si se requieren */}
                <div className="p-4 bg-gray-50 text-center text-gray-400 text-sm rounded">
                    Aquí se pueden editar datos demográficos (Prototipo funcional)
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
