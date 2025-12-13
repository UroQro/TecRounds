import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { addDoc, updateDoc, collection, doc } from 'firebase/firestore';
import { DOCTORS, RESIDENTS } from '../constants';
import { getLocalISODate } from '../utils';

export default function PatientFormModal({ onClose, mode, initialData }) {
  const [form, setForm] = useState(initialData || { 
      name: '', bed: '', type: 'HO', doctor: '', resident: '', admissionDate: getLocalISODate(), dob: '', diagnosis: '',
      antecedents: { dm: false, has: false, cancer: false, other: '' }, allergies: ''
  });
  const [isOtherDoc, setIsOtherDoc] = useState(false);
  const [isOtherRes, setIsOtherRes] = useState(false);

  useEffect(() => {
     if(mode === 'edit' && initialData) {
         if(!DOCTORS.includes(initialData.doctor) && initialData.doctor) setIsOtherDoc(true);
         if(!RESIDENTS.includes(initialData.resident) && initialData.resident) setIsOtherRes(true);
     }
  }, [mode, initialData]);

  const handleSubmit = async (e) => {
      e.preventDefault();
      try {
          if (mode === 'create') await addDoc(collection(db, "patients"), { ...form, status: 'pending', hasPending: false, discharged: false, notes: [], checklist: [] });
          else await updateDoc(doc(db, "patients", form.id), form);
          onClose();
      } catch (err) { alert("Error: " + err.message); }
  };

  const inputClass = "w-full p-2 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white bg-white dark:bg-slate-700"; 

  return (
      <div className="fixed inset-0 bg-black/60 dark:bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-white">{mode==='create'?'Nuevo Paciente':'Editar Paciente'}</h2>
              <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="flex gap-2">
                      <input required placeholder="Cama" className={`w-1/3 ${inputClass}`} value={form.bed} onChange={e=>setForm({...form, bed:e.target.value})} />
                      <select className={`w-1/3 ${inputClass}`} value={form.type} onChange={e=>setForm({...form, type:e.target.value})}><option>HO</option><option>IC</option><option>SND</option><option>NOVER</option></select>
                  </div>
                  <input required placeholder="Nombre Completo" className={inputClass} value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
                  
                  <div className="bg-slate-50 dark:bg-slate-700/50 p-2 rounded border dark:border-slate-600">
                      <p className="text-xs font-bold text-gray-500 dark:text-gray-300 mb-1">Antecedentes</p>
                      <div className="flex gap-2 mb-2 text-sm text-slate-700 dark:text-slate-200">
                         <label className="flex items-center gap-1"><input type="checkbox" checked={form.antecedents?.dm || false} onChange={e=>setForm({...form, antecedents: {...form.antecedents, dm:e.target.checked}})}/> DM</label>
                         <label className="flex items-center gap-1"><input type="checkbox" checked={form.antecedents?.has || false} onChange={e=>setForm({...form, antecedents: {...form.antecedents, has:e.target.checked}})}/> HAS</label>
                         <label className="flex items-center gap-1"><input type="checkbox" checked={form.antecedents?.cancer || false} onChange={e=>setForm({...form, antecedents: {...form.antecedents, cancer:e.target.checked}})}/> Onco</label>
                      </div>
                      <input placeholder="Otros antecedentes..." className={`text-xs mb-2 ${inputClass}`} value={form.antecedents?.other || ''} onChange={e=>setForm({...form, antecedents: {...form.antecedents, other:e.target.value}})} />
                      <input placeholder="Alergias" className={`text-xs border-red-200 dark:border-red-900/50 ${inputClass}`} value={form.allergies} onChange={e=>setForm({...form, allergies:e.target.value})} />
                  </div>

                  <div className="space-y-1">
                      <select required={!isOtherDoc} className={`text-xs ${inputClass}`} value={isOtherDoc ? 'Otro' : form.doctor} 
                              onChange={e=>{ if(e.target.value==='Otro') { setIsOtherDoc(true); setForm({...form, doctor: ''}); } else { setIsOtherDoc(false); setForm({...form, doctor:e.target.value}); }}}>
                          <option value="">Seleccionar Tratante...</option>{DOCTORS.map(d=><option key={d} value={d}>{d}</option>)}<option value="Otro">Otro / Agregar Nuevo</option>
                      </select>
                      {isOtherDoc && <input placeholder="Escribe nombre del Tratante" className={`text-xs bg-blue-50 ${inputClass}`} value={form.doctor} onChange={e=>setForm({...form, doctor:e.target.value})} required />}
                  </div>
                  <div className="space-y-1">
                      <select required={!isOtherRes} className={`text-xs ${inputClass}`} value={isOtherRes ? 'Otro' : form.resident} 
                              onChange={e=>{ if(e.target.value==='Otro') { setIsOtherRes(true); setForm({...form, resident: ''}); } else { setIsOtherRes(false); setForm({...form, resident:e.target.value}); }}}>
                          <option value="">Seleccionar Residente...</option>{RESIDENTS.map(r=><option key={r} value={r}>{r}</option>)}<option value="Otro">Otro / Agregar Nuevo</option>
                      </select>
                      {isOtherRes && <input placeholder="Escribe nombre del Residente" className={`text-xs bg-blue-50 ${inputClass}`} value={form.resident} onChange={e=>setForm({...form, resident:e.target.value})} required />}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col"><label className="text-[10px] text-gray-500 dark:text-gray-400">Ingreso</label><input type="date" required className={`text-xs ${inputClass}`} value={form.admissionDate} onChange={e=>setForm({...form, admissionDate:e.target.value})} /></div>
                      <div className="flex flex-col"><label className="text-[10px] text-gray-500 dark:text-gray-400">Nacimiento</label><input type="date" className={`text-xs ${inputClass}`} value={form.dob} onChange={e=>setForm({...form, dob:e.target.value})} /></div>
                  </div>
                  <input required placeholder="Diagnóstico" className={inputClass} value={form.diagnosis} onChange={e=>setForm({...form, diagnosis:e.target.value})} />
                  <div className="flex gap-2 mt-4 pt-2 border-t dark:border-slate-700"><button type="button" onClick={onClose} className="flex-1 bg-gray-100 dark:bg-slate-600 text-gray-800 dark:text-white py-3 rounded font-bold">Cancelar</button><button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded font-bold shadow-lg">Guardar</button></div>
              </form>
          </div>
      </div>
  );
}
