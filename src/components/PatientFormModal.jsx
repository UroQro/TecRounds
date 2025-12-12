import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { addDoc, updateDoc, collection, doc } from 'firebase/firestore';
import { DOCTORS, RESIDENTS } from '../constants';
import { getLocalISODate } from '../utils';

export default function PatientFormModal({ onClose, mode, initialData }) {
  // BLINDADO: Usamos campos seguros para no crashear
  const [form, setForm] = useState(initialData || { 
      name: '', bed: '', type: 'HO', doctor: '', resident: '', admissionDate: getLocalISODate(), dob: '', diagnosis: '',
      weight: '', height: '',
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
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4 text-slate-800">{mode==='create'?'Nuevo Paciente':'Editar Paciente'}</h2>
              <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="flex gap-2">
                      <input required placeholder="Cama" className="w-1/3 p-2 border rounded" value={form.bed} onChange={e=>setForm({...form, bed:e.target.value})} />
                      <select className="w-1/3 p-2 border rounded" value={form.type} onChange={e=>setForm({...form, type:e.target.value})}><option>HO</option><option>IC</option><option>SND</option><option>NOVER</option></select>
                  </div>
                  <input required placeholder="Nombre Completo" className="w-full p-2 border rounded" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
                  
                  <div className="flex gap-2">
                      <input placeholder="Peso (kg)" type="number" className="w-1/2 p-2 border rounded" value={form.weight} onChange={e=>setForm({...form, weight:e.target.value})} />
                      <input placeholder="Talla (m)" type="number" step="0.01" className="w-1/2 p-2 border rounded" value={form.height} onChange={e=>setForm({...form, height:e.target.value})} />
                  </div>

                  <div className="bg-slate-50 p-2 rounded border">
                      <p className="text-xs font-bold text-gray-500 mb-1">Antecedentes</p>
                      <div className="flex gap-2 mb-2 text-sm">
                         <label className="flex items-center gap-1"><input type="checkbox" checked={form.antecedents?.dm || false} onChange={e=>setForm({...form, antecedents: {...form.antecedents, dm:e.target.checked}})}/> DM</label>
                         <label className="flex items-center gap-1"><input type="checkbox" checked={form.antecedents?.has || false} onChange={e=>setForm({...form, antecedents: {...form.antecedents, has:e.target.checked}})}/> HAS</label>
                         <label className="flex items-center gap-1"><input type="checkbox" checked={form.antecedents?.cancer || false} onChange={e=>setForm({...form, antecedents: {...form.antecedents, cancer:e.target.checked}})}/> Onco</label>
                      </div>
                      <input placeholder="Otros antecedentes..." className="w-full p-1 border rounded text-xs mb-2" value={form.antecedents?.other || ''} onChange={e=>setForm({...form, antecedents: {...form.antecedents, other:e.target.value}})} />
                      <input placeholder="Alergias" className="w-full p-1 border rounded text-xs border-red-200" value={form.allergies} onChange={e=>setForm({...form, allergies:e.target.value})} />
                  </div>

                  <div className="space-y-1">
                      <select required={!isOtherDoc} className="w-full p-2 border rounded text-xs" value={isOtherDoc ? 'Otro' : form.doctor} 
                              onChange={e=>{ if(e.target.value==='Otro') { setIsOtherDoc(true); setForm({...form, doctor: ''}); } else { setIsOtherDoc(false); setForm({...form, doctor:e.target.value}); }}}>
                          <option value="">Seleccionar Tratante...</option>{DOCTORS.map(d=><option key={d} value={d}>{d}</option>)}<option value="Otro">Otro / Agregar Nuevo</option>
                      </select>
                      {isOtherDoc && <input placeholder="Escribe nombre del Tratante" className="w-full p-2 border border-blue-300 rounded text-xs bg-blue-50" value={form.doctor} onChange={e=>setForm({...form, doctor:e.target.value})} required />}
                  </div>
                  <div className="space-y-1">
                      <select required={!isOtherRes} className="w-full p-2 border rounded text-xs" value={isOtherRes ? 'Otro' : form.resident} 
                              onChange={e=>{ if(e.target.value==='Otro') { setIsOtherRes(true); setForm({...form, resident: ''}); } else { setIsOtherRes(false); setForm({...form, resident:e.target.value}); }}}>
                          <option value="">Seleccionar Residente...</option>{RESIDENTS.map(r=><option key={r} value={r}>{r}</option>)}<option value="Otro">Otro / Agregar Nuevo</option>
                      </select>
                      {isOtherRes && <input placeholder="Escribe nombre del Residente" className="w-full p-2 border border-blue-300 rounded text-xs bg-blue-50" value={form.resident} onChange={e=>setForm({...form, resident:e.target.value})} required />}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col"><label className="text-[10px] text-gray-500">Ingreso</label><input type="date" required className="p-2 border rounded text-xs" value={form.admissionDate} onChange={e=>setForm({...form, admissionDate:e.target.value})} /></div>
                      <div className="flex flex-col"><label className="text-[10px] text-gray-500">Nacimiento</label><input type="date" className="p-2 border rounded text-xs" value={form.dob} onChange={e=>setForm({...form, dob:e.target.value})} /></div>
                  </div>
                  <input required placeholder="Diagnóstico" className="w-full p-2 border rounded" value={form.diagnosis} onChange={e=>setForm({...form, diagnosis:e.target.value})} />
                  <div className="flex gap-2 mt-4 pt-2 border-t"><button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-800 py-3 rounded font-bold">Cancelar</button><button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded font-bold shadow-lg">Guardar</button></div>
              </form>
          </div>
      </div>
  );
}
