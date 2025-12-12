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

  return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto border border-slate-200">
              <h2 className="text-2xl font-bold mb-6 text-slate-800 border-b pb-2">{mode==='create'?'Nuevo Paciente':'Editar Paciente'}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="flex gap-3">
                      <div className="w-1/3"><label className="text-xs font-bold text-slate-500">Cama</label><input required className="w-full p-2.5 border rounded-lg bg-slate-50 font-bold" value={form.bed} onChange={e=>setForm({...form, bed:e.target.value})} /></div>
                      <div className="flex-1"><label className="text-xs font-bold text-slate-500">Categoría</label><select className="w-full p-2.5 border rounded-lg bg-slate-50" value={form.type} onChange={e=>setForm({...form, type:e.target.value})}><option>HO</option><option>IC</option><option>SND</option><option>NOVER</option></select></div>
                  </div>
                  <div><label className="text-xs font-bold text-slate-500">Nombre Completo</label><input required className="w-full p-2.5 border rounded-lg" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} /></div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <p className="text-xs font-extrabold text-slate-400 uppercase mb-2">Antecedentes Clínicos</p>
                      <div className="flex gap-4 mb-3 text-sm font-medium">
                         <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" className="w-4 h-4 rounded text-blue-600" checked={form.antecedents?.dm || false} onChange={e=>setForm({...form, antecedents: {...form.antecedents, dm:e.target.checked}})}/> DM</label>
                         <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" className="w-4 h-4 rounded text-blue-600" checked={form.antecedents?.has || false} onChange={e=>setForm({...form, antecedents: {...form.antecedents, has:e.target.checked}})}/> HAS</label>
                         <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" className="w-4 h-4 rounded text-blue-600" checked={form.antecedents?.cancer || false} onChange={e=>setForm({...form, antecedents: {...form.antecedents, cancer:e.target.checked}})}/> Onco</label>
                      </div>
                      <input placeholder="Otros antecedentes..." className="w-full p-2 border rounded-lg text-sm bg-white mb-2" value={form.antecedents?.other || ''} onChange={e=>setForm({...form, antecedents: {...form.antecedents, other:e.target.value}})} />
                      <input placeholder="Alergias (Negadas si vacío)" className="w-full p-2 border border-red-200 rounded-lg text-sm bg-red-50 text-red-800 placeholder-red-300" value={form.allergies} onChange={e=>setForm({...form, allergies:e.target.value})} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                          <label className="text-xs font-bold text-slate-500">Tratante</label>
                          <select required={!isOtherDoc} className="w-full p-2.5 border rounded-lg text-sm" value={isOtherDoc ? 'Otro' : form.doctor} 
                              onChange={e=>{ if(e.target.value==='Otro') { setIsOtherDoc(true); setForm({...form, doctor: ''}); } else { setIsOtherDoc(false); setForm({...form, doctor:e.target.value}); }}}>
                              <option value="">Seleccionar...</option>{DOCTORS.map(d=><option key={d} value={d}>{d}</option>)}<option value="Otro">Otro / Agregar Nuevo</option>
                          </select>
                          {isOtherDoc && <input placeholder="Nombre Tratante" className="w-full p-2 border border-blue-300 rounded-lg text-sm mt-1 bg-blue-50" value={form.doctor} onChange={e=>setForm({...form, doctor:e.target.value})} required />}
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-500">Residente</label>
                          <select required={!isOtherRes} className="w-full p-2.5 border rounded-lg text-sm" value={isOtherRes ? 'Otro' : form.resident} 
                              onChange={e=>{ if(e.target.value==='Otro') { setIsOtherRes(true); setForm({...form, resident: ''}); } else { setIsOtherRes(false); setForm({...form, resident:e.target.value}); }}}>
                              <option value="">Seleccionar...</option>{RESIDENTS.map(r=><option key={r} value={r}>{r}</option>)}<option value="Otro">Otro / Agregar Nuevo</option>
                          </select>
                          {isOtherRes && <input placeholder="Nombre Residente" className="w-full p-2 border border-blue-300 rounded-lg text-sm mt-1 bg-blue-50" value={form.resident} onChange={e=>setForm({...form, resident:e.target.value})} required />}
                      </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-xs font-bold text-slate-500">Ingreso</label><input type="date" required className="w-full p-2 border rounded-lg text-sm" value={form.admissionDate} onChange={e=>setForm({...form, admissionDate:e.target.value})} /></div>
                      <div><label className="text-xs font-bold text-slate-500">Nacimiento</label><input type="date" className="w-full p-2 border rounded-lg text-sm" value={form.dob} onChange={e=>setForm({...form, dob:e.target.value})} /></div>
                  </div>
                  <div><label className="text-xs font-bold text-slate-500">Diagnóstico</label><input required className="w-full p-2.5 border rounded-lg" value={form.diagnosis} onChange={e=>setForm({...form, diagnosis:e.target.value})} /></div>
                  
                  <div className="flex gap-3 mt-6 pt-4 border-t">
                      <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition">Cancelar</button>
                      <button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition">Guardar</button>
                  </div>
              </form>
          </div>
      </div>
  );
}
