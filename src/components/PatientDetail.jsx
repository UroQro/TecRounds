import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, arrayUnion, onSnapshot } from 'firebase/firestore';
import { calculateAge, calculateDaysSince, calculateTreatmentDay, calculateBMI, getLocalISODate } from '../utils';
import { ArrowLeft, Edit, Trash2, Link as LinkIcon, Copy, Activity, Scale, Home, FileText } from 'lucide-react';
import PatientFormModal from './PatientFormModal';

export default function PatientDetail({ patient: initialPatient, onClose, user }) {
  const [patient, setPatient] = useState(initialPatient);
  const [noteType, setNoteType] = useState('visita');
  const [showEdit, setShowEdit] = useState(false);
  const [editingNote, setEditingNote] = useState(null);

  // Forms
  const [visitForm, setVisitForm] = useState({ subj: '', ta: '', fc: '', temp: '', gu: '', drains: '', plan: '', hb: '', leu: '', plq: '', glu: '', cr: '', bun: '', na: '', k: '', cl: '', tp: '', ttp: '', inr: '', hto: '' });
  const [sondaForm, setSondaForm] = useState({ type: 'Foley', fr: '', date: getLocalISODate() });
  const [cultureForm, setCultureForm] = useState({ result: 'Negativo', germ: '', sens: '' });
  const [abxForm, setAbxForm] = useState({ drug: '', startDate: getLocalISODate() });
  const [somatoForm, setSomatoForm] = useState({ weight: '', height: '' });
  const [simpleNote, setSimpleNote] = useState('');
  const [newTask, setNewTask] = useState('');
  const [labForm, setLabForm] = useState({ hb: '', leu: '', plq: '', glu: '', cr: '', bun: '', na: '', k: '', cl: '', tp: '', ttp: '', inr: '', hto: '' });

  // Safe Data
  const antecedents = patient.antecedents || { dm: false, has: false, cancer: false, other: '' };
  const allergies = patient.allergies || 'Negadas';
  
  // Find BMI from notes
  const latestSomato = patient.notes?.find(n => n.type === 'somatometria');
  const displayBMI = latestSomato ? latestSomato.content.bmi : '--';
  const displayWeight = latestSomato ? latestSomato.content.weight : '--';
  const displayHeight = latestSomato ? latestSomato.content.height : '--';

  const loadNoteForEditing = (note) => {
      setEditingNote(note);
      setNoteType(note.type);
      if (note.type === 'visita') setVisitForm(note.content);
      else if (note.type === 'sonda') setSondaForm(note.content);
      else if (note.type === 'cultivos') setCultureForm(note.content);
      else if (note.type === 'antibiotico') setAbxForm(note.content);
      else if (note.type === 'somatometria') setSomatoForm(note.content);
      else if (note.type === 'laboratorios') setLabForm(note.content);
      else setSimpleNote(note.content.text);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const cancelEditing = () => { setEditingNote(null); setSimpleNote(''); };
  const getUserName = () => user.email ? user.email.split('@')[0] : 'User';

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "patients", initialPatient.id), (docSnapshot) => {
        if (docSnapshot.exists()) setPatient({ id: docSnapshot.id, ...docSnapshot.data() });
    });
    return () => unsub();
  }, [initialPatient.id]);

  const togglePreDischarge = async () => { await updateDoc(doc(db, "patients", patient.id), { preDischarge: !patient.preDischarge }); };

  const saveNote = async () => {
      let content = {};
      if (noteType === 'visita') { 
          if(!visitForm.subj) return alert("Falta subjetivo"); 
          content = { ...visitForm }; 
      } 
      else if (noteType === 'laboratorios') { content = { ...labForm }; }
      else if (noteType === 'sonda') { if(!sondaForm.fr) return alert("Calibre?"); content = { ...sondaForm }; }
      else if (noteType === 'cultivos') { content = { ...cultureForm }; }
      else if (noteType === 'antibiotico') { if(!abxForm.drug) return alert("Nombre?"); content = { ...abxForm }; }
      else if (noteType === 'somatometria') {
          if(!somatoForm.weight) return alert("Peso?");
          content = { ...somatoForm, bmi: calculateBMI(somatoForm.weight, somatoForm.height) };
      }
      else { if(!simpleNote) return alert("Nota vacía"); content = { text: simpleNote }; }

      try {
          if (editingNote) {
              const updatedNotes = patient.notes.map(n => n.id === editingNote.id ? { ...n, content, type: noteType } : n);
              await updateDoc(doc(db, "patients", patient.id), { notes: updatedNotes });
              cancelEditing();
          } else {
              const newNote = { id: Date.now().toString(), type: noteType, author: getUserName(), timestamp: new Date().toISOString(), content };
              await updateDoc(doc(db, "patients", patient.id), { notes: arrayUnion(newNote) });
              cancelEditing();
          }
      } catch (err) { alert(err.message); }
  };

  const copyMSJ = (data) => {
      const parts = [`*${patient.name}*`];
      if (data.subj) parts.push(`*S:* ${data.subj}`);
      const sv = []; if (data.ta) sv.push(`TA ${data.ta}`); if (data.fc) sv.push(`FC ${data.fc}`); if (data.temp) sv.push(`T ${data.temp}`);
      if (sv.length > 0) parts.push(`*SV:* ${sv.join(' | ')}`);
      const out = []; if (data.gu) out.push(`GU: ${data.gu}ml`); if (data.drains) out.push(`Dren: ${data.drains}`);
      if (out.length > 0) parts.push(`*Egresos:* ${out.join(' | ')}`);
      const labs = []; if (data.hb) labs.push(`Hb ${data.hb}`); if (data.hto) labs.push(`Hto ${data.hto}`); if (data.leu) labs.push(`Leu ${data.leu}`); if (data.plq) labs.push(`Plq ${data.plq}`); if (data.cr) labs.push(`Cr ${data.cr}`);
      if (labs.length > 0) parts.push(`*Labs:* ${labs.join(' ')}`);
      if (data.plan) parts.push(`*A/P:* ${data.plan}`);
      navigator.clipboard.writeText(parts.join('\n')); alert("Copiado!");
  };

  const addTask = async () => { if(!newTask) return; const newList = [...(patient.checklist || []), { task: newTask, done: false }]; await updateDoc(doc(db, "patients", patient.id), { checklist: newList, hasPending: true }); setNewTask(''); };
  const toggleTask = async (idx) => { const newList = [...(patient.checklist || [])]; newList[idx].done = !newList[idx].done; const hasPending = newList.some(x => !x.done); await updateDoc(doc(db, "patients", patient.id), { checklist: newList, hasPending }); };
  const deleteNote = async (noteId) => { if(!confirm("¿Eliminar?")) return; const newNotes = patient.notes.filter(n => n.id !== noteId); await updateDoc(doc(db, "patients", patient.id), { notes: newNotes }); };

  const LabGrid = ({ c }) => (
      <div className="grid grid-cols-4 gap-1 text-[10px] bg-slate-50 p-2 rounded border mt-1 font-mono text-center border-slate-200">
         {c.hb && <span>Hb:{c.hb}</span>} {c.hto && <span>Hto:{c.hto}</span>} {c.leu && <span>Leu:{c.leu}</span>} {c.plq && <span>Plq:{c.plq}</span>}
         {c.glu && <span>Glu:{c.glu}</span>} {c.cr && <span className="font-bold bg-yellow-100 px-1 rounded">Cr:{c.cr}</span>} {c.bun && <span>Bun:{c.bun}</span>} {c.na && <span>Na:{c.na}</span>}
         {c.k && <span>K:{c.k}</span>} {c.cl && <span>Cl:{c.cl}</span>} {c.tp && <span>TP:{c.tp}</span>} {c.ttp && <span>TTP:{c.ttp}</span>}
         {c.inr && <span>INR:{c.inr}</span>}
      </div>
  );

  return (
    <div className="bg-white min-h-full pb-20">
      {/* HEADER PACIENTE */}
      <div className="bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="p-3 flex gap-2 items-center">
            <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><ArrowLeft className="text-slate-600"/></button>
            <div className="flex-1">
                <h2 className="text-lg font-bold text-blue-900 leading-none">{patient.name}</h2>
                <div className="text-xs text-slate-500 mt-0.5 font-medium">{patient.bed} • {calculateAge(patient.dob)}a</div>
            </div>
            <div className="flex gap-2">
                <button onClick={togglePreDischarge} className={`p-2 rounded-full border transition ${patient.preDischarge ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-slate-50 text-slate-400 border-slate-200'}`} title="Pre-alta"><Home size={16}/></button>
                <button onClick={()=>setShowEdit(true)} className="p-2 bg-slate-50 rounded-full border border-slate-200 text-blue-600 hover:bg-blue-50"><Edit size={16}/></button>
            </div>
        </div>
        {/* CONDITIONAL INFO CARD - ONLY SHOW IF DATA EXISTS */}
        {(displayBMI !== '--' || antecedents.dm || antecedents.has || antecedents.cancer || patient.allergies) && (
            <div className="px-3 pb-3">
                <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 text-xs">
                    {displayBMI !== '--' && (
                        <div className="flex gap-3 mb-1.5 font-bold text-slate-700 pb-1.5 border-b border-slate-200">
                            <span>Peso: {displayWeight}kg</span> <span>Talla: {displayHeight}m</span> <span className="text-blue-700 bg-blue-100 px-1 rounded">IMC: {displayBMI}</span>
                        </div>
                    )}
                    <div className="flex flex-wrap gap-2 items-center text-slate-500">
                        {antecedents.dm && <span className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-bold">DM</span>}
                        {antecedents.has && <span className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-bold">HAS</span>}
                        {antecedents.cancer && <span className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-bold">ONCO</span>}
                        {antecedents.other && <span>{antecedents.other}</span>}
                        {patient.allergies && <span className="text-red-500 font-bold ml-auto">⚠️ {patient.allergies}</span>}
                    </div>
                </div>
            </div>
        )}
      </div>

      <div className="p-3 space-y-4 bg-slate-50 min-h-screen">
          {/* PENDIENTES */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 shadow-sm">
             <h4 className="text-xs font-bold text-yellow-800 uppercase mb-2 flex items-center gap-1"><Activity size={12}/> Pendientes</h4>
             {patient.checklist?.map((t, i) => (
                 <div key={i} className="flex items-center gap-2 mb-2 bg-white/50 p-1.5 rounded border border-yellow-100"><input type="checkbox" checked={t.done} onChange={()=>toggleTask(i)} className="w-5 h-5 accent-yellow-600 rounded"/><span className={`text-sm ${t.done?'line-through text-gray-400':'text-gray-800 font-medium'}`}>{t.task}</span></div>
             ))}
             <div className="flex gap-2 mt-2"><input className="flex-1 border border-yellow-200 text-sm p-2 rounded-lg focus:ring-2 focus:ring-yellow-500" placeholder="Nuevo pendiente..." value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTask()}/><button onClick={addTask} className="bg-yellow-500 text-white px-3 rounded-lg font-bold text-xl hover:bg-yellow-600">+</button></div>
          </div>
          
          {/* EDITOR */}
          <div className={`bg-white border rounded-xl p-4 shadow-sm ${editingNote ? 'border-blue-500 ring-2 ring-blue-100' : ''}`}>
              <div className="flex justify-between mb-3 items-center">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1"><FileText size={12}/> {editingNote ? 'Editando Nota' : 'Nueva Entrada'}</label>
                  <select className="text-xs border rounded-lg p-1.5 bg-slate-50 font-medium text-slate-700" value={noteType} onChange={e=>setNoteType(e.target.value)} disabled={!!editingNote}><option value="visita">Visita Diaria</option><option value="laboratorios">Laboratorios</option><option value="vitales">Signos Vitales</option><option value="somatometria">Peso y Talla</option><option value="cultivos">Cultivos</option><option value="antibiotico">Antibiótico</option><option value="procedimiento">Procedimiento</option><option value="imagen">Imagen (URL)</option><option value="sonda">Sonda/Drenaje</option><option value="texto">Nota Libre</option></select>
              </div>
              
              {/* FORM FIELDS - RESPONSIVE GRID FOR DRENAJES */}
              {noteType === 'visita' || noteType === 'laboratorios' ? (
                  <div className="space-y-3">
                      {noteType === 'visita' && (
                          <>
                          <textarea className="w-full border rounded-lg p-3 text-sm h-20 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500" placeholder="Subjetivo..." value={visitForm.subj} onChange={e=>setVisitForm({...visitForm, subj:e.target.value})}/>
                          <div className="flex gap-2"><input placeholder="TA" className="w-1/3 border text-center text-sm p-2 rounded-lg" value={visitForm.ta} onChange={e=>setVisitForm({...visitForm, ta:e.target.value})}/><input placeholder="FC" className="w-1/3 border text-center text-sm p-2 rounded-lg" value={visitForm.fc} onChange={e=>setVisitForm({...visitForm, fc:e.target.value})}/><input placeholder="T°" className="w-1/3 border text-center text-sm p-2 rounded-lg" value={visitForm.temp} onChange={e=>setVisitForm({...visitForm, temp:e.target.value})}/></div>
                          
                          {/* GRID RESPONSIVE PARA DRENAJES */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <input placeholder="Gasto U (ml)" className="w-full border p-2 rounded-lg text-sm" value={visitForm.gu} onChange={e=>setVisitForm({...visitForm, gu:e.target.value})}/>
                              <input placeholder="Drenajes (descripción)" className="w-full border p-2 rounded-lg text-sm" value={visitForm.drains} onChange={e=>setVisitForm({...visitForm, drains:e.target.value})}/>
                          </div>
                          </>
                      )}
                      
                      <div className="p-3 border rounded-xl bg-slate-50 border-slate-200">
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Laboratorios</p>
                          <div className="grid grid-cols-4 gap-2 mb-2">
                              <input placeholder="Hb" className="lab-input" value={noteType==='visita'?visitForm.hb:labForm.hb} onChange={e=>{const v=e.target.value; noteType==='visita'?setVisitForm({...visitForm, hb:v}):setLabForm({...labForm, hb:v})}}/>
                              <input placeholder="Hto" className="lab-input" value={noteType==='visita'?visitForm.hto:labForm.hto} onChange={e=>{const v=e.target.value; noteType==='visita'?setVisitForm({...visitForm, hto:v}):setLabForm({...labForm, hto:v})}}/>
                              <input placeholder="Leu" className="lab-input" value={noteType==='visita'?visitForm.leu:labForm.leu} onChange={e=>{const v=e.target.value; noteType==='visita'?setVisitForm({...visitForm, leu:v}):setLabForm({...labForm, leu:v})}}/>
                              <input placeholder="Plq" className="lab-input" value={noteType==='visita'?visitForm.plq:labForm.plq} onChange={e=>{const v=e.target.value; noteType==='visita'?setVisitForm({...visitForm, plq:v}):setLabForm({...labForm, plq:v})}}/>
                          </div>
                          {/* Rest of Labs Grid logic remains same but with better styling classes */}
                          {/* ... (truncated for brevity, logic identical to v28) ... */}
                          <div className="grid grid-cols-3 gap-2 mb-2"><input placeholder="Glu" className="lab-input" value={noteType==='visita'?visitForm.glu:labForm.glu} onChange={e=>{const v=e.target.value; noteType==='visita'?setVisitForm({...visitForm, glu:v}):setLabForm({...labForm, glu:v})}}/><input placeholder="Cr" className="lab-input font-bold bg-yellow-50 border-yellow-200 text-yellow-800" value={noteType==='visita'?visitForm.cr:labForm.cr} onChange={e=>{const v=e.target.value; noteType==='visita'?setVisitForm({...visitForm, cr:v}):setLabForm({...labForm, cr:v})}}/><input placeholder="BUN" className="lab-input" value={noteType==='visita'?visitForm.bun:labForm.bun} onChange={e=>{const v=e.target.value; noteType==='visita'?setVisitForm({...visitForm, bun:v}):setLabForm({...labForm, bun:v})}}/></div>
                          <div className="grid grid-cols-3 gap-2 mb-2"><input placeholder="Na" className="lab-input" value={noteType==='visita'?visitForm.na:labForm.na} onChange={e=>{const v=e.target.value; noteType==='visita'?setVisitForm({...visitForm, na:v}):setLabForm({...labForm, na:v})}}/><input placeholder="K" className="lab-input" value={noteType==='visita'?visitForm.k:labForm.k} onChange={e=>{const v=e.target.value; noteType==='visita'?setVisitForm({...visitForm, k:v}):setLabForm({...labForm, k:v})}}/><input placeholder="Cl" className="lab-input" value={noteType==='visita'?visitForm.cl:labForm.cl} onChange={e=>{const v=e.target.value; noteType==='visita'?setVisitForm({...visitForm, cl:v}):setLabForm({...labForm, cl:v})}}/></div>
                          <div className="grid grid-cols-3 gap-2"><input placeholder="TP" className="lab-input" value={noteType==='visita'?visitForm.tp:labForm.tp} onChange={e=>{const v=e.target.value; noteType==='visita'?setVisitForm({...visitForm, tp:v}):setLabForm({...labForm, tp:v})}}/><input placeholder="TTP" className="lab-input" value={noteType==='visita'?visitForm.ttp:labForm.ttp} onChange={e=>{const v=e.target.value; noteType==='visita'?setVisitForm({...visitForm, ttp:v}):setLabForm({...labForm, ttp:v})}}/><input placeholder="INR" className="lab-input" value={noteType==='visita'?visitForm.inr:labForm.inr} onChange={e=>{const v=e.target.value; noteType==='visita'?setVisitForm({...visitForm, inr:v}):setLabForm({...labForm, inr:v})}}/></div>
                          <style>{`.lab-input { border: 1px solid #e2e8f0; padding: 6px; font-size: 13px; text-align: center; border-radius: 6px; width: 100%; background: white; }`}</style>
                      </div>
                      
                      {noteType === 'visita' && <textarea className="w-full border rounded-lg p-3 text-sm h-20 bg-slate-50 focus:bg-white" placeholder="Análisis y Plan" value={visitForm.plan} onChange={e=>setVisitForm({...visitForm, plan:e.target.value})}/>}
                  </div>
              ) : noteType === 'somatometria' ? (
                  <div className="space-y-3"><div className="flex gap-2"><input placeholder="Peso (kg)" type="number" className="w-1/2 p-2.5 border rounded-lg" value={somatoForm.weight} onChange={e=>setSomatoForm({...somatoForm, weight:e.target.value})}/><input placeholder="Talla (m)" type="number" className="w-1/2 p-2.5 border rounded-lg" value={somatoForm.height} onChange={e=>setSomatoForm({...somatoForm, height:e.target.value})}/></div></div>
              ) : noteType === 'sonda' ? (
                  <div className="space-y-3"><div className="flex gap-2"><select className="flex-1 border p-2.5 rounded-lg text-sm bg-white" onChange={e=>setSondaForm({...sondaForm, type: e.target.value})}><option>Foley</option><option>JJ</option><option>Nefrostomía</option><option>Cistostomía</option></select><input placeholder="Fr" className="w-24 border p-2.5 rounded-lg text-sm text-center" onChange={e=>setSondaForm({...sondaForm, fr: e.target.value})}/></div><div className="flex flex-col"><label className="text-xs text-slate-500 font-bold mb-1">Fecha de Colocación</label><input type="date" className="border p-2.5 rounded-lg text-sm w-full bg-white" value={sondaForm.date} onChange={e=>setSondaForm({...sondaForm, date: e.target.value})}/></div></div>
              ) : noteType === 'cultivos' ? (
                  <div className="space-y-3"><select className="w-full border p-2.5 rounded-lg text-sm bg-white" onChange={e=>setCultureForm({...cultureForm, result: e.target.value})}><option>Negativo</option><option>Positivo</option></select>{cultureForm.result === 'Positivo' && (<><input placeholder="Germen / Especie" className="w-full border p-2.5 rounded-lg text-sm" onChange={e=>setCultureForm({...cultureForm, germ: e.target.value})}/><input placeholder="Sensibilidad (ej. Meropenem)" className="w-full border p-2.5 rounded-lg text-sm" onChange={e=>setCultureForm({...cultureForm, sens: e.target.value})}/></>)}</div>
              ) : noteType === 'antibiotico' ? (
                  <div className="space-y-3"><input placeholder="Nombre Antibiótico" className="w-full border p-2.5 rounded-lg text-sm" onChange={e=>setAbxForm({...abxForm, drug: e.target.value})}/><div className="flex flex-col"><label className="text-xs text-slate-500 font-bold mb-1">Fecha de Inicio</label><input type="date" className="border p-2.5 rounded-lg text-sm w-full bg-white" value={abxForm.startDate} onChange={e=>setAbxForm({...abxForm, startDate: e.target.value})}/></div></div>
              ) : (
                  <div className="space-y-2"><textarea className="w-full border rounded-lg p-3 text-sm h-24 bg-slate-50 focus:bg-white" placeholder="Escribir nota..." value={simpleNote} onChange={e=>setSimpleNote(e.target.value)}/></div>
              )}
              
              <div className="flex gap-2 pt-3 border-t mt-2">
                  {editingNote && <button onClick={cancelEditing} className="flex-1 bg-slate-200 text-slate-700 py-3 rounded-lg font-bold text-sm hover:bg-slate-300 transition">Cancelar</button>}
                  <button onClick={saveNote} className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold text-sm shadow-lg hover:bg-blue-700 transition active:scale-95">{editingNote ? 'Actualizar Nota' : 'Guardar Nota'}</button>
              </div>
          </div>
          
          <div className="space-y-3 pb-10">
              {patient.notes?.slice().reverse().map(note => (
                  <div key={note.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative group hover:shadow-md transition">
                       <div className="flex justify-between items-center text-xs text-slate-400 mb-3 border-b border-slate-100 pb-2">
                           <span className="font-mono font-medium">{new Date(note.timestamp).toLocaleDateString('es-MX', {day:'2-digit', month:'short'})} | {new Date(note.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                           <div className="flex gap-2 items-center">
                               <span className="uppercase font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[10px]">{note.author}</span>
                               <span className="uppercase font-bold bg-slate-100 px-2 py-0.5 rounded text-[10px] text-slate-500">{note.type}</span>
                               <button onClick={() => loadNoteForEditing(note)} className="text-slate-400 hover:text-blue-600 transition"><Edit size={14}/></button>
                               <button onClick={() => deleteNote(note.id)} className="text-slate-400 hover:text-red-600 transition"><Trash2 size={14}/></button>
                           </div>
                       </div>
                       
                       {/* CONTENT RENDERING (Same logic, polished UI) */}
                       {note.type === 'visita' ? (
                           <div className="text-sm space-y-2">
                               <p className="text-slate-800 whitespace-pre-wrap"><span className="font-bold text-slate-500">S:</span> {note.content.subj}</p>
                               <div className="text-xs bg-slate-50 p-2 rounded-lg border border-slate-100 grid grid-cols-2 gap-2 text-slate-600 font-mono">
                                   <span>TA: {note.content.ta} / FC: {note.content.fc}</span><span>T: {note.content.temp} / GU: {note.content.gu}</span>
                               </div>
                               {(note.content.hb || note.content.cr) && <LabGrid c={note.content}/>}
                               <p className="font-medium text-blue-900"><span className="font-bold text-slate-500">P:</span> {note.content.plan}</p>
                               <button onClick={() => copyMSJ(note.content)} className="mt-2 text-[10px] bg-green-50 text-green-700 px-3 py-1.5 rounded-full border border-green-100 flex items-center gap-1 font-bold w-full justify-center hover:bg-green-100 transition"><Copy size={12}/> COPIAR RESUMEN</button>
                           </div>
                       ) : note.type === 'laboratorios' ? (
                           <div className="text-sm space-y-1"><LabGrid c={note.content}/></div>
                       ) : note.type === 'somatometria' ? (
                           <div className="text-sm text-slate-700 flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100"><span className="font-bold">⚖️ Peso: {note.content.weight} kg</span><span>Talla: {note.content.height} m</span><span className="bg-blue-100 px-2 rounded font-bold text-blue-800">IMC: {note.content.bmi}</span></div>
                       ) : note.type === 'sonda' ? (
                           <div className="text-sm text-slate-700"><p className="font-bold text-blue-900">{note.content.type} {note.content.fr} Fr</p><p className="text-xs text-slate-500">Colocada: {new Date(note.content.date).toLocaleDateString()}</p><p className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 inline-block rounded-full mt-1 border border-red-100">Días de permanencia: {calculateDaysSince(note.content.date)} días</p></div>
                       ) : note.type === 'cultivos' ? (
                           <div className="text-sm text-slate-700"><p className={`font-bold ${note.content.result==='Positivo'?'text-red-600':'text-green-600'}`}>CULTIVO {note.content.result.toUpperCase()}</p>{note.content.result === 'Positivo' && <div className="mt-1 bg-red-50 p-2 rounded border border-red-100"><p className="font-bold">🦠 {note.content.germ}</p><p className="text-xs mt-1">Sensible: {note.content.sens}</p></div>}</div>
                       ) : note.type === 'antibiotico' ? (
                           <div className="text-sm text-slate-700"><p className="font-bold text-purple-900 text-lg">💊 {note.content.drug}</p><div className="flex justify-between items-center mt-1"><p className="text-xs text-slate-500">Inicio: {new Date(note.content.startDate).toLocaleDateString()}</p><p className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">Día {calculateTreatmentDay(note.content.startDate)}</p></div></div>
                       ) : (<div className="text-sm text-slate-800 break-words whitespace-pre-wrap">{note.type === 'imagen' ? <a href={note.content.text} target="_blank" className="text-blue-600 underline flex gap-1 items-center bg-blue-50 p-2 rounded"><LinkIcon size={14}/> Ver Imagen Adjunta</a> : note.content.text}</div>)}
                  </div>
              ))}
          </div>
      </div>
      {showEdit && <PatientFormModal onClose={() => {setShowEdit(false); onClose();}} mode="edit" initialData={patient} />}
    </div>
  );
}
