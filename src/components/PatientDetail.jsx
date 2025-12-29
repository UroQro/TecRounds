import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, arrayUnion, onSnapshot } from 'firebase/firestore';
import { calculateAge, calculateDaysSince, calculateTreatmentDay, calculateBMI, getLocalISODate } from '../utils';
import { ArrowLeft, Edit, Trash2, Link as LinkIcon, Copy, Briefcase } from 'lucide-react';
import PatientFormModal from './PatientFormModal';

export default function PatientDetail({ patient: initialPatient, onClose, user }) {
  const [patient, setPatient] = useState(initialPatient);
  const [noteType, setNoteType] = useState('visita');
  const [showEdit, setShowEdit] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [visitForm, setVisitForm] = useState({ subj: '', ta: '', fc: '', temp: '', gu: '', drains: '', plan: '', hb: '', leu: '', plq: '', glu: '', cr: '', bun: '', na: '', k: '', cl: '', tp: '', ttp: '', inr: '', hto: '' });
  const [sondaForm, setSondaForm] = useState({ type: 'Foley', fr: '', date: getLocalISODate() });
  const [cultureForm, setCultureForm] = useState({ result: 'Negativo', germ: '', sens: '' });
  const [abxForm, setAbxForm] = useState({ drug: '', startDate: getLocalISODate() });
  const [somatoForm, setSomatoForm] = useState({ weight: '', height: '' });
  const [vitalForm, setVitalForm] = useState({ ta: '', fc: '', fr: '', temp: '', sat: '' });
  const [simpleNote, setSimpleNote] = useState('');
  const [newTask, setNewTask] = useState('');
  const [labForm, setLabForm] = useState({ hb: '', leu: '', plq: '', glu: '', cr: '', bun: '', na: '', k: '', cl: '', tp: '', ttp: '', inr: '', hto: '' });

  const loadNoteForEditing = (note) => { setEditingNote(note); setNoteType(note.type); if(note.type==='visita')setVisitForm(note.content);else if(note.type==='sonda')setSondaForm(note.content);else if(note.type==='cultivos')setCultureForm(note.content);else if(note.type==='antibiotico')setAbxForm(note.content);else if(note.type==='somatometria')setSomatoForm(note.content);else if(note.type==='vitales')setVitalForm(note.content);else if(note.type==='laboratorios')setLabForm(note.content);else setSimpleNote(note.content.text); window.scrollTo({top:300,behavior:'smooth'}); };
  const cancelEditing = () => { setEditingNote(null); setVisitForm({subj:'',ta:'',fc:'',temp:'',gu:'',drains:'',plan:'',hb:'',leu:'',plq:'',glu:'',cr:'',bun:'',na:'',k:'',cl:'',tp:'',ttp:'',inr:'',hto:''}); setSimpleNote(''); };

  const antecedents = patient.antecedents || { dm: false, has: false, cancer: false, other: '' };
  const allergies = patient.allergies || 'Negadas';
  const lastSomato = patient.notes?.find(n => n.type === 'somatometria')?.content;
  const bmi = lastSomato ? lastSomato.bmi : calculateBMI(patient.weight, patient.height);

  useEffect(() => { const unsub = onSnapshot(doc(db, "patients", initialPatient.id), (docSnapshot) => { if (docSnapshot.exists()) setPatient({ id: docSnapshot.id, ...docSnapshot.data() }); }); return () => unsub(); }, [initialPatient.id]);
  const getUserName = () => user.email ? user.email.split('@')[0] : 'User';
  const togglePreDischarge = async () => { await updateDoc(doc(db, "patients", patient.id), { preDischarge: !patient.preDischarge }); };

  const saveNote = async () => {
      let content = {};
      if (noteType === 'visita') { if(!visitForm.subj) return alert("Falta subjetivo"); content = { ...visitForm }; } 
      else if (noteType === 'laboratorios') { content = { ...labForm }; }
      else if (noteType === 'vitales') { if(!vitalForm.ta && !vitalForm.fc) return alert("Faltan datos"); content = { ...vitalForm }; }
      else if (noteType === 'sonda') { if(!sondaForm.fr) return alert("Ingresa el calibre"); content = { ...sondaForm }; }
      else if (noteType === 'cultivos') { content = { ...cultureForm }; }
      else if (noteType === 'antibiotico') { if(!abxForm.drug) return alert("Nombre?"); content = { ...abxForm }; }
      else if (noteType === 'somatometria') { if(!somatoForm.weight || !somatoForm.height) return alert("Faltan datos"); const calculatedBMI = calculateBMI(somatoForm.weight, somatoForm.height); content = { ...somatoForm, bmi: calculatedBMI }; }
      else { if(!simpleNote) return alert("Nota vacía"); content = { text: simpleNote }; }
      try { if(editingNote) { const updatedNotes = patient.notes.map(n => n.id === editingNote.id ? { ...n, content, type: noteType } : n); await updateDoc(doc(db, "patients", patient.id), { notes: updatedNotes }); cancelEditing(); } else { const newNote = { id: Date.now().toString(), type: noteType, author: getUserName(), timestamp: new Date().toISOString(), content }; await updateDoc(doc(db, "patients", patient.id), { notes: arrayUnion(newNote) }); cancelEditing(); } } catch (err) { alert(err.message); }
  };

  const copyMSJ = (data) => {
      const f = data;
      let text = `*${patient.bed}* - *${patient.name}*`;
      if (f.subj) text += `\n*S:* ${f.subj}`;
      const sv = []; if(f.ta) sv.push(`TA ${f.ta}`); if(f.fc) sv.push(`FC ${f.fc}`); if(f.temp) sv.push(`T ${f.temp}`); if(sv.length > 0) text += `\n*SV:* ${sv.join(' | ')}`;
      const liq = []; if(f.gu) liq.push(`GU ${f.gu}ml`); if(f.drains) liq.push(`Dren: ${f.drains}`); if(liq.length > 0) text += `\n*Líq:* ${liq.join(' | ')}`;
      const labs = []; if(f.hb) labs.push(`Hb ${f.hb}`); if(f.hto) labs.push(`Hto ${f.hto}`); if(f.leu) labs.push(`Leu ${f.leu}`); if(f.plq) labs.push(`Plq ${f.plq}`); if(f.glu) labs.push(`Glu ${f.glu}`); if(f.cr) labs.push(`Cr ${f.cr}`); if(f.bun) labs.push(`BUN ${f.bun}`); if(f.na) labs.push(`Na ${f.na}`); if(f.k) labs.push(`K ${f.k}`); if(f.cl) labs.push(`Cl ${f.cl}`); if(f.tp) labs.push(`TP ${f.tp}`); if(f.ttp) labs.push(`TTP ${f.ttp}`); if(f.inr) labs.push(`INR ${f.inr}`); if(labs.length > 0) text += `\n*Labs:* ${labs.join(' ')}`;
      if (f.plan) text += `\n*A/P:* ${f.plan}`;
      navigator.clipboard.writeText(text); alert("Copiado!");
  };

  const addTask = async () => { if(!newTask) return; const newList = [...(patient.checklist || []), { task: newTask, done: false }]; await updateDoc(doc(db, "patients", patient.id), { checklist: newList, hasPending: true }); setNewTask(''); };
  const toggleTask = async (idx) => { const newList = [...(patient.checklist || [])]; newList[idx].done = !newList[idx].done; const hasPending = newList.some(x => !x.done); await updateDoc(doc(db, "patients", patient.id), { checklist: newList, hasPending }); };
  const deleteNote = async (noteId) => { if(!confirm("¿Eliminar?")) return; const newNotes = patient.notes.filter(n => n.id !== noteId); await updateDoc(doc(db, "patients", patient.id), { notes: newNotes }); };

  const LabGrid = ({ c }) => ( <div className="grid grid-cols-4 gap-1 text-[10px] bg-slate-50 dark:bg-slate-700 p-2 rounded border dark:border-slate-600 mt-1 font-mono text-center text-slate-800 dark:text-slate-200"> {c.hb && <span>Hb:{c.hb}</span>} {c.hto && <span>Hto:{c.hto}</span>} {c.leu && <span>Leu:{c.leu}</span>} {c.plq && <span>Plq:{c.plq}</span>} {c.glu && <span>Glu:{c.glu}</span>} {c.cr && <span className="font-bold bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-100">Cr:{c.cr}</span>} {c.bun && <span>Bun:{c.bun}</span>} {c.na && <span>Na:{c.na}</span>} {c.k && <span>K:{c.k}</span>} {c.cl && <span>Cl:{c.cl}</span>} {c.tp && <span>TP:{c.tp}</span>} {c.ttp && <span>TTP:{c.ttp}</span>} {c.inr && <span>INR:{c.inr}</span>} </div> );
  const inputClass = "w-full border dark:border-slate-600 rounded p-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500";

  return (
    <div className="bg-gray-50 dark:bg-slate-900 min-h-full pb-20 transition-colors">
      <div className={`border-b border-blue-100 dark:border-slate-700 p-3 sticky top-0 z-20 flex gap-2 items-center shadow-sm ${patient.preDischarge ? 'bg-purple-50 dark:bg-purple-900' : 'bg-white dark:bg-slate-800'}`}>
          <button onClick={onClose}><ArrowLeft className="text-slate-600 dark:text-slate-300"/></button>
          <div className="flex-1">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-none">{patient.name}</h2>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex gap-2 items-center">
                  <span>{patient.bed} • {calculateAge(patient.dob)}a</span>
                  {bmi && <span className="bg-white dark:bg-slate-700 px-1 rounded font-bold text-blue-800 dark:text-blue-300 border border-blue-100 dark:border-slate-600">IMC: {bmi}</span>}
              </div>
          </div>
          <button onClick={togglePreDischarge} className={`p-2 rounded-full shadow border border-slate-200 dark:border-slate-600 ${patient.preDischarge ? 'bg-purple-600 text-white' : 'bg-white dark:bg-slate-700 text-gray-400'}`}><Briefcase size={16}/></button>
          <button onClick={()=>setShowEdit(true)} className="p-2 bg-white dark:bg-slate-700 rounded-full shadow text-blue-600 dark:text-blue-400"><Edit size={16}/></button>
      </div>

      <div className="p-3 space-y-4 bg-gray-50 dark:bg-slate-900 min-h-screen">
          <div className="bg-white dark:bg-slate-800 border border-blue-50 dark:border-slate-700 rounded p-3 text-xs shadow-md dark:shadow-sm text-slate-900 dark:text-slate-200">
             <div className="flex flex-wrap gap-2 mb-1">
                 {antecedents.dm && <span className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-0.5 rounded font-bold">DM</span>}
                 {antecedents.has && <span className="bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 px-2 py-0.5 rounded font-bold">HAS</span>}
                 {antecedents.cancer && <span className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-2 py-0.5 rounded font-bold">ONCO</span>}
             </div>
             {antecedents.other && <p className="text-gray-600 dark:text-gray-400"><strong>Ant:</strong> {antecedents.other}</p>}
             {allergies && allergies !== 'Negadas' && <p className="text-red-600 dark:text-red-400 mt-1"><strong>Alergias:</strong> {allergies}</p>}
             <p className="text-gray-500 dark:text-gray-400 mt-1"><strong>Dx:</strong> {patient.diagnosis}</p>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900 rounded p-3 shadow-md dark:shadow-sm text-slate-900 dark:text-slate-200">
             <h4 className="text-xs font-bold text-yellow-800 dark:text-yellow-500 uppercase mb-2">Pendientes</h4>
             {patient.checklist?.map((t, i) => ( <div key={i} className="flex items-center gap-2 mb-1"><input type="checkbox" checked={t.done} onChange={()=>toggleTask(i)} className="w-5 h-5 accent-yellow-600"/><span className={`text-sm ${t.done?'line-through text-gray-400 dark:text-gray-600':'text-gray-900 dark:text-gray-300'}`}>{t.task}</span></div> ))}
             <div className="flex gap-2 mt-2"><input className={inputClass} placeholder="Nuevo pendiente..." value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTask()}/><button onClick={addTask} className="bg-yellow-500 text-white px-3 rounded font-bold text-xl">+</button></div>
          </div>
          <div className={`bg-white dark:bg-slate-800 border border-blue-50 dark:border-slate-700 rounded-lg p-3 shadow-md dark:shadow-sm text-slate-900 dark:text-white ${editingNote ? 'border-blue-500 ring-2 ring-blue-100' : ''}`}>
              <div className="flex justify-between mb-2 items-center">
                  <label className="text-xs font-bold text-slate-400 uppercase">{editingNote ? 'Editando Nota' : 'Nueva Entrada'}</label>
                  <select className="text-xs border border-gray-200 dark:border-slate-600 rounded p-1 bg-gray-50 dark:bg-slate-700 text-slate-900 dark:text-white" value={noteType} onChange={e=>setNoteType(e.target.value)} disabled={!!editingNote}>
                      <option value="visita">Visita Diaria</option><option value="laboratorios">Laboratorios</option><option value="vitales">Signos Vitales</option><option value="somatometria">Peso y Talla</option><option value="cultivos">Cultivos</option><option value="antibiotico">Antibiótico</option><option value="procedimiento">Procedimiento</option><option value="imagen">Imagen (URL)</option><option value="sonda">Sonda/Drenaje</option><option value="texto">Nota Libre</option>
                  </select>
              </div>
              {noteType === 'visita' && (
                  <div className="space-y-2">
                      <textarea className={inputClass + " h-24"} placeholder="Subjetivo" value={visitForm.subj} onChange={e=>setVisitForm({...visitForm, subj:e.target.value})}/>
                      <div className="flex gap-2"><input placeholder="TA" className={inputClass} value={visitForm.ta} onChange={e=>setVisitForm({...visitForm, ta:e.target.value})}/><input placeholder="FC" className={inputClass} value={visitForm.fc} onChange={e=>setVisitForm({...visitForm, fc:e.target.value})}/><input placeholder="T°" className={inputClass} value={visitForm.temp} onChange={e=>setVisitForm({...visitForm, temp:e.target.value})}/></div>
                      <div className="flex gap-2"><input placeholder="Gasto U" className={inputClass} value={visitForm.gu} onChange={e=>setVisitForm({...visitForm, gu:e.target.value})}/><input placeholder="Drenajes (Detallar)" className={inputClass} value={visitForm.drains} onChange={e=>setVisitForm({...visitForm, drains:e.target.value})}/></div>
                      <div className="p-2 border dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-700"><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Laboratorios</p><div className="grid grid-cols-4 gap-1 mb-1"><input placeholder="Hb" className={inputClass} value={visitForm.hb} onChange={e=>setVisitForm({...visitForm, hb:e.target.value})}/><input placeholder="Hto" className={inputClass} value={visitForm.hto} onChange={e=>setVisitForm({...visitForm, hto:e.target.value})}/><input placeholder="Leu" className={inputClass} value={visitForm.leu} onChange={e=>setVisitForm({...visitForm, leu:e.target.value})}/><input placeholder="Plq" className={inputClass} value={visitForm.plq} onChange={e=>setVisitForm({...visitForm, plq:e.target.value})}/></div><div className="grid grid-cols-3 gap-1 mb-1"><input placeholder="Glu" className={inputClass} value={visitForm.glu} onChange={e=>setVisitForm({...visitForm, glu:e.target.value})}/><input placeholder="Cr" className={inputClass} value={visitForm.cr} onChange={e=>setVisitForm({...visitForm, cr:e.target.value})}/><input placeholder="BUN" className={inputClass} value={visitForm.bun} onChange={e=>setVisitForm({...visitForm, bun:e.target.value})}/></div><div className="grid grid-cols-3 gap-1 mb-1"><input placeholder="Na" className={inputClass} value={visitForm.na} onChange={e=>setVisitForm({...visitForm, na:e.target.value})}/><input placeholder="K" className={inputClass} value={visitForm.k} onChange={e=>setVisitForm({...visitForm, k:e.target.value})}/><input placeholder="Cl" className={inputClass} value={visitForm.cl} onChange={e=>setVisitForm({...visitForm, cl:e.target.value})}/></div><div className="grid grid-cols-3 gap-1"><input placeholder="TP" className={inputClass} value={visitForm.tp} onChange={e=>setVisitForm({...visitForm, tp:e.target.value})}/><input placeholder="TTP" className={inputClass} value={visitForm.ttp} onChange={e=>setVisitForm({...visitForm, ttp:e.target.value})}/><input placeholder="INR" className={inputClass} value={visitForm.inr} onChange={e=>setVisitForm({...visitForm, inr:e.target.value})}/></div></div>
                      <textarea className={inputClass + " h-24"} placeholder="Análisis y Plan" value={visitForm.plan} onChange={e=>setVisitForm({...visitForm, plan:e.target.value})}/>
                  </div>
              )}
              {/* OMITTED OTHERS FOR BREVITY */}
              <div className="flex gap-2 pt-2">
                  {editingNote && <button onClick={cancelEditing} className="flex-1 bg-gray-300 dark:bg-slate-600 text-gray-700 dark:text-white py-3 rounded font-bold text-sm">Cancelar</button>}
                  <button onClick={saveNote} className="flex-1 bg-blue-600 text-white py-3 rounded font-bold text-sm shadow-md">{editingNote ? 'Actualizar Nota' : 'Guardar'}</button>
              </div>
          </div>
          <div className="space-y-3 pb-10">
              {patient.notes?.slice().reverse().map(note => (
                  <div key={note.id} className="bg-white dark:bg-slate-800 border border-blue-50 dark:border-slate-700 rounded p-3 shadow-md dark:shadow-sm relative group text-slate-900 dark:text-slate-200">
                       <div className="flex justify-between items-center text-xs text-gray-400 mb-2 border-b border-gray-100 dark:border-slate-700 pb-1">
                           <span className="font-mono">{new Date(note.timestamp).toLocaleDateString('es-MX', {day:'2-digit', month:'short'})} | {new Date(note.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                           <div className="flex gap-2 items-center">
                               <span className="uppercase font-extrabold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-slate-700 px-2 py-0.5 rounded text-[10px]">{note.author}</span>
                               <span className="uppercase font-bold bg-slate-100 dark:bg-slate-700 px-1 rounded text-[10px] text-gray-500 dark:text-gray-400">{note.type}</span>
                               <button onClick={() => loadNoteForEditing(note)} className="text-blue-400 hover:text-blue-600"><Edit size={14}/></button>
                               <button onClick={() => deleteNote(note.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button>
                           </div>
                       </div>
                       {note.type === 'visita' ? (
                           <div className="text-sm space-y-1">
                               <p className="text-gray-800 dark:text-gray-200">{note.content.subj}</p>
                               <div className="text-xs bg-slate-50 dark:bg-slate-700 p-2 rounded border dark:border-slate-600 grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300"><span>TA: {note.content.ta} / FC: {note.content.fc}</span><span>T: {note.content.temp} / GU: {note.content.gu}</span></div>
                               {(note.content.hb || note.content.cr) && <LabGrid c={note.content}/>}
                               <p className="font-medium text-blue-900 dark:text-blue-300 mt-1">P: {note.content.plan}</p>
                               <button onClick={() => copyMSJ(note.content)} className="mt-2 text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded border border-green-200 dark:border-green-800 flex items-center gap-1 font-bold w-full justify-center"><Copy size={12}/> Copiar MSJ</button>
                           </div>
                       ) : (<div className="text-sm text-gray-800 break-words">{note.type === 'imagen' ? <a href={note.content.text} target="_blank" className="text-blue-600 underline flex gap-1 items-center"><LinkIcon size={14}/> Ver Imagen</a> : JSON.stringify(note.content)}</div>)}
                  </div>
              ))}
          </div>
      </div>
      {showEdit && <PatientFormModal onClose={() => {setShowEdit(false); onClose();}} mode="edit" initialData={patient} />}
    </div>
  );
}
