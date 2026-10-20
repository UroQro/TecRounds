import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, updateDoc, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { calculateLOS, downloadCSV, calculateAge, applyPrivacy, normalizeText, getOrderedResidents, getMemberProfile } from '../utils';
import PatientDetail from './PatientDetail';
import PatientFormModal from './PatientFormModal';
import { Plus, CheckSquare, Square, LogOut, Search, X, SlidersHorizontal, RotateCcw, FileCheck2, Megaphone } from 'lucide-react';

export default function Census({ user, dynamicResidents, dynamicDoctors, dynamicLocations, privacyMode, settingsMeta = {} }) {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const { allOrdered: orderedResidents, hzhResidents, otherResidents } = useMemo(
    () => getOrderedResidents(dynamicResidents, settingsMeta),
    [dynamicResidents, settingsMeta]
  );

  // Buscador y filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [filterDoc, setFilterDoc] = useState('');
  const [filterRes, setFilterRes] = useState('');
  const [filterHosp, setFilterHosp] = useState('');
  const [filterType, setFilterType] = useState('');
  const [quickFilter, setQuickFilter] = useState('all'); // 'all' | 'handover' | 'pending_visit' | 'has_pending' | 'pre_discharge' | 'ready_discharge'
  const [sortBy, setSortBy] = useState('bed'); // 'bed' | 'los' | 'hospital' | 'name'
  const [showFilters, setShowFilters] = useState(false);
  const [hasAutoSelectedResident, setHasAutoSelectedResident] = useState(false);

  // Perfil del usuario activo y detección de si es residente
  const currentUserProfile = useMemo(
    () => getMemberProfile(user?.email || user?.displayName, settingsMeta),
    [user, settingsMeta]
  );

  const matchedUserResident = useMemo(() => {
    if (!user) return null;
    const candidateNames = [
      currentUserProfile?.name,
      user.displayName,
      user.email ? user.email.split('@')[0] : ''
    ].filter(Boolean);

    for (const cand of candidateNames) {
      const normCand = normalizeText(cand);
      const match = orderedResidents.find(r => normalizeText(r) === normCand || normCand.includes(normalizeText(r)) || normalizeText(r).includes(normCand));
      if (match) return match;
    }
    return null;
  }, [user, currentUserProfile, orderedResidents]);

  const userPatientsCount = useMemo(() => {
    if (!matchedUserResident) return 0;
    const normUser = normalizeText(matchedUserResident);
    return patients.filter(p => normalizeText(p.resident) === normUser).length;
  }, [patients, matchedUserResident]);

  // Auto-seleccionar por default al residente activo si tiene pacientes asignados
  useEffect(() => {
    if (!hasAutoSelectedResident && patients.length > 0 && matchedUserResident) {
      if (userPatientsCount > 0) {
        setFilterRes(matchedUserResident);
      }
      setHasAutoSelectedResident(true);
    }
  }, [patients, matchedUserResident, userPatientsCount, hasAutoSelectedResident]);

  useEffect(() => {
    const q = query(collection(db, "patients"), orderBy("bed"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPatients(data.filter(p => !p.discharged));
    }, (error) => { console.error(error); });
    return () => unsubscribe();
  }, []);

  const toggleStatus = async (e, p) => {
    e.stopPropagation();
    const newStatus = p.status === 'done' ? 'pending' : 'done';
    await updateDoc(doc(db, "patients", p.id), { status: newStatus });
  };

  // Toggle para marcar/desmarcar pacientes que se van a comentar en la Entrega
  const toggleHandover = async (e, p) => {
    e.stopPropagation();
    await updateDoc(doc(db, "patients", p.id), {
      forHandover: !p.forHandover
    });
  };

  const clearHandoverMarks = async () => {
    const marked = patients.filter(p => p.forHandover);
    if (marked.length === 0) return;
    if (!confirm(`¿Desmarcar los ${marked.length} paciente(s) de la lista de Entrega?`)) return;
    try {
      await Promise.all(marked.map(p => updateDoc(doc(db, "patients", p.id), { forHandover: false })));
      if (quickFilter === 'handover') setQuickFilter('all');
    } catch (err) {
      alert("Error al limpiar marcas de entrega: " + err.message);
    }
  };

  // Toggle para pacientes que YA están dados de alta médicamente pero siguen en cama (trámite/aseguradora)
  const toggleReadyForDischarge = async (e, p) => {
    e.stopPropagation();
    const nextState = !p.readyForDischarge;
    await updateDoc(doc(db, "patients", p.id), {
      readyForDischarge: nextState,
      // Si ya tiene alta firmada, desactivamos pre-alta para no confundir estados
      ...(nextState ? { preDischarge: false } : {})
    });
  };
  
  const dischargePatient = async (e, p) => { 
      e.stopPropagation(); 
      if(confirm(`¿Confirmar que ${applyPrivacy(p.name, privacyMode, 'name')} ya desocupó la cama? Se moverá a Egresos.`)) { 
          try {
              const pRef = doc(db, "patients", p.id);
              const aRef = doc(db, "archived_patients", p.id);
              await setDoc(aRef, { ...p, discharged: true, dischargeDate: new Date().toISOString() });
              await deleteDoc(pRef);
          } catch(err) {
              alert("Error al egresar: " + err.message);
          }
      } 
  };

  const getCardColor = (p) => {
    if (p.type === 'NOVER') return "bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-400";
    if (p.readyForDischarge) return "bg-emerald-50/70 dark:bg-emerald-950/40 border-l-[8px] border-emerald-500 dark:border-emerald-400 shadow-md ring-1 ring-emerald-200 dark:ring-emerald-800/60";
    if (p.preDischarge) return "bg-white dark:bg-purple-900/30 border-l-[8px] border-purple-600 dark:border-purple-500 shadow-md";
    if (p.hasPending) return "bg-white dark:bg-yellow-900/30 border-l-[8px] border-yellow-500 dark:border-yellow-500 shadow-md";
    if (p.type === 'SND') { return p.status === 'done' ? "bg-white dark:bg-green-900/30 border-l-[8px] border-green-600 dark:border-green-500 shadow-md" : "bg-white dark:bg-orange-900/30 border-l-[8px] border-orange-500 dark:border-orange-500 shadow-md"; }
    return p.status === 'done' ? "bg-white dark:bg-blue-900/30 border-l-[8px] border-blue-600 dark:border-blue-500 shadow-md" : "bg-white dark:bg-slate-800 border-l-[8px] border-red-600 dark:border-red-500 shadow-md";
  };

  // Estadísticas rápidas del censo
  const stats = useMemo(() => {
    const active = patients.filter(p => p.type !== 'NOVER');
    const total = patients.length;
    const pendingVisit = active.filter(p => p.status !== 'done').length;
    const withPendingTasks = patients.filter(p => p.hasPending).length;
    const preDischarge = patients.filter(p => p.preDischarge && !p.readyForDischarge).length;
    const readyDischarge = patients.filter(p => p.readyForDischarge).length;
    const forHandover = patients.filter(p => p.forHandover).length;
    return { total, activeCount: active.length, pendingVisit, withPendingTasks, preDischarge, readyDischarge, forHandover };
  }, [patients]);

  // Hospitales presentes en el censo + catálogo
  const availableHospitals = useMemo(() => {
    const fromPatients = patients.map(p => p.hospital).filter(Boolean);
    return Array.from(new Set([...fromPatients, ...(dynamicLocations || [])])).sort();
  }, [patients, dynamicLocations]);

  // Filtrado y ordenamiento
  const filteredPatients = useMemo(() => {
    const q = normalizeText(searchTerm);

    return [...patients]
      .filter(p => {
        if (q) {
          const haystack = normalizeText(
            `${p.name || ''} ${p.bed || ''} ${p.diagnosis || ''} ${p.doctor || ''} ${p.resident || ''} ${p.hospital || ''} ${p.type || ''} ${p.allergies || ''}`
          );
          if (!haystack.includes(q)) return false;
        }
        if (filterDoc) {
          if (filterDoc === 'Otro') {
            if (dynamicDoctors.includes(p.doctor)) return false;
          } else if (p.doctor !== filterDoc) {
            return false;
          }
        }
        if (filterRes && p.resident !== filterRes) return false;
        if (filterHosp && (p.hospital || '') !== filterHosp) return false;
        if (filterType && p.type !== filterType) return false;

        if (quickFilter === 'handover' && !p.forHandover) return false;
        if (quickFilter === 'pending_visit' && (p.status === 'done' || p.type === 'NOVER')) return false;
        if (quickFilter === 'has_pending' && !p.hasPending) return false;
        if (quickFilter === 'pre_discharge' && !p.preDischarge) return false;
        if (quickFilter === 'ready_discharge' && !p.readyForDischarge) return false;

        return true;
      })
      .sort((a, b) => {
        if (a.type === 'NOVER' && b.type !== 'NOVER') return 1;
        if (a.type !== 'NOVER' && b.type === 'NOVER') return -1;

        if (sortBy === 'los') return calculateLOS(b.admissionDate) - calculateLOS(a.admissionDate);
        if (sortBy === 'hospital') {
          return (a.hospital || 'ZZZ').localeCompare(b.hospital || 'ZZZ') || String(a.bed || '').localeCompare(String(b.bed || ''), undefined, { numeric: true });
        }
        if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
        return String(a.bed || '').localeCompare(String(b.bed || ''), undefined, { numeric: true });
      });
  }, [patients, searchTerm, filterDoc, filterRes, filterHosp, filterType, quickFilter, sortBy, dynamicDoctors]);

  const hasActiveFilters = Boolean(searchTerm || filterDoc || filterRes || filterHosp || filterType || quickFilter !== 'all' || sortBy !== 'bed');
  const activeDropdownFiltersCount = [filterDoc, filterHosp, filterType, sortBy !== 'bed' ? sortBy : ''].filter(Boolean).length;

  const clearAllFilters = () => {
    setSearchTerm('');
    setShowSearchInput(false);
    setFilterDoc('');
    setFilterRes('');
    setFilterHosp('');
    setFilterType('');
    setQuickFilter('all');
    setSortBy('bed');
  };

  const shareDOPMessage = async () => { 
      const filtered = patients.filter(p => p.doctor && p.doctor.toLowerCase().includes("olvera"));
      if(filtered.length === 0) return alert("No hay pacientes activos del Dr. Olvera para compartir.");

      const todayStr = new Date().toLocaleDateString('es-MX', {day: '2-digit', month: '2-digit', year: 'numeric'});
      let text = `🏥 *Censo Dr. Olvera*\n📅 ${todayStr}\n👥 Total: ${filtered.length} paciente(s)\n\n`;

      filtered.forEach(p => {
          text += `🛏️ *Cama ${applyPrivacy(p.bed, privacyMode, 'bed')}*${p.hospital ? ` (${p.hospital})` : ''} | ⏳ ${calculateLOS(p.admissionDate)} días\n`;
          text += `👤 *${applyPrivacy(p.name, privacyMode, 'name')}*${p.readyForDischarge ? ' ✅(Alta lista)' : ''}\n`;
          text += `🩺 Dx: ${p.diagnosis}\n\n`;
      });

      if (navigator.share && navigator.canShare) {
          try {
              await navigator.share({ text: text });
          } catch(err) {
              navigator.clipboard.writeText(text);
              alert("Copiado al portapapeles para pegar en WhatsApp.");
          }
      } else {
          navigator.clipboard.writeText(text);
          alert("Copiado al portapapeles para pegar en WhatsApp.");
      }
  };

  const shareCurrentCensusMessage = async () => {
      if (filteredPatients.length === 0) return alert("No hay pacientes en la vista actual para compartir.");
      const todayStr = new Date().toLocaleDateString('es-MX', {day: '2-digit', month: '2-digit', year: 'numeric'});
      const titleParts = ["Censo Urología"];
      if (filterDoc) titleParts.push(filterDoc);
      if (filterRes) titleParts.push(`Res: ${filterRes}`);
      if (filterHosp) titleParts.push(filterHosp);

      let text = `🏥 *${titleParts.join(' • ')}*\n📅 ${todayStr} | 👥 Total: ${filteredPatients.length}\n\n`;
      filteredPatients.forEach(p => {
          const pendingCount = (p.checklist || []).filter(t => !t.done).length;
          const statusTag = p.readyForDischarge ? ' • ✅ ALTA LISTA' : p.preDischarge ? ' • 🟣 PRE-ALTA' : '';
          text += `🛏️ *${applyPrivacy(p.bed, privacyMode, 'bed')}*${p.hospital ? ` [${p.hospital}]` : ''} (${p.type}) | ⏳ ${calculateLOS(p.admissionDate)}d${statusTag}\n`;
          text += `👤 *${applyPrivacy(p.name, privacyMode, 'name')}* (${calculateAge(p.dob)}a)\n`;
          text += `🩺 ${p.diagnosis}\n`;
          text += `👨‍⚕️ ${applyPrivacy(p.doctor, privacyMode, 'name')} • Res: ${p.resident || 'S/A'}${pendingCount > 0 ? ` • ⚠️ ${pendingCount} pend.` : ''}\n\n`;
      });

      if (navigator.share && navigator.canShare) {
          try {
              await navigator.share({ text });
          } catch (err) {
              navigator.clipboard.writeText(text);
              alert("Censo copiado al portapapeles para WhatsApp.");
          }
      } else {
          navigator.clipboard.writeText(text);
          alert("Censo copiado al portapapeles para WhatsApp.");
      }
  };

  const exportDOP = () => { 
      const filtered = patients.filter(p => p.doctor && p.doctor.toLowerCase().includes("olvera"));
      if(filtered.length === 0) return alert("No hay pacientes activos del Dr. Olvera para exportar.");
      const data = filtered.map(p => [p.bed, p.name, p.diagnosis, calculateLOS(p.admissionDate)]); 
      downloadCSV(data, ["Cama", "Nombre", "Dx", "Dias"], "Censo_Dr_Olvera.csv"); 
  };
  
  const exportGeneral = () => {
      const data = patients.map(p => [p.bed, p.type, p.name, p.admissionDate, calculateLOS(p.admissionDate), p.dob, calculateAge(p.dob), p.diagnosis, p.doctor, p.hospital || '']);
      downloadCSV(data, ["Cuarto", "IC/HO", "Nombre", "Ingreso", "Dias", "Nacimiento", "Edad", "Dx", "Tratante", "Hospital"], "Censo_General.csv");
  };

  if (selectedPatient) return <PatientDetail patient={selectedPatient} onClose={() => setSelectedPatient(null)} user={user} dynamicResidents={dynamicResidents} dynamicDoctors={dynamicDoctors} dynamicLocations={dynamicLocations} privacyMode={privacyMode} settingsMeta={settingsMeta} />;

  return (
    <div className="pb-24">
      {/* Barra superior ultra-compacta para móvil */}
      <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl shadow-sm border border-blue-100 dark:border-slate-700 mb-3 transition-colors space-y-2">
         {/* Fila 1: Filtro de Residente (Principal) + Toggle Buscador + Filtros Avanzados + Reset */}
         <div className="flex items-center gap-1.5">
             <div className="relative flex-1">
                 <select
                     value={filterRes}
                     onChange={e => setFilterRes(e.target.value)}
                     className="w-full py-1.5 pl-2.5 pr-6 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-bold bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:border-blue-500 truncate"
                 >
                     <option value="">👥 Todos los residentes ({stats.total})</option>
                     {hzhResidents.length > 0 ? (
                         <>
                             <optgroup label="📍 Zambrano (HZH)">
                                 {hzhResidents.map(r => (
                                     <option key={r} value={r}>
                                         {r === matchedUserResident ? `👤 ${r} (Tú)` : r}
                                     </option>
                                 ))}
                             </optgroup>
                             {otherResidents.length > 0 && (
                                 <optgroup label="Otros Residentes">
                                     {otherResidents.map(r => (
                                         <option key={r} value={r}>
                                             {r === matchedUserResident ? `👤 ${r} (Tú)` : r}
                                         </option>
                                     ))}
                                 </optgroup>
                             )}
                         </>
                     ) : (
                         orderedResidents.map(r => (
                             <option key={r} value={r}>
                                 {r === matchedUserResident ? `👤 ${r} (Tú)` : r}
                             </option>
                         ))
                     )}
                 </select>
             </div>

             {/* Botón desplegar buscador por texto */}
             <button
                 onClick={() => setShowSearchInput(!showSearchInput)}
                 className={`p-1.5 rounded-lg border text-xs font-bold transition flex items-center justify-center ${showSearchInput || searchTerm ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}
                 title={showSearchInput ? "Ocultar buscador" : "Buscar por texto"}
             >
                 <Search size={15} />
             </button>

             {/* Botón filtros avanzados */}
             <button
                 onClick={() => setShowFilters(!showFilters)}
                 className={`px-2 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition ${showFilters || activeDropdownFiltersCount > 0 ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}
                 title="Filtros por Tratante, Sede, Tipo y Orden"
             >
                 <SlidersHorizontal size={14} />
                 {activeDropdownFiltersCount > 0 && <span className="bg-white text-blue-600 rounded-full px-1.5 text-[10px] font-black">{activeDropdownFiltersCount}</span>}
             </button>

             {/* Botón limpiar filtros */}
             {hasActiveFilters && (
                 <button onClick={clearAllFilters} className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300" title="Limpiar todos los filtros">
                     <RotateCcw size={14} />
                 </button>
             )}
         </div>

         {/* Buscador de texto desplegable */}
         {(showSearchInput || searchTerm) && (
             <div className="relative animate-in fade-in duration-150">
                 <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                 <input
                     type="text"
                     autoFocus
                     value={searchTerm}
                     onChange={e => setSearchTerm(e.target.value)}
                     placeholder="Buscar paciente, cama, diagnóstico, tratante..."
                     className="w-full pl-8 pr-7 py-1.5 border border-blue-200 dark:border-blue-700 bg-blue-50/50 dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                 />
                 {searchTerm && (
                     <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white">
                         <X size={14} />
                     </button>
                 )}
             </div>
         )}

         {/* Fila 2: Chips rápidos de estado (Scroll horizontal limpio en móvil): xVer, Alta, PA, Pend y Ent */}
         <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-[11px] font-bold">
             <button
                 onClick={() => setQuickFilter('all')}
                 className={`px-2.5 py-1 rounded-full whitespace-nowrap transition flex items-center gap-1 ${quickFilter === 'all' ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
             >
                 Todos <span className="opacity-80">({stats.total})</span>
             </button>
             <button
                 onClick={() => setQuickFilter(quickFilter === 'pending_visit' ? 'all' : 'pending_visit')}
                 className={`px-2.5 py-1 rounded-full whitespace-nowrap transition flex items-center gap-1 ${quickFilter === 'pending_visit' ? 'bg-red-600 text-white shadow-sm' : 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60'}`}
             >
                 🔴 xVer <span>({stats.pendingVisit})</span>
             </button>
             <button
                 onClick={() => setQuickFilter(quickFilter === 'ready_discharge' ? 'all' : 'ready_discharge')}
                 className={`px-2.5 py-1 rounded-full whitespace-nowrap transition flex items-center gap-1 ${quickFilter === 'ready_discharge' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'}`}
             >
                 ✅ Alta <span>({stats.readyDischarge})</span>
             </button>
             <button
                 onClick={() => setQuickFilter(quickFilter === 'pre_discharge' ? 'all' : 'pre_discharge')}
                 className={`px-2.5 py-1 rounded-full whitespace-nowrap transition flex items-center gap-1 ${quickFilter === 'pre_discharge' ? 'bg-purple-600 text-white shadow-sm' : 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60'}`}
             >
                 🟣 PA <span>({stats.preDischarge})</span>
             </button>
             <button
                 onClick={() => setQuickFilter(quickFilter === 'has_pending' ? 'all' : 'has_pending')}
                 className={`px-2.5 py-1 rounded-full whitespace-nowrap transition flex items-center gap-1 ${quickFilter === 'has_pending' ? 'bg-yellow-500 text-white shadow-sm' : 'bg-yellow-50 dark:bg-yellow-950/50 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800/60'}`}
             >
                 ⚠️ Pend <span>({stats.withPendingTasks})</span>
             </button>
             <button
                 onClick={() => setQuickFilter(quickFilter === 'handover' ? 'all' : 'handover')}
                 className={`px-2.5 py-1 rounded-full whitespace-nowrap transition flex items-center gap-1 ${quickFilter === 'handover' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60'}`}
             >
                 📢 Ent <span>({stats.forHandover})</span>
             </button>
         </div>

         {quickFilter === 'handover' && stats.forHandover > 0 && (
             <div className="flex justify-between items-center bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 px-2.5 py-1.5 rounded-lg text-[11px]">
                 <span className="font-bold text-indigo-800 dark:text-indigo-200">📢 Mostrando {stats.forHandover} paciente(s) para Entrega</span>
                 <button onClick={clearHandoverMarks} className="text-indigo-600 dark:text-indigo-300 font-bold underline hover:opacity-80">
                     Desmarcar todos
                 </button>
             </div>
         )}

         {/* Panel desplegable de selectores (Tratante, Sede, Tipo, Orden) */}
         {showFilters && (
             <div className="pt-2 border-t border-gray-100 dark:border-slate-700 space-y-2">
                 <div className="grid grid-cols-2 gap-1.5">
                     <select className="p-1.5 border rounded-lg text-xs bg-slate-50 dark:bg-slate-700 dark:text-white dark:border-slate-600 font-medium" value={filterDoc} onChange={e=>setFilterDoc(e.target.value)}>
                         <option value="">Tratante (Todos)</option>
                         {dynamicDoctors.map(d => <option key={d} value={d}>{d}</option>)}
                         <option value="Otro">Otro...</option>
                     </select>
                     <select className="p-1.5 border rounded-lg text-xs bg-slate-50 dark:bg-slate-700 dark:text-white dark:border-slate-600 font-medium" value={filterHosp} onChange={e=>setFilterHosp(e.target.value)}>
                         <option value="">Sede (Todas)</option>
                         {availableHospitals.map(h => <option key={h} value={h}>{h}</option>)}
                     </select>
                 </div>
                 <div className="grid grid-cols-2 gap-1.5">
                     <select className="p-1.5 border rounded-lg text-xs bg-slate-50 dark:bg-slate-700 dark:text-white dark:border-slate-600 font-medium" value={filterType} onChange={e=>setFilterType(e.target.value)}>
                         <option value="">Tipo (Todos)</option>
                         <option value="HO">HO (Hospitalizado)</option>
                         <option value="IC">IC (Interconsulta)</option>
                         <option value="SND">SND (Sonda / Amb.)</option>
                         <option value="NOVER">NOVER (No ver)</option>
                     </select>
                     <select className="p-1.5 border rounded-lg text-xs bg-slate-50 dark:bg-slate-700 dark:text-white dark:border-slate-600 font-medium" value={sortBy} onChange={e=>setSortBy(e.target.value)}>
                         <option value="bed">Orden: Cama</option>
                         <option value="los">Orden: Días (LOS)</option>
                         <option value="hospital">Orden: Sede</option>
                         <option value="name">Orden: Nombre</option>
                     </select>
                 </div>
             </div>
         )}
      </div>

      {/* Lista de Pacientes */}
      <div className="grid grid-cols-1 gap-2.5">
         {filteredPatients.map(p => {
            const pendingTasksCount = (p.checklist || []).filter(t => !t.done).length;
            const cleanAllergies = String(p.allergies || '').trim().toLowerCase();
            const hasAllergy = cleanAllergies !== '' && !['negadas', 'negada', 'negado', 'ninguna', 'ninguno', 'no', 'sin alergias', 's/a', 'n/a', 'na', '-'].includes(cleanAllergies);
            const resProfile = getMemberProfile(p.resident, settingsMeta);
            return (
            <div key={p.id} onClick={() => setSelectedPatient(p)} className={`p-3 rounded-xl cursor-pointer active:scale-[0.99] transition ${getCardColor(p)}`}>
               <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                     <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className="bg-black text-white px-2 py-0.5 rounded font-black text-base shadow-sm border border-slate-700">{applyPrivacy(p.bed, privacyMode, 'bed')}</span>
                        {p.hospital && <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-gray-200 dark:border-slate-700">{p.hospital}</span>}
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border border-black/10 dark:border-white/10 uppercase ${p.type==='NOVER'?'bg-gray-100 dark:bg-slate-700 text-gray-500':'bg-white dark:bg-slate-800 dark:text-white'}`}>{p.type}</span>
                        {p.antecedents?.dm && (
                            <span className="w-4 h-4 rounded bg-sky-600 text-white text-[10px] font-black inline-flex items-center justify-center shadow-sm" title="Diabético (DM)">
                                D
                            </span>
                        )}
                        {p.antecedents?.has && (
                            <span className="w-4 h-4 rounded bg-orange-500 text-white text-[10px] font-black inline-flex items-center justify-center shadow-sm" title="Hipertenso (HAS)">
                                H
                            </span>
                        )}
                        {hasAllergy && (
                            <span className="w-4 h-4 rounded bg-red-600 text-white text-[10px] font-black inline-flex items-center justify-center shadow-sm" title={`Alergias: ${p.allergies}`}>
                                A
                            </span>
                        )}
                        {p.forHandover && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-600 text-white shadow-sm flex items-center gap-1">
                                📢 ENTREGA
                            </span>
                        )}
                        {p.readyForDischarge && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-sm flex items-center gap-1">
                                ✅ ALTA
                            </span>
                        )}
                        {!p.readyForDischarge && p.preDischarge && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-200">
                                PREALTA
                            </span>
                        )}
                        {pendingTasksCount > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/60 text-yellow-800 dark:text-yellow-200">
                                ⚠️ {pendingTasksCount}
                            </span>
                        )}
                     </div>
                     <h3 className="font-extrabold text-base sm:text-lg text-blue-700 dark:text-blue-300 leading-tight mb-0.5 truncate">{applyPrivacy(p.name, privacyMode, 'name')}</h3>
                     <p className="text-xs opacity-80 mb-1.5 dark:text-slate-300 text-gray-700 line-clamp-1">{calculateAge(p.dob)} años • {p.diagnosis}</p>
                     
                     <div className="text-[11px] flex justify-between items-center bg-black/5 dark:bg-white/5 px-2 py-1 rounded dark:text-slate-300 text-slate-700">
                        <span className="truncate pr-2 opacity-85">{applyPrivacy(p.doctor, privacyMode, 'name')}</span>
                        {p.resident && (
                            <span className={`font-bold flex-shrink-0 px-1.5 py-0.5 rounded border text-[10px] flex items-center gap-1 ${resProfile.colorObj.badge}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${resProfile.colorObj.dot}`} />
                                {p.resident}
                            </span>
                        )}
                     </div>
                  </div>

                  {/* Controles laterales: Check de visita, Entrega, Alta en cama y Egreso definitivo */}
                  <div className="flex flex-col items-end justify-between self-stretch gap-2 flex-shrink-0">
                      <button onClick={(e) => toggleStatus(e, p)} title={p.status === 'done' ? 'Visitado hoy' : 'Pendiente de visita'}>
                          {p.status === 'done' ? <CheckSquare size={28} className={p.type === 'SND' ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400"}/> : <Square size={28} className={p.type === 'SND' ? "text-orange-500" : "text-red-500"}/>}
                      </button>

                      <div className="flex items-center gap-1 mt-auto">
                          <span className="text-[10px] font-bold opacity-60 text-slate-800 dark:text-slate-200 mr-0.5">{calculateLOS(p.admissionDate)}d</span>
                          <button
                              onClick={(e) => toggleHandover(e, p)}
                              className={`p-1.5 rounded-lg border transition flex items-center gap-0.5 text-[10px] font-bold ${p.forHandover ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-black/5 dark:bg-white/10 border-transparent text-slate-600 dark:text-slate-300 hover:bg-indigo-100 hover:text-indigo-700'}`}
                              title={p.forHandover ? "Marcado para comentar en Entrega. Toca para quitar." : "Marcar para comentar en Entrega"}
                          >
                              <Megaphone size={13}/>
                          </button>
                          <button
                              onClick={(e) => toggleReadyForDischarge(e, p)}
                              className={`p-1.5 rounded-lg border transition flex items-center gap-0.5 text-[10px] font-bold ${p.readyForDischarge ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-black/5 dark:bg-white/10 border-transparent text-slate-600 dark:text-slate-300 hover:bg-emerald-100 hover:text-emerald-700'}`}
                              title={p.readyForDischarge ? "Alta firmada (esperando desocupar cama). Toca para quitar." : "Marcar Alta Lista (sigue en cama)"}
                          >
                              <FileCheck2 size={13}/>
                          </button>
                          <button
                              onClick={(e) => dischargePatient(e, p)}
                              className="bg-black/10 dark:bg-white/10 p-1.5 rounded-lg hover:bg-red-100 hover:text-red-500 dark:text-slate-300 transition"
                              title="Egresar del censo (Ya desocupó cama)"
                          >
                              <LogOut size={13}/>
                          </button>
                      </div>
                  </div>
               </div>
            </div>
            );
         })}

         {filteredPatients.length === 0 && (
             <div className="text-center py-10 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-gray-300 dark:border-slate-700">
                 <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                     {filterRes ? `No hay pacientes asignados a ${filterRes === matchedUserResident ? 'ti' : filterRes}.` : "No hay pacientes que coincidan con la búsqueda o filtros."}
                 </p>
                 {hasActiveFilters && (
                     <button onClick={clearAllFilters} className="mt-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
                         Restablecer vista (Ver todos)
                     </button>
                 )}
             </div>
         )}
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-6">
          <button onClick={shareCurrentCensusMessage} className="py-2.5 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 rounded-lg text-xs font-bold border border-emerald-200 dark:border-emerald-700 transition active:scale-95 shadow-sm">📱 WA Censo</button>
          <button onClick={shareDOPMessage} className="py-2.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-200 rounded-lg text-xs font-bold border border-green-200 dark:border-green-700 transition active:scale-95 shadow-sm">📱 WA DOP</button>
          <button onClick={exportDOP} className="py-2.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-200 rounded-lg text-xs font-bold border border-blue-200 dark:border-blue-700 transition active:scale-95 shadow-sm">📊 CSV DOP</button>
          <button onClick={exportGeneral} className="py-2.5 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold border border-gray-300 dark:border-gray-600 transition active:scale-95 shadow-sm">📊 CSV Total</button>
      </div>

      <button onClick={() => setShowAddModal(true)} className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-xl hover:bg-blue-700 transition z-20"><Plus size={28} /></button>
      {showAddModal && <PatientFormModal onClose={() => setShowAddModal(false)} mode="create" dynamicResidents={dynamicResidents} dynamicDoctors={dynamicDoctors} dynamicLocations={dynamicLocations} settingsMeta={settingsMeta} />}
    </div>
  );
}
