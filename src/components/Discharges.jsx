import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { calculateAge, applyPrivacy, normalizeText, downloadCSV, getLocalISODate } from '../utils';
import {
  RefreshCw, Search, X, Download, RotateCcw, FileText,
  SlidersHorizontal, Calendar as CalendarIcon, ChevronLeft, ChevronRight
} from 'lucide-react';
import PatientDetail from './PatientDetail';

// Obtiene YYYY-MM-DD local de un ISO string de egreso
const getDischargeLocalDate = (isoStr) => {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d - offset).toISOString().slice(0, 10);
};

// Clasifica el hospital para los puntos del calendario (HZH = naranja, Instituto = gris, Otro = azul)
const getHospitalCategory = (hosp) => {
  const norm = normalizeText(hosp || '');
  if (!norm || norm === 'hzh' || norm.includes('zambrano')) return 'hzh';
  if (norm.includes('instituto')) return 'instituto';
  return 'other';
};

export default function Discharges({ user, dynamicResidents = [], dynamicDoctors = [], dynamicLocations = [], privacyMode }) {
  const today = getLocalISODate();
  const [archived, setArchived] = useState([]);
  const [legacy, setLegacy] = useState([]);
  const [daysBack, setDaysBack] = useState(60);
  const [selectedPatient, setSelectedPatient] = useState(null);

  // Buscador y filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDoc, setFilterDoc] = useState('');
  const [filterHosp, setFilterHosp] = useState('');
  const [selectedDate, setSelectedDate] = useState(''); // '' = todos los días cargados, 'YYYY-MM-DD' = día específico
  const [showFilters, setShowFilters] = useState(false);

  // Estado del mini-calendario inferior (muestra el mes anterior y el mes en curso por default para historial de egresos)
  const [baseCalMonth, setBaseCalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 1, 1);
  });

  const topRef = useRef(null);

  // Ampliar daysBack automáticamente si el usuario selecciona una fecha antigua
  useEffect(() => {
    if (!selectedDate) return;
    const sel = new Date(selectedDate + 'T12:00:00');
    const now = new Date();
    const diffDays = Math.ceil((now - sel) / (1000 * 60 * 60 * 24));
    if (diffDays + 15 > daysBack) {
      setDaysBack(Math.max(daysBack, diffDays + 35));
    }
  }, [selectedDate, daysBack]);

  // Ampliar daysBack automáticamente si navega meses anteriores en el calendario
  useEffect(() => {
    const now = new Date();
    const diffDays = Math.ceil((now - baseCalMonth) / (1000 * 60 * 60 * 24));
    if (diffDays + 10 > daysBack) {
      setDaysBack(Math.max(daysBack, diffDays + 35));
    }
  }, [baseCalMonth, daysBack]);

  useEffect(() => {
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - daysBack);
    const limitStr = limitDate.toISOString();

    const qArchived = query(collection(db, "archived_patients"), where("dischargeDate", ">=", limitStr));
    const unsubArchived = onSnapshot(qArchived, (snapshot) => {
      setArchived(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => { console.error(error); });

    const qLegacy = query(collection(db, "patients"), where("discharged", "==", true));
    const unsubLegacy = onSnapshot(qLegacy, (snapshot) => {
      const allLegacy = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const recentLegacy = allLegacy.filter(p => (p.dischargeDate || "") >= limitStr);
      setLegacy(recentLegacy);
    }, (error) => { console.error(error); });

    return () => { unsubArchived(); unsubLegacy(); };
  }, [daysBack]);

  // Deduplicar y agregar dischargeDay (YYYY-MM-DD)
  const allDischarged = useMemo(() => {
    const map = new Map();
    [...legacy, ...archived].forEach(p => {
      map.set(p.id, { ...p, dischargeDay: getDischargeLocalDate(p.dischargeDate) });
    });
    return Array.from(map.values()).sort((a, b) => new Date(b.dischargeDate || 0) - new Date(a.dischargeDate || 0));
  }, [archived, legacy]);

  const availableDoctors = useMemo(() => {
    const docs = allDischarged.map(p => p.doctor).filter(Boolean);
    return Array.from(new Set([...docs, ...dynamicDoctors])).sort();
  }, [allDischarged, dynamicDoctors]);

  const availableHospitals = useMemo(() => {
    const hosps = allDischarged.map(p => p.hospital).filter(Boolean);
    return Array.from(new Set([...hosps, ...dynamicLocations])).sort();
  }, [allDischarged, dynamicLocations]);

  // Mapa de puntos para el calendario de egresos
  const calendarDotsMap = useMemo(() => {
    const q = normalizeText(searchTerm);
    const map = {};
    allDischarged.forEach(p => {
      if (!p.dischargeDay) return;
      if (q) {
        const haystack = normalizeText(`${p.name || ''} ${p.diagnosis || ''} ${p.doctor || ''} ${p.resident || ''} ${p.bed || ''} ${p.hospital || ''}`);
        if (!haystack.includes(q)) return;
      }
      if (filterDoc && p.doctor !== filterDoc) return;
      if (filterHosp && (p.hospital || '') !== filterHosp) return;

      if (!map[p.dischargeDay]) map[p.dischargeDay] = { hzh: false, instituto: false, other: false, total: 0 };
      const cat = getHospitalCategory(p.hospital);
      map[p.dischargeDay][cat] = true;
      map[p.dischargeDay].total += 1;
    });
    return map;
  }, [allDischarged, searchTerm, filterDoc, filterHosp]);

  const datesWithDischarges = useMemo(() => {
    return Object.keys(calendarDotsMap).sort().reverse();
  }, [calendarDotsMap]);

  const filteredPatients = useMemo(() => {
    const q = normalizeText(searchTerm);
    return allDischarged.filter(p => {
      if (selectedDate && p.dischargeDay !== selectedDate) return false;
      if (q) {
        const haystack = normalizeText(`${p.name || ''} ${p.diagnosis || ''} ${p.doctor || ''} ${p.resident || ''} ${p.bed || ''} ${p.hospital || ''}`);
        if (!haystack.includes(q)) return false;
      }
      if (filterDoc && p.doctor !== filterDoc) return false;
      if (filterHosp && (p.hospital || '') !== filterHosp) return false;
      return true;
    });
  }, [allDischarged, searchTerm, filterDoc, filterHosp, selectedDate]);

  const handleReingreso = async (e, p) => {
    e.stopPropagation();
    if (confirm(`¿Estás seguro de reingresar a ${applyPrivacy(p.name, privacyMode, 'name')} al censo activo?`)) {
      try {
        const pRef = doc(db, "patients", p.id);
        const aRef = doc(db, "archived_patients", p.id);

        const reingresoData = { ...p, discharged: false, readyForDischarge: false, status: 'pending', bed: p.bed || 'Por asignar' };
        delete reingresoData.dischargeDate;
        delete reingresoData.dischargeDay;

        await setDoc(pRef, reingresoData);
        try { await deleteDoc(aRef); } catch (e) {}

        alert("Paciente reingresado exitosamente al Censo Activo.");
      } catch (err) {
        alert("Error al reingresar: " + err.message);
      }
    }
  };

  const exportDischargesCSV = () => {
    if (filteredPatients.length === 0) return alert("No hay egresos para exportar.");
    const data = filteredPatients.map(p => [
      p.dischargeDate ? new Date(p.dischargeDate).toLocaleDateString('es-MX') : 'N/A',
      p.name,
      calculateAge(p.dob),
      p.diagnosis,
      p.doctor || '',
      p.resident || '',
      p.hospital || '',
      p.bed || ''
    ]);
    downloadCSV(data, ["Fecha Egreso", "Paciente", "Edad", "Diagnostico", "Tratante", "Residente", "Hospital", "Cama"], "Historial_Egresos.csv");
  };

  const handleSelectDateFromCalendar = (dateStr) => {
    setSelectedDate(prev => prev === dateStr ? '' : dateStr);
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (selectedPatient) {
    return (
      <PatientDetail
        patient={{ ...selectedPatient, discharged: true }}
        onClose={() => setSelectedPatient(null)}
        user={user || { email: 'Archivo' }}
        dynamicResidents={dynamicResidents}
        dynamicDoctors={dynamicDoctors}
        dynamicLocations={dynamicLocations}
        privacyMode={privacyMode}
      />
    );
  }

  const hasFilters = Boolean(searchTerm || filterDoc || filterHosp || selectedDate);
  const activeFilterCount = [filterDoc, filterHosp, selectedDate].filter(Boolean).length;
  const nextCalMonth = new Date(baseCalMonth.getFullYear(), baseCalMonth.getMonth() + 1, 1);

  return (
    <div ref={topRef} className="pb-24 pt-1 space-y-3">
      {/* Cabecera Compacta Móvil */}
      <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-blue-100 dark:border-slate-700 shadow-sm space-y-2">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="font-bold text-base sm:text-lg text-slate-800 dark:text-white leading-tight">Historial de Egresos</h2>
            <p className="text-[11px] text-gray-500 dark:text-slate-400">
              {selectedDate ? (
                <span>Fecha: <strong className="text-blue-600 dark:text-blue-400">{selectedDate}</strong> ({filteredPatients.length})</span>
              ) : (
                <span>Últimos {daysBack} días • <strong>{filteredPatients.length}</strong> egreso(s)</span>
              )}
            </p>
          </div>
          <button
            onClick={exportDischargesCSV}
            className="bg-green-600 text-white text-[11px] px-2.5 py-1.5 rounded-lg font-bold shadow-sm flex items-center gap-1 hover:bg-green-700 transition"
          >
            <Download size={13} /> CSV
          </button>
        </div>

        {/* Buscador + Botón Filtros */}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar egreso por nombre, dx, tratante..."
              className="w-full pl-8 pr-7 py-1.5 border border-gray-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg text-xs focus:outline-none focus:border-blue-500"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition ${showFilters || activeFilterCount > 0 ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}
          >
            <SlidersHorizontal size={14} />
            {activeFilterCount > 0 && <span className="bg-white text-blue-600 rounded-full px-1.5 text-[10px] font-black">{activeFilterCount}</span>}
          </button>
          {hasFilters && (
            <button
              onClick={() => { setSearchTerm(''); setFilterDoc(''); setFilterHosp(''); setSelectedDate(''); }}
              className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300"
              title="Limpiar filtros"
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>

        {/* Chip de fecha activa para quitarlo rápido */}
        {selectedDate && (
          <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-lg text-xs font-bold">
            <span>📅 Viendo egresos del {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <button onClick={() => setSelectedDate('')} className="underline ml-2">Ver todos</button>
          </div>
        )}

        {/* Filtros desplegables */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 pt-1.5 border-t border-gray-100 dark:border-slate-700">
            <select className="border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg p-1.5 text-xs" value={filterDoc} onChange={e => setFilterDoc(e.target.value)}>
              <option value="">Tratante (Todos)</option>
              {availableDoctors.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className="border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg p-1.5 text-xs" value={filterHosp} onChange={e => setFilterHosp(e.target.value)}>
              <option value="">Hospital (Todos)</option>
              {availableHospitals.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg p-1.5 text-xs"
            />
          </div>
        )}
      </div>

      {/* Lista de Pacientes Egresados */}
      <div className="grid grid-cols-1 gap-2.5">
        {filteredPatients.map(p => (
          <div
            key={p.id}
            onClick={() => setSelectedPatient(p)}
            className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer transition relative group"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="bg-gray-500 text-white px-2 py-0.5 rounded font-black text-sm">{applyPrivacy(p.bed, privacyMode, 'bed')}</span>
                  {p.hospital && <span className="text-[10px] font-bold text-gray-500 dark:text-gray-300 bg-gray-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">{p.hospital}</span>}
                  <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 ml-auto">
                    Alta: {p.dischargeDate ? new Date(p.dischargeDate).toLocaleDateString('es-MX') : 'N/A'}
                  </span>
                </div>
                <h3 className="font-extrabold text-base sm:text-lg text-slate-800 dark:text-gray-200 leading-tight mb-0.5 truncate">{applyPrivacy(p.name, privacyMode, 'name')}</h3>
                <p className="text-xs mb-1.5 text-gray-600 dark:text-gray-400 line-clamp-1">{calculateAge(p.dob)} años • {p.diagnosis}</p>
                <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-700/50 px-2 py-1 rounded">
                  <span className="truncate pr-2">Tx: {applyPrivacy(p.doctor || 'N/A', privacyMode, 'name')}</span>
                  <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold flex-shrink-0">
                    <FileText size={11} /> {(p.notes || []).length} nota(s)
                  </span>
                </div>
              </div>

              <button
                onClick={(e) => handleReingreso(e, p)}
                className="p-2.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 transition shadow-sm self-center flex-shrink-0"
                title="Reingresar al censo activo"
              >
                <RefreshCw size={17} />
              </button>
            </div>
          </div>
        ))}

        {filteredPatients.length === 0 && (
          <div className="text-center py-10 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-gray-300 dark:border-slate-700">
            <p className="text-gray-400 text-xs">No se encontraron egresos con estos filtros.</p>
            {hasFilters && (
              <button onClick={() => { setSearchTerm(''); setFilterDoc(''); setFilterHosp(''); setSelectedDate(''); }} className="mt-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
                Ver todos los egresos
              </button>
            )}
          </div>
        )}
      </div>

      {/* =====================================================================
          MINI CALENDARIO DE EGRESOS INFERIOR + BUSCADOR POR FECHA
         ===================================================================== */}
      <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-blue-100 dark:border-slate-700 shadow-sm mt-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 dark:border-slate-700 pb-2">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <CalendarIcon size={14} className="text-blue-600 dark:text-blue-400" /> Calendario de Egresos
            </h3>
            <p className="text-[10px] text-gray-500 dark:text-slate-400">
              Toca un día con punto para filtrar los pacientes dados de alta en esa fecha
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setBaseCalMonth(new Date(baseCalMonth.getFullYear(), baseCalMonth.getMonth() - 1, 1))}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200"
              title="Mes anterior"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              onClick={() => {
                const now = new Date();
                setBaseCalMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
              }}
              className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200"
            >
              Recientes
            </button>
            <button
              onClick={() => setBaseCalMonth(new Date(baseCalMonth.getFullYear(), baseCalMonth.getMonth() + 1, 1))}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200"
              title="Mes siguiente"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        {/* Buscador directo por fecha y selector de días con egresos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-bold text-gray-500 dark:text-slate-400 whitespace-nowrap">Buscar fecha:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="flex-1 p-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-xs bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
            />
          </div>

          <select
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="p-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-xs bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
          >
            <option value="">📅 Ver todos los días ({allDischarged.length} egresos)...</option>
            {datesWithDischarges.map(dStr => {
              const info = calendarDotsMap[dStr];
              const dObj = new Date(dStr + 'T12:00:00');
              const label = dObj.toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
              return (
                <option key={dStr} value={dStr}>
                  {label} — ({info.total} alta{info.total > 1 ? 's' : ''})
                </option>
              );
            })}
          </select>
        </div>

        {/* Dos meses en el mini-calendario */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <DischargeMiniMonthGrid
            monthDate={baseCalMonth}
            selectedDate={selectedDate}
            today={today}
            dotsMap={calendarDotsMap}
            onSelectDate={handleSelectDateFromCalendar}
          />
          <DischargeMiniMonthGrid
            monthDate={nextCalMonth}
            selectedDate={selectedDate}
            today={today}
            dotsMap={calendarDotsMap}
            onSelectDate={handleSelectDateFromCalendar}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-slate-700 text-[10px] font-bold text-gray-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block"></span> Zambrano (HZH)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-slate-400 inline-block"></span> Instituto</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span> Otro Hospital</span>
          </div>
          <button onClick={() => setDaysBack(daysBack + 30)} className="text-blue-600 dark:text-blue-400 hover:underline">
            + Cargar 30d más ({daysBack}d)
          </button>
        </div>
      </div>
    </div>
  );
}

function DischargeMiniMonthGrid({ monthDate, selectedDate, today, dotsMap, onSelectDate }) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const monthName = monthDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateStr });
  }

  const dayHeaders = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

  return (
    <div className="bg-slate-50/70 dark:bg-slate-900/40 p-2.5 rounded-xl border border-gray-100 dark:border-slate-700/70">
      <div className="text-xs font-black uppercase text-center text-slate-700 dark:text-slate-200 mb-2">
        {monthName}
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold text-gray-400 dark:text-slate-500 mb-1">
        {dayHeaders.map((dh, idx) => <div key={idx}>{dh}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((cell, idx) => {
          if (!cell) return <div key={`empty-${idx}`} className="h-8" />;
          const info = dotsMap[cell.dateStr];
          const isSelected = cell.dateStr === selectedDate;
          const isToday = cell.dateStr === today;

          return (
            <button
              key={cell.dateStr}
              onClick={() => onSelectDate(cell.dateStr)}
              className={`h-8 rounded-lg flex flex-col items-center justify-center relative transition ${
                isSelected
                  ? 'bg-blue-600 text-white font-black shadow-sm'
                  : isToday
                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-black ring-1 ring-blue-400'
                  : info
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold hover:bg-blue-50'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 text-xs'
              }`}
            >
              <span className="text-[11px] leading-none">{cell.day}</span>
              {info && (
                <div className="flex items-center gap-0.5 mt-0.5">
                  {info.hzh && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-orange-300' : 'bg-orange-500'}`} />}
                  {info.instituto && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-gray-200' : 'bg-gray-400 dark:bg-slate-400'}`} />}
                  {info.other && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-blue-200' : 'bg-blue-500'}`} />}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
