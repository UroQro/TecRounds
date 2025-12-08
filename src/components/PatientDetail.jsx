import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { calculateAge } from '../utils';
import { ArrowLeft, Edit, Trash2, Link as LinkIcon, Copy } from 'lucide-react';
import { PatientFormModal } from './Census';

export default function PatientDetail({ patient, onClose, user }) {
  const [activeTab, setActiveTab] = useState('notes');
  const [noteType, setNoteType] = useState('visita');
  const [showEdit, setShowEdit] = useState(false);
  const [visitForm, setVisitForm] = useState({ subj: '', ta: '', fc: '', temp: '', gu: '', drains: '', plan: '', hb: '', leu: '', plq: '', glu: '', cr: '', bun: '', na: '', k: '', cl: '', tp: '', ttp: '', inr: '' });
  const [simpleNote, setSimpleNote] = useState('');
  const [newTask, setNewTask] = useState('');
  
  const antecedents = patient.antecedents || { dm: false, has: false, cancer: false, other: '' };
  const allergies = patient.allergies || 'Negadas';

  const getUserName = () => user.email ? user.email.split('@')[0] : 'User';

  const saveNote = async () => {
      let content = {};
      if (noteType === 'visita') { if(!visitForm.subj) return alert("Falta subjetivo"); content = { ...visitForm }; } 
      else { if(!simpleNote) return alert("Nota vacía"); content = { text: simpleNote }; }

      const newNote = { id: Date.now().toString(), type: noteType, author: getUserName(), timestamp: new Date().toISOString(), content };
      try {
          await updateDoc(doc(db, "patients", patient.id), { notes: arrayUnion(newNote) });
          setVisitForm({ subj: '', ta: '', fc: '', temp: '', gu: '', drains: '', plan: '', hb: '', leu: '', plq: '', glu: '', cr: '', bun: '', na: '', k: '', cl: '', tp: '', ttp: '', inr: '' });
          setSimpleNote('');
      } catch (err) { alert(err.message); }
  };

  const copyMSJ = (data = visitForm) => {
      const f = data;
      const text = `*${patient.name}*\n*S:* ${f.subj}\n*SV:* TA ${f.ta} | FC ${f.fc} | T ${f.temp}\n*GU:* ${f.gu}ml | *Dren:* ${f.drains}\n*Labs:* Hb ${f.hb} Leu ${f.leu} Plq ${f.plq} | Cr ${f.cr} BUN ${f.bun} | Na ${f.na} K ${f.k} Cl ${f.cl}\n*A/P:* ${f.plan}`;
      navigator.clipboard.writeText(text);
      alert("Copiado!");
  };

  const addTask = async () => { if(!newTask) return; const newList = [...(patient.checklist || []), { task: newTask, done: false }]; await updateDoc(doc(db, "patients", patient.id), { checklist: newList, hasPending: true }); setNewTask(''); };
  const toggleTask = async (idx) => { const newList = [...(patient.checklist || [])]; newList[idx].done = !newList[idx].done; const hasPending = newList.some(x => !x.done); await updateDoc(doc(db, "patients", patient.id), { checklist: newList, hasPending }); };
  const deleteNote = async (noteId) => { if(!confirm("¿Eliminar?")) return; const newNotes = patient.notes.filter(n => n.id !== noteId); await updateDoc(doc(db, "patients", patient.id), { notes: newNotes }); };

  return (
    <div className="bg-white min-h-full pb-20">
      <div className="bg-blue-50 border-b p-3 sticky top-0 z-20 flex gap-2 items-center shadow-sm">
          <button onClick={onClose}><ArrowLeft className="text-slate-600"/></button>
          <div className="flex-1"><h2 className="text-lg font-bold text-blue-900 leading-none">{patient.name}</h2><div className="text-xs text-slate-600 mt-1">{patient.bed} • {calculateAge(patient.dob)}a • {patient.doctor}</div></div>
          <button onClick={()=>setShowEdit(true)} className="p-2 bg-white rounded-full shadow text-blue-600"><Edit size={16}/></button>
      </div>
      <div className="flex border-b text-sm font-bold text-center bg-white">
          <button onClick={()=>setActiveTab('notes')} className={`flex-1 p-3 ${activeTab==='notes'?'border-b-2 border-blue-600 text-blue-900':'text-gray-400'}`}>Evolución</button>
          <button onClick={()=>setActiveTab('info')} className={`flex-1 p-3 ${activeTab==='info'?'border-b-2 border-blue-600 text-blue-900':'text-gray-400'}`}>Ficha</button>
      </div>
      <div className="p-3 space-y-4 bg-slate-50 min-h-screen">
        {activeTab === 'notes' ? (
            <>
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 shadow-sm">
                   <h4 className="text-xs font-bold text-yellow-800 uppercase mb-2">Pendientes</h4>
                   {patient.checklist?.map((t, i) => (
                       <div key={i} className="flex items-center gap-2 mb-1"><input type="checkbox" checked={t.done} onChange={()=>toggleTask(i)} className="w-5 h-5 accent-yellow-600"/><span className={`text-sm ${t.done?'line-through text-gray-400':'text-gray-900'}`}>{t.task}</span></div>
                   ))}
                   <div className="flex gap-2 mt-2"><input className="flex-1 border text-sm p-2 rounded" placeholder="Nuevo pendiente..." value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTask()}/><button onClick={addTask} className="bg-yellow-500 text-white px-3 rounded font-bold text-xl">+</button></div>
                </div>
                <div className="bg-white border rounded-lg p-3 shadow-sm">
                    <div className="flex justify-between mb-2 items-center"><label className="text-xs font-bold text-slate-400 uppercase">Nueva Entrada</label>
                        <select className="text-xs border rounded p-1 bg-slate-50" value={noteType} onChange={e=>setNoteType(e.target.value)}><option value="visita">Visita Diaria</option><option value="vitales">Signos Vitales</option><option value="cultivos">Cultivos</option><option value="antibiotico">Antibiótico</option><option value="procedimiento">Procedimiento</option><option value="imagen">Imagen (URL)</option><option value="sonda">Sonda/Drenaje</option><option value="texto">Nota Libre</option></select>
                    </div>
                    {noteType === 'visita' ? (
                        <div className="space-y-2">
                            <textarea className="w-full border rounded p-2 text-sm h-16 bg-slate-50 focus:bg-white" placeholder="Subjetivo" value={visitForm.subj} onChange={e=>setVisitForm({...visitForm, subj:e.target.value})}/>
                            <div className="flex gap-2"><input placeholder="TA" className="w-1/3 border text-center text-sm p-2 rounded" value={visitForm.ta} onChange={e=>setVisitForm({...visitForm, ta:e.target.value})}/><input placeholder="FC" className="w-1/3 border text-center text-sm p-2 rounded" value={visitForm.fc} onChange={e=>setVisitForm({...visitForm, fc:e.target.value})}/><input placeholder="T°" className="w-1/3 border text-center text-sm p-2 rounded" value={visitForm.temp} onChange={e=>setVisitForm({...visitForm, temp:e.target.value})}/></div>
                            <div className="flex gap-2"><input placeholder="Gasto U" className="flex-1 border text-center text-sm p-2 rounded" value={visitForm.gu} onChange={e=>setVisitForm({...visitForm, gu:e.target.value})}/><input placeholder="Drenajes" className="flex-1 border text-center text-sm p-2 rounded" value={visitForm.drains} onChange={e=>setVisitForm({...visitForm, drains:e.target.value})}/></div>
                            <div className="p-2 border rounded bg-slate-50"><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Laboratorios</p>
                                <div className="grid grid-cols-3 gap-1 mb-1"><input placeholder="Hb" className="lab-input" value={visitForm.hb} onChange={e=>setVisitForm({...visitForm, hb:e.target.value})}/><input placeholder="Leu" className="lab-input" value={visitForm.leu} onChange={e=>setVisitForm({...visitForm, leu:e.target.value})}/><input placeholder="Plq" className="lab-input" value={visitForm.plq} onChange={e=>setVisitForm({...visitForm, plq:e.target.value})}/></div>
                                <div className="grid grid-cols-3 gap-1 mb-1"><input placeholder="Glu" className="lab-input" value={visitForm.glu} onChange={e=>setVisitForm({...visitForm, glu:e.target.value})}/><input placeholder="Cr" className="lab-input font-bold bg-yellow-100" value={visitForm.cr} onChange={e=>setVisitForm({...visitForm, cr:e.target.value})}/><input placeholder="BUN" className="lab-input" value={visitForm.bun} onChange={e=>setVisitForm({...visitForm, bun:e.target.value})}/></div>
                                <div className="grid grid-cols-3 gap-1 mb-1"><input placeholder="Na" className="lab-input" value={visitForm.na} onChange={e=>setVisitForm({...visitForm, na:e.target.value})}/><input placeholder="K" className="lab-input" value={visitForm.k} onChange={e=>setVisitForm({...visitForm, k:e.target.value})}/><input placeholder="Cl" className="lab-input" value={visitForm.cl} onChange={e=>setVisitForm({...visitForm, cl:e.target.value})}/></div>
                                <style>{`.lab-input { border: 1px solid #e2e8f0; padding: 4px; font-size: 12px; text-align: center; border-radius: 4px; width: 100%; }`}</style>
                            </div>
                            <textarea className="w-full border rounded p-2 text-sm h-16 bg-slate-50 focus:bg-white" placeholder="Análisis y Plan" value={visitForm.plan} onChange={e=>setVisitForm({...visitForm, plan:e.target.value})}/>
                            <div className="flex gap-2 pt-2"><button onClick={saveNote} className="flex-1 bg-blue-600 text-white py-3 rounded font-bold text-sm shadow-md">Guardar Nota</button></div>
                        </div>
                    ) : (
                        <div className="space-y-2"><textarea className="w-full border rounded p-2 text-sm h-20" placeholder={noteType === 'imagen' ? 'Pegar URL de imagen...' : 'Escribir nota...'} value={simpleNote} onChange={e=>setSimpleNote(e.target.value)}/><button onClick={saveNote} className="w-full bg-blue-600 text-white py-3 rounded font-bold text-sm shadow">Guardar</button></div>
                    )}
                </div>
                <div className="space-y-3 pb-10">
                    {patient.notes?.slice().reverse().map(note => (
                        <div key={note.id} className="bg-white border rounded p-3 shadow-sm relative group">
                             <div className="flex justify-between items-center text-xs text-gray-400 mb-2 border-b pb-1"><span>{new Date(note.timestamp).toLocaleDateString('es-MX', {day:'2-digit', month:'short'})} {new Date(note.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • <span className="text-blue-600 font-bold">{note.author}</span></span><div className="flex gap-2 items-center"><span className="uppercase font-bold bg-slate-100 px-1 rounded text-[10px]">{note.type}</span><button onClick={() => deleteNote(note.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button></div></div>
                             {note.type === 'visita' ? (
                                 <div className="text-sm space-y-1"><p className="text-gray-800">{note.content.subj}</p><div className="text-xs bg-slate-50 p-2 rounded border grid grid-cols-2 gap-2 text-slate-600"><span>TA: {note.content.ta} / FC: {note.content.fc}</span><span>T: {note.content.temp} / GU: {note.content.gu}</span></div><p className="font-medium text-blue-900 mt-1">P: {note.content.plan}</p><button onClick={() => copyMSJ(note.content)} className="mt-2 text-xs bg-green-50 text-green-700 px-2 py-1 rounded border border-green-200 flex items-center gap-1 font-bold w-full justify-center"><Copy size={12}/> Copiar MSJ</button></div>
                             ) : (<div className="text-sm text-gray-800 break-words">{note.type === 'imagen' ? <a href={note.content.text} target="_blank" className="text-blue-600 underline flex gap-1 items-center"><LinkIcon size={14}/> Ver Imagen</a> : note.content.text}</div>)}
                        </div>
                    ))}
                </div>
            </>
        ) : (
            <div className="p-4 bg-white rounded shadow-sm space-y-4">
                 <h3 className="font-bold text-blue-900">Datos Clínicos</h3>
                 <div className="space-y-1 text-sm"><div className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full ${antecedents.dm?'bg-red-500':'bg-gray-300'}`}></div> Diabetes Mellitus</div><div className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full ${antecedents.has?'bg-red-500':'bg-gray-300'}`}></div> Hipertensión</div><div className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full ${antecedents.cancer?'bg-red-500':'bg-gray-300'}`}></div> Onco</div></div>
                 <div className="border-t pt-2"><p className="text-xs font-bold text-gray-500">Otros Antecedentes:</p><p>{antecedents.other || 'Ninguno'}</p></div>
                 <div className="border-t pt-2"><p className="text-xs font-bold text-gray-500">Alergias:</p><p className="font-bold text-red-600">{allergies}</p></div>
                 <div className="border-t pt-2"><p className="text-xs font-bold text-gray-500">Tratante:</p><p>{patient.doctor}</p><p className="text-xs font-bold text-gray-500 mt-2">Residente:</p><p>{patient.resident}</p></div>
            </div>
        )}
      </div>
      {showEdit && <PatientFormModal onClose={() => {setShowEdit(false); onClose();}} mode="edit" initialData={patient} />}
    </div>
  );
}
