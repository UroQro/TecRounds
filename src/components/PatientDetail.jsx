import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, doc, addDoc, updateDoc, arrayUnion, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { calculateAge, calculateDaysSince, calculateTreatmentDay, calculateBMI, getLocalISODate, applyPrivacy, normalizeText, getOrderedResidents, getMemberProfile, canUserManageSchedule } from '../utils';
import { ArrowLeft, Edit, Trash2, Link as LinkIcon, Copy, Briefcase, Archive, Scissors, Search, X, FileCheck2, Megaphone, Lock } from 'lucide-react';
import PatientFormModal from './PatientFormModal';

export default function PatientDetail({ patient: initialPatient, onClose, user, dynamicResidents, dynamicDoctors, dynamicLocations, privacyMode, settingsMeta = {} }) {
  const [patient, setPatient] = useState(initialPatient);
  const [noteType, setNoteType] = useState('visita');
  const [showEdit, setShowEdit] = useState(false);
  const [showSurgeryModal, setShowSurgeryModal] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [noteSearch, setNoteSearch] = useState('');
  const [noteCategory, setNoteCategory] = useState('all'); // 'all' | 'visita' | 'labs' | 'infeccioso' | 'otros'

  const [visitForm, setVisitForm] = useState({ subj: '', ta: '', fc: '', temp: '', gu: '', drains: '', plan: '', hb: '', leu: '', plq: '', glu: '', cr: '', bun: '', na: '', k: '', cl: '', tp: '', ttp: '', inr: '', hto: '' });
  const [sondaForm, setSondaForm] = useState({ type: 'Foley', fr: '', date: getLocalISODate() });
  const [cultureForm, setCultureForm] = useState({ result: 'Negativo', germ: '', sens: '' });
  const [abxForm, setAbxForm] = useState({ drug: '', startDate: getLocalISODate() });
  const [somatoForm, setSomatoForm] = useState({ weight: '', height: '' });
  const [vitalForm, setVitalForm] = useState({ ta: '', fc: '', fr: '', temp: '', sat: '' });
  const [egoForm, setEgoForm] = useState({ isPathological: false, aspect: '', ph: '', density: '', color: '', blood: '', proteins: '', glucose: '', rbc: '', wbc: '', yeast: '', nitrites: '', cultureSent: false });
  const [reactantesForm, setReactantesForm] = useState({ pcr: '', procalcitonina: '' });
  const [simpleNote, setSimpleNote] = useState('');
  const [newTask, setNewTask] = useState('');
  const [labForm, setLabForm] = useState({ hb: '', leu: '', plq: '', glu: '', cr: '', bun: '', na: '', k: '', cl: '', tp: '', ttp: '', inr: '', hto: '' });

  const loadNoteForEditing = (note) => {
      setEditingNote(note);
      setNoteType(note.type);
      if (note.type === 'visita') setVisitForm(note.content);
      else if (note.type === 'sonda') setSondaForm(note.content);
      else if (note.type === 'cultivos') setCultureForm(note.content);
      else if (note.type === 'antibiotico') setAbxForm(note.content);
      else if (note.type === 'somatometria') setSomatoForm(note.content);
      else if (note.type === 'vitales') setVitalForm(note.content);
      else if (note.type === 'laboratorios') setLabForm(note.content);
      else if (note.type === 'reactantes') setReactantesForm(note.content);
      else if (note.type === 'ego') setEgoForm(note.content);
      else setSimpleNote(note.content.text);
      window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  const cancelEditing = () => {
      setEditingNote(null);
      setVisitForm({ subj: '', ta: '', fc: '', temp: '', gu: '', drains: '', plan: '', hb: '', leu: '', plq: '', glu: '', cr: '', bun: '', na: '', k: '', cl: '', tp: '', ttp: '', inr: '', hto: '' });
      setEgoForm({ isPathological: false, aspect: '', ph: '', density: '', color: '', blood: '', proteins: '', glucose: '', rbc: '', wbc: '', yeast: '', nitrites: '', cultureSent: false });
      setReactantesForm({ pcr: '', procalcitonina: '' });
      setSimpleNote('');
  };

  const antecedents = patient.antecedents || { dm: false, has: false, cancer: false, other: '' };
  const allergies = patient.allergies || 'Negadas';
  const cleanAllergies = String(patient.allergies || '').trim().toLowerCase();
  const hasAllergy = cleanAllergies !== '' && !['negadas', 'negada', 'negado', 'ninguna', 'ninguno', 'no', 'sin alergias', 's/a', 'n/a', 'na', '-'].includes(cleanAllergies);
  const notesReversed = useMemo(() => (patient.notes || []).slice().reverse(), [patient.notes]);
  const lastSomato = notesReversed.find(n => n.type === 'somatometria')?.content;
  const lastSonda = notesReversed.find(n => n.type === 'sonda')?.content;
  const lastAbx = notesReversed.find(n => n.type === 'antibiotico')?.content;
  const bmi = lastSomato ? lastSomato.bmi : calculateBMI(patient.weight, patient.height);

  const filteredNotes = useMemo(() => {
    const q = normalizeText(noteSearch);
    return notesReversed.filter(n => {
      if (noteCategory === 'visita' && n.type !== 'visita') return false;
      if (noteCategory === 'labs' && !['laboratorios', 'ego', 'reactantes'].includes(n.type)) return false;
      if (noteCategory === 'infeccioso' && !['cultivos', 'antibiotico', 'reactantes'].includes(n.type)) return false;
      if (noteCategory === 'otros' && ['visita', 'laboratorios', 'ego', 'reactantes', 'cultivos', 'antibiotico'].includes(n.type)) return false;

      if (q) {
        const textBlob = normalizeText(`${n.type || ''} ${n.author || ''} ${JSON.stringify(n.content || {})}`);
        if (!textBlob.includes(q)) return false;
      }
      return true;
    });
  }, [notesReversed, noteSearch, noteCategory]);

  useEffect(() => {
    const coll = patient.discharged ? "archived_patients" : "patients";
    const unsub = onSnapshot(doc(db, coll, initialPatient.id), (docSnapshot) => {
        if (docSnapshot.exists()) setPatient({ id: docSnapshot.id, ...docSnapshot.data() });
    }, (error) => console.error(error));
    return () => unsub();
  }, [initialPatient.id, patient.discharged]);

  const getUserName = () => user.email ? user.email.split('@')[0] : 'User';

  const toggleHandover = async () => {
      const coll = patient.discharged ? "archived_patients" : "patients";
      await updateDoc(doc(db, coll, patient.id), {
          forHandover: !patient.forHandover
      });
  };

  const togglePreDischarge = async () => {
      const coll = patient.discharged ? "archived_patients" : "patients";
      const next = !patient.preDischarge;
      await updateDoc(doc(db, coll, patient.id), {
          preDischarge: next,
          ...(next ? { readyForDischarge: false } : {})
      });
  };

  const toggleReadyForDischarge = async () => {
      const coll = patient.discharged ? "archived_patients" : "patients";
      const next = !patient.readyForDischarge;
      await updateDoc(doc(db, coll, patient.id), {
          readyForDischarge: next,
          ...(next ? { preDischarge: false } : {})
      });
  };

  const saveNote = async () => {
      let content = {};
      if (noteType === 'visita') { if(!visitForm.subj) return alert("Falta subjetivo"); content = { ...visitForm }; } 
      else if (noteType === 'laboratorios') { content = { ...labForm }; }
      else if (noteType === 'reactantes') { if(!reactantesForm.pcr && !reactantesForm.procalcitonina) return alert("Ingresa PCR o Procalcitonina"); content = { ...reactantesForm }; }
      else if (noteType === 'vitales') { if(!vitalForm.ta && !vitalForm.fc) return alert("Faltan datos"); content = { ...vitalForm }; }
      else if (noteType === 'sonda') { if(!sondaForm.fr) return alert("Ingresa el calibre"); content = { ...sondaForm }; }
      else if (noteType === 'cultivos') { content = { ...cultureForm }; }
      else if (noteType === 'antibiotico') { if(!abxForm.drug) return alert("Nombre?"); content = { ...abxForm }; }
      else if (noteType === 'somatometria') { if(!somatoForm.weight || !somatoForm.height) return alert("Faltan datos"); const calculatedBMI = calculateBMI(somatoForm.weight, somatoForm.height); content = { ...somatoForm, bmi: calculatedBMI }; }
      else if (noteType === 'ego') { content = { ...egoForm }; }
      else { 
          if(!simpleNote) return alert("Nota vacía"); 
          content = { text: simpleNote }; 
      }

      try {
          const coll = patient.discharged ? "archived_patients" : "patients";
          if (editingNote) {
              const updatedNotes = patient.notes.map(n => n.id === editingNote.id ? { ...n, content, type: noteType } : n);
              await updateDoc(doc(db, coll, patient.id), { notes: updatedNotes });
              cancelEditing();
          } else {
              const newNote = { id: Date.now().toString(), type: noteType, author: getUserName(), timestamp: new Date().toISOString(), content };
              await updateDoc(doc(db, coll, patient.id), { notes: arrayUnion(newNote) });
              cancelEditing();
          }
      } catch (err) { alert(err.message); }
  };

  const copyMSJ = (data) => {
      const f = data;
      let text = `*${applyPrivacy(patient.bed, privacyMode, 'bed')}*`;
      if(patient.hospital) text += ` (${patient.hospital})`;
      text += ` - *${applyPrivacy(patient.name, privacyMode, 'name')}*`;

      if (f.subj) text += `\n*S:* ${f.subj}`;
      const sv = [];
      if(f.ta) sv.push(`TA ${f.ta}`); if(f.fc) sv.push(`FC ${f.fc}`); if(f.temp) sv.push(`T ${f.temp}`);
      if(sv.length > 0) text += `\n*SV:* ${sv.join(' | ')}`;
      const liq = [];
      if(f.gu) liq.push(`GU ${f.gu}ml`); if(f.drains) liq.push(`Dren: ${f.drains}`);
      if(liq.length > 0) text += `\n*Líq:* ${liq.join(' | ')}`;
      const labs = [];
      if(f.hb) labs.push(`Hb ${f.hb}`); if(f.hto) labs.push(`Hto ${f.hto}`); if(f.leu) labs.push(`Leu ${f.leu}`); if(f.plq) labs.push(`Plq ${f.plq}`);
      if(f.glu) labs.push(`Glu ${f.glu}`); if(f.cr) labs.push(`Cr ${f.cr}`); if(f.bun) labs.push(`BUN ${f.bun}`);
      if(f.na) labs.push(`Na ${f.na}`); if(f.k) labs.push(`K ${f.k}`); if(f.cl) labs.push(`Cl ${f.cl}`);
      if(f.tp) labs.push(`TP ${f.tp}`); if(f.ttp) labs.push(`TTP ${f.ttp}`); if(f.inr) labs.push(`INR ${f.inr}`);
      if(labs.length > 0) text += `\n*Labs:* ${labs.join(' ')}`;
      if (f.plan) text += `\n*A/P:* ${f.plan}`;

      navigator.clipboard.writeText(text);
      alert("Copiado Seguro!");
  };

  const addTask = async () => { if(!newTask) return; const coll = patient.discharged ? "archived_patients" : "patients"; const newList = [...(patient.checklist || []), { task: newTask, done: false }]; await updateDoc(doc(db, coll, patient.id), { checklist: newList, hasPending: true }); setNewTask(''); };
  const toggleTask = async (idx) => { const coll = patient.discharged ? "archived_patients" : "patients"; const newList = [...(patient.checklist || [])]; newList[idx].done = !newList[idx].done; const hasPending = newList.some(x => !x.done); await updateDoc(doc(db, coll, patient.id), { checklist: newList, hasPending }); };
  const deleteNote = async (noteId) => { if(!confirm("¿Eliminar?")) return; const coll = patient.discharged ? "archived_patients" : "patients"; const newNotes = patient.notes.filter(n => n.id !== noteId); await updateDoc(doc(db, coll, patient.id), { notes: newNotes }); };
  
  const archiveTasks = async () => {
    const completed = patient.checklist?.filter(t => t.done) || [];
    if (completed.length === 0) return;
    if(!confirm(`¿Archivar ${completed.length} pendientes completados como nota?`)) return;
    const active = patient.checklist.filter(t => !t.done);
    const text = "✅ PENDIENTES RESUELTOS:\n" + completed.map(t => "• " + t.task).join("\n");
    const newNote = { id: Date.now().toString(), type: 'texto', author: getUserName(), timestamp: new Date().toISOString(), content: { text } };
    const coll = patient.discharged ? "archived_patients" : "patients";
    await updateDoc(doc(db, coll, patient.id), { checklist: active, notes: arrayUnion(newNote), hasPending: active.length > 0 });
  };

  const LabGrid = ({ c }) => (
      <div className="grid grid-cols-4 gap-1 text-[10px] bg-slate-50 dark:bg-slate-700 p-2 rounded border dark:border-slate-600 mt-1 font-mono text-center text-slate-800 dark:text-slate-200">
         {c.hb && <span>Hb:{c.hb}</span>} {c.hto && <span>Hto:{c.hto}</span>} {c.leu && <span>Leu:{c.leu}</span>} {c.plq && <span>Plq:{c.plq}</span>}
         {c.glu && <span>Glu:{c.glu}</span>} {c.cr && <span className="font-bold bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-100">Cr:{c.cr}</span>} {c.bun && <span>Bun:{c.bun}</span>} {c.na && <span>Na:{c.na}</span>}
         {c.k && <span>K:{c.k}</span>} {c.cl && <span>Cl:{c.cl}</span>} {c.tp && <span>TP:{c.tp}</span>} {c.ttp && <span>TTP:{c.ttp}</span>}
         {c.inr && <span>INR:{c.inr}</span>}
      </div>
  );

  const inputClass = "w-full border dark:border-slate-600 rounded p-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500";

  return (
    <div className="bg-gray-50 dark:bg-slate-900 min-h-full pb-20 transition-colors">
      <div className={`border-b border-blue-100 dark:border-slate-700 p-3 flex gap-1.5 items-center shadow-sm rounded-t-xl ${patient.readyForDischarge ? 'bg-emerald-50 dark:bg-emerald-950' : patient.preDischarge ? 'bg-purple-50 dark:bg-purple-900' : 'bg-white dark:bg-slate-800'}`}>
          <button onClick={onClose} className="pr-1"><ArrowLeft className="text-slate-600 dark:text-slate-300"/></button>
          <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-none truncate">{applyPrivacy(patient.name, privacyMode, 'name')}</h2>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex flex-wrap gap-1.5 items-center">
                  <span>{applyPrivacy(patient.bed, privacyMode, 'bed')} {patient.hospital && `(${patient.hospital})`} • {calculateAge(patient.dob)}a</span>
                  {patient.type && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-black/10 dark:border-white/10 uppercase bg-white dark:bg-slate-700 dark:text-white">{patient.type}</span>}
                  {antecedents.dm && <span className="w-4 h-4 rounded bg-sky-600 text-white text-[10px] font-black inline-flex items-center justify-center shadow-sm" title="Diabético (DM)">D</span>}
                  {antecedents.has && <span className="w-4 h-4 rounded bg-orange-500 text-white text-[10px] font-black inline-flex items-center justify-center shadow-sm" title="Hipertenso (HAS)">H</span>}
                  {hasAllergy && <span className="w-4 h-4 rounded bg-red-600 text-white text-[10px] font-black inline-flex items-center justify-center shadow-sm" title={`Alergias: ${patient.allergies}`}>A</span>}
                  {bmi && <span className="bg-white dark:bg-slate-700 px-1 rounded font-bold text-blue-800 dark:text-blue-300 border border-blue-100 dark:border-slate-600">IMC: {bmi}</span>}
                  {patient.forHandover && <span className="bg-indigo-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">📢 ENTREGA</span>}
                  {patient.readyForDischarge && <span className="bg-emerald-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">✅ ALTA</span>}
              </div>
          </div>
          
          <button onClick={toggleHandover} className={`p-2 rounded-full shadow border border-slate-200 dark:border-slate-600 transition ${patient.forHandover ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-700 text-gray-400'}`} title="Marcar para comentar en Entrega">
              <Megaphone size={16}/>
          </button>

          <button onClick={() => setShowSurgeryModal(true)} className="p-2 rounded-full shadow border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-orange-500 hover:bg-orange-50 dark:hover:bg-slate-600" title="Programar Cirugía">
              <Scissors size={16}/>
          </button>

          <button onClick={toggleReadyForDischarge} className={`p-2 rounded-full shadow border border-slate-200 dark:border-slate-600 transition ${patient.readyForDischarge ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-slate-700 text-gray-400'}`} title="Alta lista (en espera de desocupar cama)">
              <FileCheck2 size={16}/>
          </button>
          
          <button onClick={togglePreDischarge} className={`p-2 rounded-full shadow border border-slate-200 dark:border-slate-600 transition ${patient.preDischarge ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-slate-700 text-gray-400'}`} title="Pre-alta"><Briefcase size={16}/></button>
          <button onClick={()=>setShowEdit(true)} className="p-2 bg-white dark:bg-slate-700 rounded-full shadow text-blue-600 dark:text-blue-400" title="Editar paciente"><Edit size={16}/></button>
      </div>

      <div className="p-3 space-y-4 bg-gray-50 dark:bg-slate-900 min-h-screen">
          <div className="bg-white dark:bg-slate-800 border border-blue-50 dark:border-slate-700 rounded p-3 text-xs shadow-md dark:shadow-sm text-slate-900 dark:text-slate-200">
             <div className="flex flex-wrap gap-1.5 mb-1.5">
                 {antecedents.dm && <span className="bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-200 px-2 py-0.5 rounded font-bold">DM</span>}
                 {antecedents.has && <span className="bg-orange-100 dark:bg-orange-900/60 text-orange-800 dark:text-orange-200 px-2 py-0.5 rounded font-bold">HAS</span>}
                 {antecedents.cancer && <span className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-2 py-0.5 rounded font-bold">ONCO</span>}
                 {lastAbx && (
                     <span className="bg-fuchsia-100 dark:bg-fuchsia-900/50 text-fuchsia-800 dark:text-fuchsia-200 px-2 py-0.5 rounded font-bold">
                         💊 {lastAbx.drug} (Día {calculateTreatmentDay(lastAbx.startDate)})
                     </span>
                 )}
                 {lastSonda && (
                     <span className="bg-cyan-100 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-200 px-2 py-0.5 rounded font-bold">
                         🔌 {lastSonda.type} {lastSonda.fr}Fr ({calculateDaysSince(lastSonda.date)}d)
                     </span>
                 )}
             </div>
             {antecedents.other && <p className="text-gray-600 dark:text-gray-400"><strong>Ant:</strong> {antecedents.other}</p>}
             {hasAllergy && <p className="text-red-600 dark:text-red-400 mt-1"><strong>Alergias:</strong> {allergies}</p>}
             <p className="text-gray-500 dark:text-gray-400 mt-1"><strong>Dx:</strong> {patient.diagnosis}</p>
             <div className="flex justify-between items-center text-[11px] text-gray-500 dark:text-gray-400 mt-2 pt-1.5 border-t border-gray-100 dark:border-slate-700">
                 <span><strong>Tratante:</strong> {applyPrivacy(patient.doctor || 'S/A', privacyMode, 'name')}</span>
                 <span className="flex items-center gap-1">
                     <strong>Residente:</strong>
                     {patient.resident ? (() => {
                         const prof = getMemberProfile(patient.resident, settingsMeta);
                         return (
                             <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-bold ${prof.color.badge}`}>
                                 <span className={`w-1.5 h-1.5 rounded-full ${prof.color.dot}`}></span>
                                 {patient.resident}
                             </span>
                         );
                     })() : 'S/A'}
                 </span>
             </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900 rounded p-3 shadow-md dark:shadow-sm text-slate-900 dark:text-slate-200">
             <div className="flex justify-between items-center mb-2">
                 <h4 className="text-xs font-bold text-yellow-800 dark:text-yellow-500 uppercase">Pendientes</h4>
                 {patient.checklist?.some(t => t.done) && (
                     <button onClick={archiveTasks} className="text-[10px] flex items-center gap-1 bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded font-bold shadow-sm hover:opacity-80 transition"><Archive size={12}/> Archivar</button>
                 )}
             </div>
             {patient.checklist?.map((t, i) => (
                 <div key={i} className="flex items-center gap-2 mb-1"><input type="checkbox" checked={t.done} onChange={()=>toggleTask(i)} className="w-5 h-5 accent-yellow-600"/><span className={`text-sm ${t.done?'line-through text-gray-400 dark:text-gray-600':'text-gray-900 dark:text-gray-300'}`}>{t.task}</span></div>
             ))}
             <div className="flex gap-2 mt-2"><input className={inputClass} placeholder="Nuevo pendiente..." value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTask()}/><button onClick={addTask} className="bg-yellow-500 text-white px-3 rounded font-bold text-xl">+</button></div>
          </div>
          
          <div className={`bg-white dark:bg-slate-800 border border-blue-50 dark:border-slate-700 rounded-lg p-3 shadow-md dark:shadow-sm text-slate-900 dark:text-white ${editingNote ? 'border-blue-500 ring-2 ring-blue-100' : ''}`}>
              <div className="flex justify-between mb-2 items-center">
                  <label className="text-xs font-bold text-slate-400 uppercase">{editingNote ? 'Editando Nota' : 'Nueva Entrada'}</label>
                  <select className="text-xs border border-gray-200 dark:border-slate-600 rounded p-1 bg-gray-50 dark:bg-slate-700 text-slate-900 dark:text-white" value={noteType} onChange={e=>setNoteType(e.target.value)} disabled={!!editingNote}>
                      <option value="visita">Visita Diaria</option><option value="laboratorios">Laboratorios</option><option value="reactantes">Reactantes</option><option value="ego">EGO</option><option value="vitales">Signos Vitales</option><option value="somatometria">Peso y Talla</option><option value="cultivos">Cultivos</option><option value="antibiotico">Antibiótico</option><option value="procedimiento">Procedimiento</option><option value="imagen">Imagen (URL)</option><option value="sonda">Sonda/Drenaje</option><option value="texto">Nota Libre</option>
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
              {noteType === 'laboratorios' && (
                  <div className="space-y-2"><div className="p-2 border rounded bg-slate-50 dark:bg-slate-700"><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Laboratorios</p><div className="grid grid-cols-3 gap-1 mb-1"><input placeholder="Hb" className={inputClass} value={labForm.hb} onChange={e=>setLabForm({...labForm, hb:e.target.value})}/><input placeholder="Leu" className={inputClass} value={labForm.leu} onChange={e=>setLabForm({...labForm, leu:e.target.value})}/><input placeholder="Plq" className={inputClass} value={labForm.plq} onChange={e=>setLabForm({...labForm, plq:e.target.value})}/></div><div className="grid grid-cols-3 gap-1 mb-1"><input placeholder="Glu" className={inputClass} value={labForm.glu} onChange={e=>setLabForm({...labForm, glu:e.target.value})}/><input placeholder="Cr" className={inputClass} value={labForm.cr} onChange={e=>setLabForm({...labForm, cr:e.target.value})}/><input placeholder="BUN" className={inputClass} value={labForm.bun} onChange={e=>setLabForm({...labForm, bun:e.target.value})}/></div><div className="grid grid-cols-3 gap-1 mb-1"><input placeholder="Na" className={inputClass} value={labForm.na} onChange={e=>setLabForm({...labForm, na:e.target.value})}/><input placeholder="K" className={inputClass} value={labForm.k} onChange={e=>setLabForm({...labForm, k:e.target.value})}/><input placeholder="Cl" className={inputClass} value={labForm.cl} onChange={e=>setLabForm({...labForm, cl:e.target.value})}/></div></div></div>
              )}
              {noteType === 'reactantes' && (
                  <div className="space-y-2">
                      <div className="p-2.5 border dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-700">
                          <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Reactantes de Fase Aguda</p>
                          <div className="grid grid-cols-2 gap-2">
                              <div>
                                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 block mb-1">PCR (mg/dL o mg/L)</label>
                                  <input placeholder="Ej. 4.5" className={inputClass} value={reactantesForm.pcr || ''} onChange={e=>setReactantesForm({...reactantesForm, pcr:e.target.value})}/>
                              </div>
                              <div>
                                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 block mb-1">Procalcitonina (ng/mL)</label>
                                  <input placeholder="Ej. 0.8" className={inputClass} value={reactantesForm.procalcitonina || ''} onChange={e=>setReactantesForm({...reactantesForm, procalcitonina:e.target.value})}/>
                              </div>
                          </div>
                      </div>
                  </div>
              )}
              {noteType === 'ego' && (
                  <div className="space-y-3">
                     <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-700 rounded">
                        <button onClick={()=>setEgoForm({...egoForm, isPathological: false})} className={`flex-1 py-1 text-xs font-bold rounded transition ${!egoForm.isPathological ? 'bg-green-500 text-white shadow' : 'text-slate-500'}`}>NO PATOLÓGICO</button>
                        <button onClick={()=>setEgoForm({...egoForm, isPathological: true})} className={`flex-1 py-1 text-xs font-bold rounded transition ${egoForm.isPathological ? 'bg-red-500 text-white shadow' : 'text-slate-500'}`}>PATOLÓGICO</button>
                     </div>
                     {egoForm.isPathological && (
                        <div className="grid grid-cols-3 gap-2">
                            <input placeholder="Color" className={inputClass} value={egoForm.color} onChange={e=>setEgoForm({...egoForm, color:e.target.value})} />
                            <input placeholder="Aspecto" className={inputClass} value={egoForm.aspect} onChange={e=>setEgoForm({...egoForm, aspect:e.target.value})} />
                            <input placeholder="pH" className={inputClass} value={egoForm.ph} onChange={e=>setEgoForm({...egoForm, ph:e.target.value})} />
                            <input placeholder="Densidad" className={inputClass} value={egoForm.density} onChange={e=>setEgoForm({...egoForm, density:e.target.value})} />
                            <input placeholder="Sangre" className={inputClass} value={egoForm.blood} onChange={e=>setEgoForm({...egoForm, blood:e.target.value})} />
                            <input placeholder="Proteínas" className={inputClass} value={egoForm.proteins} onChange={e=>setEgoForm({...egoForm, proteins:e.target.value})} />
                            <input placeholder="Glucosa" className={inputClass} value={egoForm.glucose} onChange={e=>setEgoForm({...egoForm, glucose:e.target.value})} />
                            <input placeholder="Eritrocitos" className={inputClass} value={egoForm.rbc} onChange={e=>setEgoForm({...egoForm, rbc:e.target.value})} />
                            <input placeholder="Leucocitos" className={inputClass} value={egoForm.wbc} onChange={e=>setEgoForm({...egoForm, wbc:e.target.value})} />
                            <input placeholder="Levaduras" className={inputClass} value={egoForm.yeast} onChange={e=>setEgoForm({...egoForm, yeast:e.target.value})} />
                            <input placeholder="Nitritos" className={inputClass} value={egoForm.nitrites} onChange={e=>setEgoForm({...egoForm, nitrites:e.target.value})} />
                        </div>
                     )}
                     <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 p-2 border rounded border-slate-200 dark:border-slate-700">
                        <input type="checkbox" checked={egoForm.cultureSent} onChange={e=>setEgoForm({...egoForm, cultureSent:e.target.checked})} className="w-4 h-4" />
                        Se envió urocultivo
                     </label>
                  </div>
              )}
              {noteType === 'vitales' && (
                   <div className="space-y-3">
                       <div className="flex gap-2"><input placeholder="TA (120/80)" className={inputClass} value={vitalForm.ta || ''} onChange={e=>setVitalForm({...vitalForm, ta:e.target.value})} /><input placeholder="FC (lpm)" className={inputClass} value={vitalForm.fc || ''} onChange={e=>setVitalForm({...vitalForm, fc:e.target.value})} /><input placeholder="FR (rpm)" className={inputClass} value={vitalForm.fr || ''} onChange={e=>setVitalForm({...vitalForm, fr:e.target.value})} /></div>
                       <div className="flex gap-2"><input placeholder="Temp (°C)" className={inputClass} value={vitalForm.temp || ''} onChange={e=>setVitalForm({...vitalForm, temp:e.target.value})} /><input placeholder="SatO2 (%)" className={inputClass} value={vitalForm.sat || ''} onChange={e=>setVitalForm({...vitalForm, sat:e.target.value})} /></div>
                   </div>
              )}
              {noteType === 'somatometria' && (
                  <div className="space-y-3"><div className="flex gap-2"><input placeholder="Peso (kg)" type="number" className={inputClass} value={somatoForm.weight} onChange={e=>setSomatoForm({...somatoForm, weight:e.target.value})}/><input placeholder="Talla (m)" type="number" className={inputClass} value={somatoForm.height} onChange={e=>setSomatoForm({...somatoForm, height:e.target.value})}/></div></div>
              )}
              {noteType === 'sonda' && (
                  <div className="space-y-3"><div className="flex gap-2"><select className={inputClass} onChange={e=>setSondaForm({...sondaForm, type: e.target.value})}><option>Foley</option><option>JJ</option><option>Nefrostomía</option><option>Cistostomía</option></select><input placeholder="Fr" className={inputClass} onChange={e=>setSondaForm({...sondaForm, fr: e.target.value})}/></div><div className="flex flex-col"><label className="text-xs text-gray-500 font-bold">Fecha de Colocación</label><input type="date" className={inputClass} value={sondaForm.date} onChange={e=>setSondaForm({...sondaForm, date: e.target.value})}/></div></div>
              )}
              {noteType === 'cultivos' && (
                  <div className="space-y-3"><select className={inputClass} onChange={e=>setCultureForm({...cultureForm, result: e.target.value})}><option>Negativo</option><option>Positivo</option></select>{cultureForm.result === 'Positivo' && (<><input placeholder="Germen / Especie" className={inputClass} onChange={e=>setCultureForm({...cultureForm, germ: e.target.value})}/><input placeholder="Sensibilidad (ej. Meropenem)" className={inputClass} onChange={e=>setCultureForm({...cultureForm, sens: e.target.value})}/></>)}</div>
              )}
              {noteType === 'antibiotico' && (
                  <div className="space-y-3"><input placeholder="Nombre Antibiótico" className={inputClass} onChange={e=>setAbxForm({...abxForm, drug: e.target.value})}/><div className="flex flex-col"><label className="text-xs text-gray-500 font-bold">Fecha de Inicio</label><input type="date" className={inputClass} value={abxForm.startDate} onChange={e=>setAbxForm({...abxForm, startDate: e.target.value})}/></div></div>
              )}
              {(noteType === 'texto' || noteType === 'procedimiento' || noteType === 'imagen') && (
                  <div className="space-y-2"><textarea className={inputClass + " h-24"} placeholder={noteType === 'imagen' ? "Pegar URL de la imagen..." : "Escribir nota..."} value={simpleNote} onChange={e=>setSimpleNote(e.target.value)}/></div>
              )}
              
              <div className="flex gap-2 pt-2">
                  {editingNote && <button onClick={cancelEditing} className="flex-1 bg-gray-300 dark:bg-slate-600 text-gray-700 dark:text-white py-3 rounded font-bold text-sm">Cancelar</button>}
                  <button onClick={saveNote} className="flex-1 bg-blue-600 text-white py-3 rounded font-bold text-sm shadow-md">{editingNote ? 'Actualizar Nota' : 'Guardar'}</button>
              </div>
          </div>

          {/* Buscador y filtro de notas del expediente */}
          {(patient.notes?.length || 0) > 0 && (
              <div className="bg-white dark:bg-slate-800 border border-blue-50 dark:border-slate-700 rounded-lg p-2.5 shadow-sm space-y-2">
                  <div className="relative">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      <input
                          type="text"
                          value={noteSearch}
                          onChange={e => setNoteSearch(e.target.value)}
                          placeholder="Buscar en notas, laboratorios, reactantes, cultivos..."
                          className="w-full pl-8 pr-7 py-1.5 border border-gray-200 dark:border-slate-600 rounded text-xs bg-gray-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                      />
                      {noteSearch && (
                          <button onClick={() => setNoteSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white">
                              <X size={13} />
                          </button>
                      )}
                  </div>
                  <div className="flex gap-1 overflow-x-auto pb-0.5 text-[11px] font-bold">
                      {[
                          { id: 'all', label: `Todas (${notesReversed.length})` },
                          { id: 'visita', label: 'Visitas' },
                          { id: 'labs', label: 'Labs / React / EGO' },
                          { id: 'infeccioso', label: 'Cultivos / Abx' },
                          { id: 'otros', label: 'Sondas / Otros' }
                      ].map(cat => (
                          <button
                              key={cat.id}
                              onClick={() => setNoteCategory(cat.id)}
                              className={`px-2.5 py-1 rounded-full whitespace-nowrap transition ${noteCategory === cat.id ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                          >
                              {cat.label}
                          </button>
                      ))}
                  </div>
              </div>
          )}

          <div className="space-y-3 pb-10">
              {filteredNotes.map(note => {
                  const authorProf = getMemberProfile(note.author, settingsMeta);
                  return (
                  <div key={note.id} className="bg-white dark:bg-slate-800 border border-blue-50 dark:border-slate-700 rounded p-3 shadow-md dark:shadow-sm relative group text-slate-900 dark:text-slate-200">
                       <div className="flex justify-between items-center text-xs text-gray-400 mb-2 border-b border-gray-100 dark:border-slate-700 pb-1">
                           <span className="font-mono">{new Date(note.timestamp).toLocaleDateString('es-MX', {day:'2-digit', month:'short'})} | {new Date(note.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                           <div className="flex gap-1.5 items-center">
                               <span className={`uppercase font-extrabold px-2 py-0.5 rounded border text-[10px] inline-flex items-center gap-1 ${authorProf.color.badge}`}>
                                   <span className={`w-1.5 h-1.5 rounded-full ${authorProf.color.dot}`}></span>
                                   {note.author}
                               </span>
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
                       ) : note.type === 'ego' ? (
                           <div className={`text-sm ${note.content.isPathological ? 'border-l-4 border-red-500 pl-2' : 'border-l-4 border-green-500 pl-2'}`}>
                               <div className="flex justify-between items-center mb-1">
                                   <span className={`font-bold ${note.content.isPathological ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                       {note.content.isPathological ? 'EGO PATOLÓGICO' : 'EGO NO PATOLÓGICO'}
                                   </span>
                                   {note.content.cultureSent && <span className="text-[10px] bg-blue-100 text-blue-800 px-2 rounded-full font-bold">CULTIVO ENVIADO</span>}
                               </div>
                               {note.content.isPathological && (
                                   <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-xs text-gray-700 dark:text-gray-300 mt-2 bg-slate-50 dark:bg-slate-700/50 p-2 rounded">
                                       {note.content.color && <p>Color: {note.content.color}</p>}
                                       {note.content.aspect && <p>Asp: {note.content.aspect}</p>}
                                       {note.content.ph && <p>pH: {note.content.ph}</p>}
                                       {note.content.density && <p>Den: {note.content.density}</p>}
                                       {note.content.blood && <p>Sng: {note.content.blood}</p>}
                                       {note.content.proteins && <p>Prot: {note.content.proteins}</p>}
                                       {note.content.glucose && <p>Glu: {note.content.glucose}</p>}
                                       {note.content.rbc && <p>Eri: {note.content.rbc}</p>}
                                       {note.content.wbc && <p>Leu: {note.content.wbc}</p>}
                                       {note.content.yeast && <p>Lev: {note.content.yeast}</p>}
                                       {note.content.nitrites && <p>Nit: {note.content.nitrites}</p>}
                                   </div>
                               )}
                           </div>
                       ) : note.type === 'laboratorios' ? (
                           <div className="text-sm space-y-1"><LabGrid c={note.content}/></div>
                       ) : note.type === 'reactantes' ? (
                           <div className="grid grid-cols-2 gap-2 text-xs bg-amber-50/70 dark:bg-amber-950/30 p-2 rounded border border-amber-200 dark:border-amber-800/60 font-mono">
                               <div className="flex justify-between items-center bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded border border-amber-100 dark:border-slate-700">
                                   <span className="font-bold text-amber-800 dark:text-amber-300">PCR:</span>
                                   <span className="font-extrabold text-slate-900 dark:text-white">{note.content.pcr || '—'}</span>
                               </div>
                               <div className="flex justify-between items-center bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded border border-amber-100 dark:border-slate-700">
                                   <span className="font-bold text-rose-700 dark:text-rose-300">Procalcitonina:</span>
                                   <span className="font-extrabold text-slate-900 dark:text-white">{note.content.procalcitonina || '—'}</span>
                               </div>
                           </div>
                       ) : note.type === 'vitales' ? (
                           <div className="text-sm space-y-1 font-mono bg-slate-50 dark:bg-slate-700 p-2 rounded">
                               <p>TA: {note.content.ta} mmHg</p><p>FC: {note.content.fc} lpm</p><p>FR: {note.content.fr} rpm</p><p>Temp: {note.content.temp}°C</p><p>SatO2: {note.content.sat}%</p>
                           </div>
                       ) : note.type === 'somatometria' ? (
                           <div className="text-sm text-gray-800 flex justify-between items-center"><span className="font-bold">⚖️ Peso: {note.content.weight} kg</span><span>Talla: {note.content.height} m</span><span className="bg-blue-100 dark:bg-blue-900/50 px-2 rounded font-bold text-blue-800 dark:text-blue-200">IMC: {note.content.bmi}</span></div>
                       ) : note.type === 'sonda' ? (
                           <div className="text-sm text-gray-800 dark:text-gray-200"><p className="font-bold text-blue-900 dark:text-blue-300">{note.content.type} {note.content.fr} Fr</p><p className="text-xs text-gray-500 dark:text-gray-400">Colocada: {new Date(note.content.date).toLocaleDateString()}</p><p className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/30 p-1 inline-block rounded mt-1">Días de permanencia: {calculateDaysSince(note.content.date)} días</p></div>
                       ) : note.type === 'cultivos' ? (
                           <div className="text-sm text-gray-800 dark:text-gray-200"><p className={`font-bold ${note.content.result==='Positivo'?'text-red-600':'text-green-600'}`}>CULTIVO {note.content.result.toUpperCase()}</p>{note.content.result === 'Positivo' && <><p>🦠 {note.content.germ}</p><p className="text-xs bg-slate-100 dark:bg-slate-700 p-1 mt-1 rounded">Sensible: {note.content.sens}</p></>}</div>
                       ) : note.type === 'antibiotico' ? (
                           <div className="text-sm text-gray-800 dark:text-gray-200"><p className="font-bold text-purple-900 dark:text-purple-300">💊 {note.content.drug}</p><p className="text-xs text-gray-500 dark:text-gray-400">Inicio: {new Date(note.content.startDate).toLocaleDateString()}</p><p className="text-xs font-bold text-purple-600 bg-purple-50 dark:bg-purple-900/30 p-1 inline-block rounded mt-1">Día {calculateTreatmentDay(note.content.startDate)} de tratamiento</p></div>
                       ) : (<div className="text-sm text-gray-800 dark:text-gray-200 break-words">{note.type === 'imagen' ? <a href={note.content.text} target="_blank" className="text-blue-600 underline flex gap-1 items-center"><LinkIcon size={14}/> Ver Imagen</a> : note.content.text}</div>)}
                  </div>
                  );
              })}
              {filteredNotes.length === 0 && (patient.notes?.length || 0) > 0 && (
                  <p className="text-center text-xs text-gray-400 py-4">No hay notas que coincidan con la búsqueda.</p>
              )}
          </div>
      </div>
      
      {showEdit && <PatientFormModal onClose={() => setShowEdit(false)} mode="edit" initialData={patient} dynamicResidents={dynamicResidents} dynamicDoctors={dynamicDoctors} dynamicLocations={dynamicLocations} settingsMeta={settingsMeta} />}
      
      {/* 🔥 MODAL DE PROGRAMAR CIRUGÍA DESDE EL CENSO 🔥 */}
      {showSurgeryModal && <ScheduleSurgeryModal user={user} onClose={() => setShowSurgeryModal(false)} patient={patient} dynamicResidents={dynamicResidents} dynamicDoctors={dynamicDoctors} dynamicLocations={dynamicLocations} settingsMeta={settingsMeta} />}
    </div>
  );
}

// 🔥 COMPONENTE NUEVO: MODAL PARA AGENDAR DESDE EL DETALLE DEL PACIENTE 🔥
function ScheduleSurgeryModal({ user, onClose, patient, dynamicResidents, dynamicDoctors, dynamicLocations, settingsMeta = {} }) {
    const { allowed: canManageSchedule } = canUserManageSchedule(user, settingsMeta);
    const [form, setForm] = useState({ 
        date: getLocalISODate(), 
        time: '', 
        duration: 1,
        patientName: patient.name || '', 
        procedure: '', 
        location: patient.hospital || '', 
        doctor: patient.doctor || '', 
        resident: canManageSchedule ? (patient.resident || '') : '', 
        resident2: '', 
        completed: false, 
        cancelled: false 
    });
    
    const [isOtherDoc, setIsOtherDoc] = useState(false);
    const [isOtherRes, setIsOtherRes] = useState(false);
    
    const resOptions = [...(dynamicResidents || [])];
    if (form.resident && !resOptions.includes(form.resident) && form.resident !== 'Otro') resOptions.push(form.resident);
    const { allOrdered: orderedRes, hzhResidents, otherResidents } = getOrderedResidents(resOptions, settingsMeta);

    const docOptions = [...(dynamicDoctors || [])];
    if (form.doctor && !docOptions.includes(form.doctor) && form.doctor !== 'Otro') docOptions.push(form.doctor);
    docOptions.sort();

    const locOptions = [...(dynamicLocations || [])];
    if (form.location && !locOptions.includes(form.location) && form.location !== 'Otro') locOptions.push(form.location);
    locOptions.sort();

    useEffect(() => {
        if(form.doctor && !dynamicDoctors?.includes(form.doctor)) setIsOtherDoc(true);
        if(form.resident && !dynamicResidents?.includes(form.resident)) setIsOtherRes(true);
    }, []);

    const handleSubmit = async (e) => { 
        e.preventDefault(); 
        try { 
            const payload = {
                ...form,
                duration: Number(form.duration) || 1,
                resident: canManageSchedule ? form.resident : '',
                resident2: canManageSchedule ? (form.resident2 || '') : ''
            };
            await addDoc(collection(db, "surgeries"), payload); 
            alert(`¡Cirugía programada para ${form.patientName}!`);
            onClose(); 
        } catch(err) { 
            alert(err.message); 
        } 
    };
    
    const inputClass = "w-full p-2 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white bg-white dark:bg-slate-700";

    const renderResOptions = () => (
        <>
            {hzhResidents.length > 0 ? (
                <>
                    <optgroup label="📍 Rotando en Zambrano (HZH)">
                        {hzhResidents.map(r => (
                            <option key={r} value={r}>{r}</option>
                        ))}
                    </optgroup>
                    {otherResidents.length > 0 && (
                        <optgroup label="Otros Residentes">
                            {otherResidents.map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </optgroup>
                    )}
                </>
            ) : (
                orderedRes.map(r => (
                    <option key={r} value={r}>{r}</option>
                ))
            )}
        </>
    );

    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto text-slate-900 dark:text-white">
              <h2 className="text-xl font-bold mb-1 text-slate-800 dark:text-white">Programar Cirugía</h2>
              <p className="text-xs text-orange-600 dark:text-orange-400 mb-4 font-bold bg-orange-50 dark:bg-orange-900/30 p-2 rounded">Datos copiados desde Censo</p>
              
              <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                      <input type="date" required className={inputClass} value={form.date} onChange={e=>setForm({...form, date:e.target.value})} />
                      <input type="time" required className={inputClass} value={form.time} onChange={e=>setForm({...form, time:e.target.value})} />
                      <select className={inputClass} value={form.duration || 1} onChange={e=>setForm({...form, duration: parseFloat(e.target.value)})}>
                          <option value={0.5}>30 min</option>
                          <option value={1}>1 hr (Default)</option>
                          <option value={1.5}>1.5 hrs</option>
                          <option value={2}>2 hrs</option>
                          <option value={2.5}>2.5 hrs</option>
                          <option value={3}>3 hrs</option>
                          <option value={4}>4 hrs</option>
                          <option value={5}>5 hrs</option>
                          <option value={6}>6 hrs</option>
                      </select>
                  </div>
                  <select required className={inputClass} value={form.location} onChange={e=>setForm({...form, location:e.target.value})}><option value="">Sede...</option>{locOptions.map(l=><option key={l} value={l}>{l}</option>)}</select>
                  <input required placeholder="Paciente" className={inputClass} value={form.patientName} onChange={e=>setForm({...form, patientName:e.target.value})} />
                  <input required placeholder="Procedimiento" className={inputClass} value={form.procedure} onChange={e=>setForm({...form, procedure:e.target.value})} />
                  
                  <div className="space-y-1"><select required={!isOtherDoc} className={`text-xs ${inputClass}`} value={isOtherDoc ? 'Otro' : form.doctor} onChange={e=>{ if(e.target.value==='Otro') { setIsOtherDoc(true); setForm({...form, doctor: ''}); } else { setIsOtherDoc(false); setForm({...form, doctor:e.target.value}); }}}> <option value="">Tratante</option>{docOptions.map(d=><option key={d} value={d}>{d}</option>)}<option value="Otro">Otro / Agregar...</option></select>{isOtherDoc && <input placeholder="Nombre Tratante" required className={`text-xs bg-blue-50 ${inputClass}`} value={form.doctor} onChange={e=>setForm({...form, doctor:e.target.value})}/>}</div>
                  
                  {canManageSchedule && (
                      <>
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-gray-500">Residente Principal</label>
                              <select className={`text-xs ${inputClass}`} value={isOtherRes ? 'Otro' : form.resident} onChange={e=>{ if(e.target.value==='Otro') { setIsOtherRes(true); setForm({...form, resident: ''}); } else { setIsOtherRes(false); setForm({...form, resident:e.target.value}); }}}> <option value="">No Asignado</option>{renderResOptions()}<option value="Otro">Otro / Agregar...</option></select>
                              {isOtherRes && <input placeholder="Nombre Residente" required className={`text-xs bg-blue-50 ${inputClass}`} value={form.resident} onChange={e=>setForm({...form, resident:e.target.value})}/>}
                          </div>
                          
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-gray-500">2do Residente (Opcional)</label>
                              <select className={`text-xs ${inputClass}`} value={form.resident2 || ''} onChange={e=>setForm({...form, resident2:e.target.value})}> <option value="">Ninguno</option>{renderResOptions()}</select>
                          </div>
                      </>
                  )}

                  <div className="flex gap-2 mt-4 pt-2 border-t dark:border-slate-700"><button type="button" onClick={onClose} className="flex-1 bg-gray-100 dark:bg-slate-600 text-gray-800 dark:text-white py-3 rounded font-bold">Cancelar</button><button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded font-bold shadow-lg">Guardar</button></div>
              </form>
          </div>
      </div>
    );
}
