import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, query, deleteDoc, doc, updateDoc, setDoc, where } from 'firebase/firestore';
import {
  Plus, Trash2, Calendar as CalendarIcon, Download, Edit, CheckCircle, XCircle,
  UserPlus, Search, X, RotateCcw, Share2, ChevronLeft, ChevronRight, Clock,
  SlidersHorizontal, List, LayoutGrid, Shield, Moon, MapPin, Lock
} from 'lucide-react';
import { downloadCSV, getLocalISODate, applyPrivacy, normalizeText, getOrderedResidents, getMemberProfile, getGuardForDate, canUserManageSchedule } from '../utils';

// Convierte "HH:MM" a horas decimales (ej. "08:30" -> 8.5)
const parseTimeToHours = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return 8;
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h)) return 8;
  return h + (isNaN(m) ? 0 : m / 60);
};

// Formatea horas decimales a "HH:MM"
const formatHoursToTime = (decHours) => {
  const clamped = Math.max(0, Math.min(23.99, decHours));
  const h = Math.floor(clamped);
  const m = Math.round((clamped - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m === 60 ? 59 : m).padStart(2, '0')}`;
};

// Clasifica la sede para los colores (HZH = naranja, Instituto = gris, Otro = azul)
const getLocationCategory = (loc) => {
  const norm = normalizeText(loc || '');
  if (norm === 'hzh' || norm.includes('zambrano')) return 'hzh';
  if (norm.includes('instituto')) return 'instituto';
  return 'other';
};

export default function Surgery({ user, dynamicResidents, dynamicDoctors, dynamicLocations, privacyMode, settingsMeta = {}, onOpenRotation }) {
  const today = getLocalISODate();
  const [surgeries, setSurgeries] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingSurgery, setEditingSurgery] = useState(null);
  const [prefillSlot, setPrefillSlot] = useState(null); // { date, time }
  const [transferringSurgery, setTransferringSurgery] = useState(null);
  const [activeSurgeryDetail, setActiveSurgeryDetail] = useState(null);

  const { allowed: canManageSchedule, profile: currentUserProfile } = useMemo(
    () => canUserManageSchedule(user, settingsMeta),
    [user, settingsMeta]
  );

  // Vista: 'day' (Google Calendar Hora x Hora) | 'list' (Lista continua)
  const [viewMode, setViewMode] = useState('day');
  const [selectedDate, setSelectedDate] = useState(today);

  // Buscador y filtros colapsables
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [filterRes, setFilterRes] = useState(''); // Por defecto en '' (Todos los residentes) para ver la programación completa de quirófano
  const [filterDoc, setFilterDoc] = useState('');
  const [filterLoc, setFilterLoc] = useState('');
  const [listPeriod, setListPeriod] = useState('upcoming'); // 'upcoming' | 'past' | 'all' (para vista lista)
  const [showFilters, setShowFilters] = useState(false);

  // Ventana de carga histórica en días hacia atrás
  const [daysBack, setDaysBack] = useState(45);

  // Estado del mini-calendario inferior (por default mes en curso y el siguiente)
  const [baseCalMonth, setBaseCalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const topRef = useRef(null);
  const resiList = dynamicResidents || [];
  const docList = dynamicDoctors || [];
  const locList = dynamicLocations || [];

  const { allOrdered: orderedResidents, hzhResidents, otherResidents } = useMemo(
    () => getOrderedResidents(resiList, settingsMeta),
    [resiList, settingsMeta]
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

  const userSurgeriesCount = useMemo(() => {
    if (!matchedUserResident) return 0;
    const normUser = normalizeText(matchedUserResident);
    return surgeries.filter(s => !s.cancelled && (normalizeText(s.resident) === normUser || normalizeText(s.resident2) === normUser)).length;
  }, [surgeries, matchedUserResident]);



  const selectedDayGuard = useMemo(() => getGuardForDate(selectedDate, settingsMeta), [selectedDate, settingsMeta]);

  // Si el usuario selecciona una fecha anterior a la ventana cargada, ampliamos daysBack automáticamente
  useEffect(() => {
    if (!selectedDate) return;
    const sel = new Date(selectedDate + 'T12:00:00');
    const now = new Date();
    const diffDays = Math.ceil((now - sel) / (1000 * 60 * 60 * 24));
    if (diffDays + 15 > daysBack) {
      setDaysBack(Math.max(daysBack, diffDays + 35));
    }
  }, [selectedDate, daysBack]);

  // También si navega el mini-calendario hacia meses pasados, ampliamos daysBack automáticamente
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
    const limitStr = limitDate.toISOString().slice(0, 10);

    const q = query(collection(db, "surgeries"), where("date", ">=", limitStr));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(a.date + 'T' + (a.time || '00:00')) - new Date(b.date + 'T' + (b.time || '00:00')));
      setSurgeries(data);
    }, (error) => { console.error(error); });
    return () => unsubscribe();
  }, [daysBack]);

  // Hora actual para la línea roja en Google Calendar
  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  });
  useEffect(() => {
    const interval = setInterval(() => {
      const d = new Date();
      setNowMinutes(d.getHours() + d.getMinutes() / 60);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (id) => {
    if (confirm("¿Borrar cirugía?")) {
      await deleteDoc(doc(db, "surgeries", id));
      setActiveSurgeryDetail(null);
    }
  };

  const handleEdit = (s) => {
    setActiveSurgeryDetail(null);
    setPrefillSlot(null);
    setEditingSurgery(s);
    setShowModal(true);
  };

  const toggleComplete = async (s) => {
    await updateDoc(doc(db, "surgeries", s.id), { completed: !s.completed });
  };

  const toggleCancel = async (s) => {
    if (confirm(s.cancelled ? "¿Reactivar cirugía?" : "¿Cancelar cirugía?")) {
      await updateDoc(doc(db, "surgeries", s.id), { cancelled: !s.cancelled });
    }
  };

  // Filtrado común por texto, residente, tratante y sede
  const matchesFilters = (s) => {
    const q = normalizeText(searchTerm);
    if (q) {
      const haystack = normalizeText(`${s.patientName || ''} ${s.procedure || ''} ${s.doctor || ''} ${s.resident || ''} ${s.resident2 || ''} ${s.location || ''}`);
      if (!haystack.includes(q)) return false;
    }
    if (filterRes) {
      if (filterRes === 'Por Asignar') {
        if (s.resident) return false;
      } else if (s.resident !== filterRes && s.resident2 !== filterRes) {
        return false;
      }
    }
    if (filterDoc && s.doctor !== filterDoc) return false;
    if (filterLoc && s.location !== filterLoc) return false;
    return true;
  };

  // Cirugías del día seleccionado (para vista Google Calendar Hora x Hora)
  const daySurgeries = useMemo(() => {
    return surgeries
      .filter(s => s.date === selectedDate && matchesFilters(s))
      .sort((a, b) => parseTimeToHours(a.time) - parseTimeToHours(b.time));
  }, [surgeries, selectedDate, searchTerm, filterRes, filterDoc, filterLoc]);

  // Cirugías para la vista de Lista
  const listSurgeries = useMemo(() => {
    const filtered = surgeries.filter(s => {
      if (listPeriod === 'upcoming' && s.date < today) return false;
      if (listPeriod === 'past' && s.date >= today) return false;
      return matchesFilters(s);
    });
    if (listPeriod === 'past') {
      return [...filtered].sort((a, b) => new Date(b.date + 'T' + (b.time || '00:00')) - new Date(a.date + 'T' + (a.time || '00:00')));
    }
    return filtered;
  }, [surgeries, listPeriod, today, searchTerm, filterRes, filterDoc, filterLoc]);

  // Mapa de puntos por fecha para el mini-calendario: dateStr -> { hzh: bool, instituto: bool, other: bool, total: number }
  const calendarDotsMap = useMemo(() => {
    const map = {};
    surgeries.forEach(s => {
      if (s.cancelled || !s.date) return;
      if (!matchesFilters(s)) return;
      if (!map[s.date]) map[s.date] = { hzh: false, instituto: false, other: false, total: 0 };
      const cat = getLocationCategory(s.location);
      map[s.date][cat] = true;
      map[s.date].total += 1;
    });
    return map;
  }, [surgeries, searchTerm, filterRes, filterDoc, filterLoc]);

  // Fechas con cirugías para el dropdown de acceso rápido
  const datesWithSurgeries = useMemo(() => {
    return Object.keys(calendarDotsMap).sort().reverse();
  }, [calendarDotsMap]);

  // Estadísticas rápidas
  const stats = useMemo(() => {
    const upcoming = surgeries.filter(s => s.date >= today && !s.cancelled);
    const todayCount = upcoming.filter(s => s.date === today).length;
    const unassignedCount = upcoming.filter(s => !s.resident).length;
    return { upcomingCount: upcoming.length, todayCount, unassignedCount };
  }, [surgeries, today]);

  // Cálculo de columnas para traslapes en la vista Google Calendar
  const positionedDaySurgeries = useMemo(() => {
    const items = daySurgeries.map(s => {
      const start = parseTimeToHours(s.time);
      const duration = Number(s.duration) > 0 ? Number(s.duration) : 1; // 1 hora default
      const end = start + duration;
      return { ...s, start, duration, end };
    });

    // Algoritmo de columnas para eventos que se traslapan en horario
    const columns = [];
    const results = [];

    items.forEach(item => {
      let placed = false;
      for (let i = 0; i < columns.length; i++) {
        const lastInCol = columns[i][columns[i].length - 1];
        if (lastInCol.end <= item.start + 0.01) {
          columns[i].push(item);
          results.push({ ...item, colIndex: i });
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([item]);
        results.push({ ...item, colIndex: columns.length - 1 });
      }
    });

    // Determinar cuántas columnas concurrentes tiene cada evento
    return results.map(r => {
      const overlapping = results.filter(other => other.start < r.end - 0.01 && other.end > r.start + 0.01);
      const maxCol = overlapping.reduce((acc, cur) => Math.max(acc, cur.colIndex), 0) + 1;
      return { ...r, totalCols: maxCol };
    });
  }, [daySurgeries]);

  // Rango de horas de la cuadrícula (por defecto 06:00 a 21:00, ampliable si hay cx antes/después)
  const { startHour, endHour } = useMemo(() => {
    let minH = 6;
    let maxH = 21;
    positionedDaySurgeries.forEach(s => {
      if (Math.floor(s.start) < minH) minH = Math.max(0, Math.floor(s.start));
      if (Math.ceil(s.end) > maxH) maxH = Math.min(24, Math.ceil(s.end));
    });
    return { startHour: minH, endHour: maxH };
  }, [positionedDaySurgeries]);

  const hoursArray = useMemo(() => {
    const arr = [];
    for (let h = startHour; h <= endHour; h++) arr.push(h);
    return arr;
  }, [startHour, endHour]);

  const shiftSelectedDate = (days) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + days);
    const offset = d.getTimezoneOffset() * 60000;
    const newStr = new Date(d - offset).toISOString().slice(0, 10);
    setSelectedDate(newStr);
  };

  const handleSelectDateFromCalendar = (dateStr) => {
    setSelectedDate(dateStr);
    setViewMode('day');
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const exportSurgeries = () => {
    const data = surgeries.map(s => [s.date, s.time, `${Number(s.duration) || 1}h`, s.patientName, s.procedure, s.location, s.doctor, s.resident || 'Por Asignar', s.completed ? 'Si' : 'No']);
    downloadCSV(data, ["Fecha", "Hora", "Duracion", "Paciente", "Procedimiento", "Sede", "Tratante", "Residente", "Completada"], "Historico_Quirofano.csv");
  };

  const shareSurgeriesWA = async () => {
    const targetList = viewMode === 'day' ? daySurgeries : listSurgeries;
    if (targetList.length === 0) return alert("No hay cirugías en la vista actual para compartir.");

    let text = `🔪 *Programación Quirófano Urología*\n📋 Total: ${targetList.length} cirugía(s)\n`;
    let currentDay = null;
    targetList.forEach(s => {
      if (s.date !== currentDay) {
        currentDay = s.date;
        const dObj = new Date(s.date + 'T12:00:00');
        const dStr = dObj.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
        const gInfo = getGuardForDate(s.date, settingsMeta);
        text += `\n📅 *${dStr.toUpperCase()}*\n`;
        if (gInfo.guardia || gInfo.posguardia) {
          text += `🛡️ Guardia: *${gInfo.guardia || 'S/A'}* | 💤 Posguardia: *${gInfo.posguardia || 'S/A'}*\n`;
        }
      }
      const dur = Number(s.duration) || 1;
      const statusIcon = s.cancelled ? '❌' : s.completed ? '✅' : '🕒';
      text += `${statusIcon} *${s.time || '--:--'}* (${dur}h) [${s.location || 'S/S'}] - *${applyPrivacy(s.patientName, privacyMode, 'name')}*\n`;
      text += `   • Cx: ${s.procedure}\n`;
      text += `   • Tx: ${applyPrivacy(s.doctor, privacyMode, 'name')} | Res: ${s.resident || 'Por Asignar'}${s.resident2 ? ` + ${s.resident2}` : ''}\n`;
    });

    if (navigator.share && navigator.canShare) {
      try {
        await navigator.share({ text });
      } catch (err) {
        navigator.clipboard.writeText(text);
        alert("Programación copiada al portapapeles para WhatsApp.");
      }
    } else {
      navigator.clipboard.writeText(text);
      alert("Programación copiada al portapapeles para WhatsApp.");
    }
  };

  const getEventBlockStyle = (s) => {
    if (s.cancelled) return "bg-gray-100/90 dark:bg-slate-800/80 border-l-4 border-gray-400 text-gray-400 line-through";
    if (s.completed) return "bg-emerald-50/95 dark:bg-emerald-950/85 border-l-4 border-emerald-600 text-emerald-950 dark:text-emerald-100 shadow-sm";
    const cat = getLocationCategory(s.location);
    if (cat === 'hzh') return "bg-orange-50/95 dark:bg-orange-950/80 border-l-4 border-orange-500 text-orange-950 dark:text-orange-100 shadow-sm";
    if (cat === 'instituto') return "bg-slate-100/95 dark:bg-slate-800/95 border-l-4 border-slate-500 text-slate-900 dark:text-slate-100 shadow-sm";
    return "bg-blue-50/95 dark:bg-blue-950/80 border-l-4 border-blue-600 text-blue-950 dark:text-blue-100 shadow-sm";
  };

  const getCardStyle = (s) => {
    if (s.cancelled) return "bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 opacity-50";
    if (s.completed) return "bg-white dark:bg-green-900/30 border-l-[8px] border-green-600 dark:border-green-500 shadow-md";
    const cat = getLocationCategory(s.location);
    if (cat === 'hzh') return "bg-white dark:bg-orange-950/30 border-l-[8px] border-orange-500 dark:border-orange-500 shadow-md";
    if (cat === 'instituto') return "bg-white dark:bg-slate-800 border-l-[8px] border-slate-500 dark:border-slate-400 shadow-md";
    return "bg-white dark:bg-blue-900/30 border-l-[8px] border-blue-600 dark:border-blue-500 shadow-md";
  };

  const hasActiveFilters = Boolean(searchTerm || filterRes || filterDoc || filterLoc);
  const activeDrawerFiltersCount = [filterDoc, filterLoc].filter(Boolean).length;

  const clearFilters = () => {
    setSearchTerm('');
    setShowSearchInput(false);
    setFilterRes('');
    setFilterDoc('');
    setFilterLoc('');
  };

  const selectedDateFormatted = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    return d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }, [selectedDate]);

  // Alturas dinámicas: horas vacías muy compactas (26px) y horas con cirugía amplias (92px)
  const EMPTY_HOUR_HEIGHT = 26;
  const ACTIVE_HOUR_HEIGHT = 92;

  // Determina si una hora [h, h+1) tiene alguna cirugía activa
  const hourHasSurgeryMap = useMemo(() => {
    const map = {};
    hoursArray.forEach(h => {
      map[h] = positionedDaySurgeries.some(s => s.start < h + 1 && s.end > h);
    });
    return map;
  }, [hoursArray, positionedDaySurgeries]);

  const getHourHeight = (h) => (hourHasSurgeryMap[h] ? ACTIVE_HOUR_HEIGHT : EMPTY_HOUR_HEIGHT);

  // Calcula la posición vertical (px) exacta para cualquier hora decimal (ej. 8.5 -> 08:30)
  const getYPositionForTime = (decTime) => {
    let y = 0;
    for (let h = startHour; h < endHour; h++) {
      const hHeight = getHourHeight(h);
      if (decTime >= h + 1) {
        y += hHeight;
      } else if (decTime > h) {
        y += (decTime - h) * hHeight;
        break;
      } else {
        break;
      }
    }
    return y;
  };

  const totalGridHeight = useMemo(() => {
    return hoursArray.reduce((sum, h) => sum + getHourHeight(h), 0);
  }, [hoursArray, hourHasSurgeryMap]);

  let lastDate = null;

  const nextCalMonth = useMemo(() => {
    return new Date(baseCalMonth.getFullYear(), baseCalMonth.getMonth() + 1, 1);
  }, [baseCalMonth]);

  return (
    <div ref={topRef} className="pb-24 space-y-3">
      {/* Cabecera Compacta Móvil */}
      <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-blue-100 dark:border-slate-700 shadow-sm space-y-2">
        {/* Fila 1: Título + Switch Vista (Agenda Hora x Hora vs Lista) + Acciones WA/CSV */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5">
            <div className="flex bg-slate-100 dark:bg-slate-700 p-0.5 rounded-lg">
              <button
                onClick={() => setViewMode('day')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition ${viewMode === 'day' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                title="Vista Agenda Hora por Hora (Google Calendar)"
              >
                <LayoutGrid size={13} /> Día
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition ${viewMode === 'list' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                title="Vista Lista Continua"
              >
                <List size={13} /> Lista
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={shareSurgeriesWA} className="bg-emerald-600 text-white text-[11px] px-2.5 py-1.5 rounded-lg font-bold shadow-sm flex gap-1 items-center hover:bg-emerald-700 transition">
              <Share2 size={13} /> WA
            </button>
            <button onClick={exportSurgeries} className="bg-green-600 text-white text-[11px] px-2.5 py-1.5 rounded-lg font-bold shadow-sm flex gap-1 items-center hover:bg-green-700 transition">
              <Download size={13} /> CSV
            </button>
          </div>
        </div>

        {/* Fila 2: Filtro Residente (Principal) + Toggle Buscador + Filtros Avanzados + Reset */}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <select
              value={filterRes}
              onChange={e => setFilterRes(e.target.value)}
              className="w-full py-1.5 pl-2.5 pr-6 border border-gray-200 dark:border-slate-600 rounded-lg text-xs font-bold bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 truncate"
            >
              <option value="">👥 Todos los residentes ({surgeries.length})</option>
              <option value="Por Asignar">⚠️ Por Asignar ({stats.unassignedCount})</option>
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
            <Search size={14} />
          </button>

          {/* Botón filtros avanzados */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-2 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition ${showFilters || activeDrawerFiltersCount > 0 ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}
            title="Filtros por Tratante y Sede"
          >
            <SlidersHorizontal size={14} />
            {activeDrawerFiltersCount > 0 && <span className="bg-white text-blue-600 rounded-full px-1.5 text-[10px] font-black">{activeDrawerFiltersCount}</span>}
          </button>

          {/* Botón limpiar filtros */}
          {hasActiveFilters && (
            <button onClick={clearFilters} className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300" title="Limpiar todos los filtros">
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
              placeholder="Buscar paciente, procedimiento, tratante..."
              className="w-full pl-8 pr-7 py-1.5 border border-blue-200 dark:border-blue-700 bg-blue-50/50 dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* Filtros desplegables (Tratante y Sede) */}
        {showFilters && (
          <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-gray-100 dark:border-slate-700">
            <select className="border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg p-1.5 text-xs font-medium" value={filterDoc} onChange={e => setFilterDoc(e.target.value)}>
              <option value="">Tratante (Todos)</option>
              {docList.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className="border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg p-1.5 text-xs font-medium" value={filterLoc} onChange={e => setFilterLoc(e.target.value)}>
              <option value="">Sede (Todas)</option>
              {locList.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        )}

        {/* Barra de Navegación de Fecha para Vista Día (Google Calendar) */}
        {viewMode === 'day' && (
          <div className="pt-1.5 border-t border-gray-100 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => shiftSelectedDate(-1)}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200"
                  title="Día anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => shiftSelectedDate(1)}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200"
                  title="Día siguiente"
                >
                  <ChevronRight size={16} />
                </button>
                <div className="ml-1">
                  <div className="text-xs sm:text-sm font-black capitalize text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                    <span>{selectedDateFormatted}</span>
                    {selectedDate === today ? (
                      <span className="text-[10px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded-full">HOY</span>
                    ) : selectedDate > today ? (
                      <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 px-1.5 py-0.5 rounded-full">
                        Futura
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 px-1.5 py-0.5 rounded-full">
                        Pasada
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-slate-400">
                    {daySurgeries.length} cirugía(s) programada(s)
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {selectedDate !== today && (
                  <button
                    onClick={() => setSelectedDate(today)}
                    className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/60 transition flex items-center gap-1 shadow-sm whitespace-nowrap"
                    title="Volver a la fecha de hoy"
                  >
                    <RotateCcw size={12} /> Ir a Hoy
                  </button>
                )}
                <label
                  className="relative p-1.5 rounded-lg border border-gray-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer flex items-center justify-center transition shadow-sm"
                  title="Seleccionar fecha"
                >
                  <CalendarIcon size={15} />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => e.target.value && setSelectedDate(e.target.value)}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* Indicador de Guardia y POS HZH para el día seleccionado */}
            <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-lg px-2 py-1.5">
              <div className="flex items-center justify-between gap-1.5 text-[11px]">
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  {/* Badge Guardia */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-black uppercase text-orange-600 dark:text-orange-400 flex items-center gap-0.5">
                      🛡️ Gua:
                    </span>
                    {selectedDayGuard.guardia ? (() => {
                      const gProf = getMemberProfile(selectedDayGuard.guardia, settingsMeta);
                      return (
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-black ${gProf.color.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${gProf.color.dot}`}></span>
                          {selectedDayGuard.guardia}
                        </span>
                      );
                    })() : (
                      <span className="text-[10px] font-semibold text-gray-400">—</span>
                    )}
                  </div>

                  <span className="text-gray-300 dark:text-slate-600">|</span>

                  {/* Badge POS (100% automático según guardia de ayer) */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5">
                      💤 POS:
                    </span>
                    {selectedDayGuard.posguardia ? (() => {
                      const pgProf = getMemberProfile(selectedDayGuard.posguardia, settingsMeta);
                      return (
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-bold opacity-90 ${pgProf.color.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${pgProf.color.dot}`}></span>
                          {selectedDayGuard.posguardia}
                        </span>
                      );
                    })() : (
                      <span className="text-[10px] font-semibold text-gray-400">—</span>
                    )}
                  </div>

                  {selectedDayGuard.freeResidents?.length > 0 && (
                    <>
                      <span className="text-gray-300 dark:text-slate-600">|</span>
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        🏖️ {selectedDayGuard.freeResidents.join(', ')}
                      </span>
                    </>
                  )}

                  {selectedDayGuard.activeAbsences?.length > 0 ? (
                    selectedDayGuard.activeAbsences.map(abs => (
                      <React.Fragment key={abs.resident}>
                        <span className="text-gray-300 dark:text-slate-600">|</span>
                        <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">
                          {abs.type === 'congreso' ? '🎓' : '✈️'} {abs.resident}
                        </span>
                      </React.Fragment>
                    ))
                  ) : selectedDayGuard.vacationResidents?.length > 0 ? (
                    <>
                      <span className="text-gray-300 dark:text-slate-600">|</span>
                      <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">
                        ✈️ {selectedDayGuard.vacationResidents.join(', ')}
                      </span>
                    </>
                  ) : null}
                </div>

                {onOpenRotation && (
                  <button
                    onClick={onOpenRotation}
                    className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/70 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition flex items-center justify-center flex-shrink-0 ml-auto"
                    title="Calendario de Guardias"
                    aria-label="Calendario de Guardias"
                  >
                    <CalendarIcon size={15} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Selector de periodo si está en Vista Lista */}
        {viewMode === 'list' && (
          <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-700/70 p-1 rounded-lg text-xs font-bold">
            <button onClick={() => setListPeriod('upcoming')} className={`py-1 rounded-md transition ${listPeriod === 'upcoming' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>
              Próximas ({stats.upcomingCount})
            </button>
            <button onClick={() => setListPeriod('past')} className={`py-1 rounded-md transition ${listPeriod === 'past' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>
              Historial
            </button>
            <button onClick={() => setListPeriod('all')} className={`py-1 rounded-md transition ${listPeriod === 'all' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>
              Todas ({surgeries.length})
            </button>
          </div>
        )}
      </div>

      {/* =====================================================================
          VISTA 1: ESTILO GOOGLE CALENDAR (HORA POR HORA COMPACTA)
         ===================================================================== */}
      {viewMode === 'day' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
          {/* Cuadrícula Hora por Hora con horas vacías compactas */}
          <div className="relative select-none" style={{ height: `${totalGridHeight}px` }}>
            {/* Filas de cada hora */}
            {hoursArray.map((hour) => {
              const hourLabel = `${String(hour).padStart(2, '0')}:00`;
              const topY = getYPositionForTime(hour);
              const rowH = getHourHeight(hour);
              const isOccupied = hourHasSurgeryMap[hour];

              return (
                <div
                  key={hour}
                  onClick={() => {
                    setEditingSurgery(null);
                    setPrefillSlot({ date: selectedDate, time: hourLabel });
                    setShowModal(true);
                  }}
                  className={`absolute left-0 right-0 flex border-b border-gray-100 dark:border-slate-700/60 hover:bg-blue-50/40 dark:hover:bg-slate-700/30 transition cursor-pointer group ${isOccupied ? '' : 'items-center'}`}
                  style={{ top: `${topY}px`, height: `${rowH}px` }}
                >
                  {/* Columna de la hora */}
                  <div className={`w-12 flex-shrink-0 pr-1.5 text-right font-mono border-r border-gray-100 dark:border-slate-700/70 h-full flex ${isOccupied ? 'pt-1 items-start text-[11px] font-bold text-slate-500 dark:text-slate-400' : 'items-center justify-end text-[10px] text-gray-400 dark:text-slate-500'}`}>
                    {hourLabel}
                  </div>
                  {/* Espacio horario */}
                  <div className="flex-1 relative h-full">
                    {isOccupied && (
                      <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-gray-100/70 dark:border-slate-700/30 pointer-events-none" />
                    )}
                    <span className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-500 font-bold pl-2 inline-block pointer-events-none transition-opacity">
                      + Agendar {hourLabel}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Línea roja de hora actual (si estamos viendo HOY) */}
            {selectedDate === today && nowMinutes >= startHour && nowMinutes <= endHour + 1 && (
              <div
                className="absolute left-11 right-0 z-20 pointer-events-none flex items-center"
                style={{ top: `${getYPositionForTime(nowMinutes)}px` }}
              >
                <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shadow" />
                <div className="flex-1 border-t-2 border-red-500" />
              </div>
            )}

            {/* Bloques gráficos de Cirugías */}
            <div className="absolute top-0 bottom-0 left-12 right-1 pointer-events-none">
              {positionedDaySurgeries.map(s => {
                const topPx = getYPositionForTime(s.start) + 1;
                const rawHeight = getYPositionForTime(s.end) - getYPositionForTime(s.start) - 3;
                const heightPx = Math.max(78, rawHeight);
                const widthPct = 100 / s.totalCols;
                const leftPct = s.colIndex * widthPct;
                const endTimeStr = formatHoursToTime(s.end);
                const resProf = s.resident ? getMemberProfile(s.resident, settingsMeta) : null;

                return (
                  <div
                    key={s.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveSurgeryDetail(s);
                    }}
                    style={{
                      top: `${topPx}px`,
                      height: `${heightPx}px`,
                      left: `calc(${leftPct}% + 2px)`,
                      width: `calc(${widthPct}% - 4px)`
                    }}
                    className={`absolute z-10 rounded-lg px-2 py-1.5 pointer-events-auto cursor-pointer overflow-hidden transition hover:brightness-95 active:scale-[0.99] flex flex-col justify-between border border-black/5 dark:border-white/10 ${getEventBlockStyle(s)}`}
                  >
                    {/* Parte superior: Hora + Sede + Paciente + Procedimiento */}
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-1 text-[10px] font-bold leading-none mb-0.5">
                        <span className="truncate">{s.time} - {endTimeStr} ({s.duration}h)</span>
                        <span className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/15 uppercase font-black text-[9px] flex-shrink-0">
                          {s.location || 'S/S'}
                        </span>
                      </div>
                      <div className="font-black text-xs sm:text-sm leading-tight truncate">
                        {applyPrivacy(s.patientName, privacyMode, 'name')}
                      </div>
                      <div className="text-[11px] font-bold opacity-90 leading-tight truncate">
                        {s.procedure}
                      </div>
                    </div>

                    {/* Parte inferior SIEMPRE visible: Médico Adscrito + Residente(s) */}
                    <div className="flex items-center justify-between gap-1 text-[10px] pt-1 mt-0.5 border-t border-black/10 dark:border-white/10 min-w-0">
                      <span className="font-semibold truncate">
                        👨‍⚕️ {applyPrivacy(s.doctor || 'S/T', privacyMode, 'name')}
                      </span>
                      <span className={`font-black px-1.5 py-0.5 rounded flex-shrink-0 inline-flex items-center gap-1 ${!s.resident ? 'bg-yellow-200/90 text-yellow-900' : resProf ? `${resProf.color.badge} border` : 'bg-black/10 dark:bg-white/15'}`}>
                        {resProf && <span className={`w-1.5 h-1.5 rounded-full ${resProf.color.dot}`}></span>}
                        <span>{s.resident || 'S/A'}{s.resident2 ? ` + ${s.resident2}` : ''}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          VISTA 2: LISTA CONTINUA DE TARJETAS
         ===================================================================== */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {listSurgeries.map(s => {
            const dateObj = new Date(s.date + 'T12:00:00');
            const dateStr = dateObj.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
            const showHeader = s.date !== lastDate;
            lastDate = s.date;
            const dur = Number(s.duration) || 1;
            const dayGuard = showHeader ? getGuardForDate(s.date, settingsMeta) : null;
            const res1Prof = s.resident ? getMemberProfile(s.resident, settingsMeta) : null;
            const res2Prof = s.resident2 ? getMemberProfile(s.resident2, settingsMeta) : null;

            return (
              <React.Fragment key={s.id}>
                {showHeader && (
                  <div className="mt-5 mb-1.5 pl-1 border-b border-gray-200 dark:border-slate-700 pb-1">
                    <h3 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase flex items-center justify-between">
                      <span>
                        {dateStr} {s.date === today && <span className="text-blue-600 dark:text-blue-400 ml-1">(HOY)</span>}
                      </span>
                      <button
                        onClick={() => handleSelectDateFromCalendar(s.date)}
                        className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline normal-case"
                      >
                        Ver en agenda →
                      </button>
                    </h3>
                    {(dayGuard?.guardia || dayGuard?.posguardia) && (
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px]">
                        {dayGuard.guardia && (
                          <span className="font-bold text-orange-600 dark:text-orange-400">
                            🛡️ Guardia: {dayGuard.guardia}
                          </span>
                        )}
                        {dayGuard.posguardia && (
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">
                            💤 Posguardia: {dayGuard.posguardia}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className={`rounded-xl p-3 relative transition-all ${getCardStyle(s)}`}>
                  <div className={`flex justify-between text-xs font-bold mb-1 ${s.cancelled ? 'text-gray-400 line-through' : 'text-gray-600 dark:text-slate-300'}`}>
                    <span className="flex items-center gap-1"><Clock size={12}/> {s.time} hrs ({dur}h)</span>
                    <span className="bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded uppercase text-[10px]">{s.location}</span>
                  </div>
                  <h3 className={`font-black text-base sm:text-lg leading-tight ${s.cancelled ? 'text-gray-400 line-through' : 'text-slate-900 dark:text-white'}`}>
                    {applyPrivacy(s.patientName, privacyMode, 'name')}
                  </h3>
                  <p className={`font-bold text-xs sm:text-sm mb-2 ${s.cancelled ? 'text-gray-400 line-through' : 'text-blue-700 dark:text-blue-300'}`}>
                    {s.procedure}
                  </p>

                  <div className="flex items-center justify-between gap-2 mt-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Tx: {applyPrivacy(s.doctor, privacyMode, 'name')}</span>
                    <div className="flex gap-1.5 flex-wrap justify-end">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold inline-flex items-center gap-1 ${!s.resident ? 'bg-yellow-100 text-yellow-800' : `${res1Prof.color.badge} border`}`}>
                        {res1Prof && <span className={`w-1.5 h-1.5 rounded-full ${res1Prof.color.dot}`}></span>}
                        {s.resident || 'No Asignado'}
                      </span>
                      {s.resident2 && (
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold border inline-flex items-center gap-1 ${res2Prof.color.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${res2Prof.color.dot}`}></span>
                          {s.resident2}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-3 border-t border-gray-100 dark:border-white/10 pt-2">
                    {!s.cancelled && (
                      <button onClick={() => setTransferringSurgery(s)} className="text-blue-500 dark:text-blue-400 hover:text-blue-700 mr-auto flex items-center gap-1 text-xs font-bold" title="Hospitalizar Paciente">
                        <UserPlus size={17} /> <span>Hospitalizar</span>
                      </button>
                    )}
                    <button onClick={() => toggleComplete(s)} className="text-gray-400 hover:text-green-600 transition">{s.completed ? <CheckCircle className="text-green-600 dark:text-green-500" size={19} /> : <CheckCircle size={19} />}</button>
                    <button onClick={() => toggleCancel(s)} className="text-gray-400 hover:text-red-500 transition">{s.cancelled ? <XCircle className="text-red-500" size={19} /> : <XCircle size={19} />}</button>
                    <div className="w-px h-5 bg-gray-300 dark:bg-slate-600 mx-0.5"></div>
                    <button onClick={() => handleEdit(s)} className="text-blue-500 hover:text-blue-700"><Edit size={17} /></button>
                    <button onClick={() => handleDelete(s.id)} className="text-red-400 hover:text-red-600"><Trash2 size={17} /></button>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
          {listSurgeries.length === 0 && (
            <div className="text-center py-10 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-gray-300 dark:border-slate-700">
              <p className="text-gray-500 dark:text-slate-400 text-xs">
                {filterRes ? `No hay cirugías programadas para ${filterRes === matchedUserResident ? 'ti' : filterRes}.` : "No hay cirugías que coincidan con los filtros."}
              </p>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="mt-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
                  Restablecer filtros (Ver todas)
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          MINI CALENDARIO INFERIOR (MES EN CURSO Y EL SIGUIENTE + HISTORIAL)
         ===================================================================== */}
      <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-blue-100 dark:border-slate-700 shadow-sm mt-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 dark:border-slate-700 pb-2">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <CalendarIcon size={14} className="text-blue-600 dark:text-blue-400" /> Calendario Quirúrgico
            </h3>
            <p className="text-[10px] text-gray-500 dark:text-slate-400">
              Toca cualquier día para ver su programación hora por hora
            </p>
          </div>

          {/* Controles para navegar meses en el mini-calendario */}
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
                setBaseCalMonth(new Date(now.getFullYear(), now.getMonth(), 1));
              }}
              className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200"
            >
              Mes Actual
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

        {/* Buscador directo por fecha y dropdown de fechas con cirugías */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-bold text-gray-500 dark:text-slate-400 whitespace-nowrap">Ir a fecha:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => e.target.value && handleSelectDateFromCalendar(e.target.value)}
              className="flex-1 p-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-xs bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
            />
          </div>

          <select
            value={datesWithSurgeries.includes(selectedDate) ? selectedDate : ''}
            onChange={e => e.target.value && handleSelectDateFromCalendar(e.target.value)}
            className="p-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-xs bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
          >
            <option value="">📅 Saltar a día con cirugías ({datesWithSurgeries.length})...</option>
            {datesWithSurgeries.map(dStr => {
              const info = calendarDotsMap[dStr];
              const dObj = new Date(dStr + 'T12:00:00');
              const label = dObj.toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
              return (
                <option key={dStr} value={dStr}>
                  {label} — ({info.total} cx)
                </option>
              );
            })}
          </select>
        </div>

        {/* Dos meses por default: Mes base y Mes siguiente */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <MiniMonthGrid
            monthDate={baseCalMonth}
            selectedDate={selectedDate}
            today={today}
            dotsMap={calendarDotsMap}
            onSelectDate={handleSelectDateFromCalendar}
          />
          <MiniMonthGrid
            monthDate={nextCalMonth}
            selectedDate={selectedDate}
            today={today}
            dotsMap={calendarDotsMap}
            onSelectDate={handleSelectDateFromCalendar}
          />
        </div>

        {/* Leyenda de puntos del calendario */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2 border-t border-gray-100 dark:border-slate-700 text-[10px] font-bold text-gray-500 dark:text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block"></span> Zambrano (HZH)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-slate-400 inline-block"></span> Instituto</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span> Otro Hospital</span>
        </div>
      </div>

      {/* Botón flotante para nueva cirugía */}
      <button
        onClick={() => {
          setEditingSurgery(null);
          setPrefillSlot({ date: selectedDate, time: '' });
          setShowModal(true);
        }}
        className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-xl hover:bg-blue-700 transition z-20"
      >
        <Plus size={28} />
      </button>

      {/* Modal de acciones rápidas al tocar un bloque en el calendario Hora x Hora */}
      {activeSurgeryDetail && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setActiveSurgeryDetail(null)}>
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl text-slate-900 dark:text-white space-y-3 animate-in slide-in-from-bottom"
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-slate-400">
                  <span>{activeSurgeryDetail.date} • {activeSurgeryDetail.time} hrs ({Number(activeSurgeryDetail.duration) || 1}h)</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 uppercase">
                    {activeSurgeryDetail.location}
                  </span>
                </div>
                <h3 className="text-lg font-black mt-1">{applyPrivacy(activeSurgeryDetail.patientName, privacyMode, 'name')}</h3>
                <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{activeSurgeryDetail.procedure}</p>
              </div>
              <button onClick={() => setActiveSurgeryDetail(null)} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="text-xs bg-slate-50 dark:bg-slate-700/60 p-2.5 rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <span><strong>Tratante:</strong> {applyPrivacy(activeSurgeryDetail.doctor, privacyMode, 'name')}</span>
                <span>
                  <strong>Residente:</strong> {activeSurgeryDetail.resident || 'Por Asignar'}
                  {activeSurgeryDetail.resident2 ? ` + ${activeSurgeryDetail.resident2}` : ''}
                </span>
              </div>

              {/* Asignación rápida de residentes */}
              {canManageSchedule && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-600">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-300 block mb-0.5">Residente Principal:</label>
                    <select
                      value={activeSurgeryDetail.resident || ''}
                      onChange={async (e) => {
                        const val = e.target.value;
                        await updateDoc(doc(db, "surgeries", activeSurgeryDetail.id), { resident: val });
                        setActiveSurgeryDetail(prev => prev ? { ...prev, resident: val } : null);
                      }}
                      className="w-full p-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                    >
                      <option value="">— Por Asignar —</option>
                      {hzhResidents.length > 0 ? (
                        <>
                          <optgroup label="📍 Rotando en HZH">
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
                        orderedResidents.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-300 block mb-0.5">2do Residente:</label>
                    <select
                      value={activeSurgeryDetail.resident2 || ''}
                      onChange={async (e) => {
                        const val = e.target.value;
                        await updateDoc(doc(db, "surgeries", activeSurgeryDetail.id), { resident2: val });
                        setActiveSurgeryDetail(prev => prev ? { ...prev, resident2: val } : null);
                      }}
                      className="w-full p-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                    >
                      <option value="">— Ninguno —</option>
                      {hzhResidents.length > 0 ? (
                        <>
                          <optgroup label="📍 Rotando en HZH">
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
                        orderedResidents.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))
                      )}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              {!activeSurgeryDetail.cancelled && (
                <button
                  onClick={() => {
                    const s = activeSurgeryDetail;
                    setActiveSurgeryDetail(null);
                    setTransferringSurgery(s);
                  }}
                  className="col-span-2 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <UserPlus size={16} /> Hospitalizar y Pasar al Censo
                </button>
              )}
              <button
                onClick={async () => {
                  await toggleComplete(activeSurgeryDetail);
                  setActiveSurgeryDetail(null);
                }}
                className="py-2.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1"
              >
                <CheckCircle size={15} /> {activeSurgeryDetail.completed ? 'Quitar Completada' : 'Marcar Completada'}
              </button>
              <button
                onClick={async () => {
                  await toggleCancel(activeSurgeryDetail);
                  setActiveSurgeryDetail(null);
                }}
                className="py-2.5 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1"
              >
                <XCircle size={15} /> {activeSurgeryDetail.cancelled ? 'Reactivar' : 'Cancelar Cx'}
              </button>
              <button
                onClick={() => handleEdit(activeSurgeryDetail)}
                className="py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1"
              >
                <Edit size={15} /> Editar
              </button>
              <button
                onClick={() => handleDelete(activeSurgeryDetail.id)}
                className="py-2.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 rounded-xl font-bold text-xs flex items-center justify-center gap-1"
              >
                <Trash2 size={15} /> Borrar
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <SurgeryModal
          onClose={() => { setShowModal(false); setPrefillSlot(null); }}
          initialData={editingSurgery}
          prefillSlot={prefillSlot}
          dynamicResidents={dynamicResidents}
          dynamicDoctors={dynamicDoctors}
          dynamicLocations={dynamicLocations}
          settingsMeta={settingsMeta}
          canManageSchedule={canManageSchedule}
        />
      )}

      {transferringSurgery && (
        <TransferToCensusModal
          surgery={transferringSurgery}
          onClose={() => setTransferringSurgery(null)}
          dynamicResidents={dynamicResidents}
          dynamicDoctors={dynamicDoctors}
          dynamicLocations={dynamicLocations}
          settingsMeta={settingsMeta}
        />
      )}
    </div>
  );
}

// Componente de cuadrícula mensual compacta con puntos de colores por sede
function MiniMonthGrid({ monthDate, selectedDate, today, dotsMap, onSelectDate }) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const monthName = monthDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Dom
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
              {/* Puntos de colores bajo el día: Naranja (HZH), Gris (Instituto), Azul (Otro) */}
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

function SurgeryModal({ onClose, initialData, prefillSlot, dynamicResidents, dynamicDoctors, dynamicLocations, settingsMeta = {}, canManageSchedule = false }) {
  const [form, setForm] = useState(
    initialData
      ? { ...initialData, duration: Number(initialData.duration) || 1 }
      : {
          date: prefillSlot?.date || getLocalISODate(),
          time: prefillSlot?.time || '',
          duration: 1,
          patientName: '',
          procedure: '',
          location: '',
          doctor: '',
          resident: '',
          resident2: '',
          completed: false,
          cancelled: false
        }
  );
  const [isOtherDoc, setIsOtherDoc] = useState(false);
  const [isOtherRes, setIsOtherRes] = useState(false);

  const resOptions = [...(dynamicResidents || [])];
  if (initialData && form.resident && !resOptions.includes(form.resident) && form.resident !== 'Otro') resOptions.push(form.resident);
  if (initialData && form.resident2 && !resOptions.includes(form.resident2)) resOptions.push(form.resident2);
  const { allOrdered: orderedRes, hzhResidents, otherResidents } = getOrderedResidents(resOptions, settingsMeta);

  const docOptions = [...(dynamicDoctors || [])];
  if (initialData && form.doctor && !docOptions.includes(form.doctor) && form.doctor !== 'Otro') docOptions.push(form.doctor);
  docOptions.sort();

  const locOptions = [...(dynamicLocations || [])];
  if (initialData && form.location && !locOptions.includes(form.location) && form.location !== 'Otro') locOptions.push(form.location);
  locOptions.sort();

  useEffect(() => {
    if (initialData) {
      if (!initialData.resident2) setForm(prev => ({ ...prev, resident2: '' }));
      if (initialData.doctor && !dynamicDoctors?.includes(initialData.doctor)) setIsOtherDoc(true);
      if (initialData.resident && !dynamicResidents?.includes(initialData.resident)) setIsOtherRes(true);
    }
  }, [initialData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, duration: Number(form.duration) || 1 };
      if (!canManageSchedule) {
        payload.resident = initialData ? (initialData.resident || '') : '';
        payload.resident2 = initialData ? (initialData.resident2 || '') : '';
      }
      if (initialData) {
        await updateDoc(doc(db, "surgeries", initialData.id), payload);
      } else {
        await addDoc(collection(db, "surgeries"), payload);
      }
      onClose();
    } catch (err) {
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
        <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-white">{initialData ? 'Editar Cirugía' : 'Agendar Cirugía'}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-bold text-gray-500">Fecha</label>
              <input type="date" required className={inputClass} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500">Hora Inicio</label>
              <input type="time" required className={inputClass} value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500">Duración</label>
              <select className={inputClass} value={form.duration || 1} onChange={e => setForm({ ...form, duration: parseFloat(e.target.value) })}>
                <option value={0.5}>30 min</option>
                <option value={1}>1 hora</option>
                <option value={1.5}>1.5 hrs</option>
                <option value={2}>2 hrs</option>
                <option value={2.5}>2.5 hrs</option>
                <option value={3}>3 hrs</option>
                <option value={4}>4 hrs</option>
                <option value={5}>5 hrs</option>
                <option value={6}>6 hrs</option>
              </select>
            </div>
          </div>

          <select required className={inputClass} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}>
            <option value="">Sede...</option>
            {locOptions.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <input required placeholder="Paciente" className={inputClass} value={form.patientName} onChange={e => setForm({ ...form, patientName: e.target.value })} />
          <input required placeholder="Procedimiento" className={inputClass} value={form.procedure} onChange={e => setForm({ ...form, procedure: e.target.value })} />

          <div className="space-y-1">
            <select required={!isOtherDoc} className={`text-xs ${inputClass}`} value={isOtherDoc ? 'Otro' : form.doctor} onChange={e => { if (e.target.value === 'Otro') { setIsOtherDoc(true); setForm({ ...form, doctor: '' }); } else { setIsOtherDoc(false); setForm({ ...form, doctor: e.target.value }); } }}>
              <option value="">Tratante</option>
              {docOptions.map(d => <option key={d} value={d}>{d}</option>)}
              <option value="Otro">Otro / Agregar...</option>
            </select>
            {isOtherDoc && <input placeholder="Nombre Tratante" required className={`text-xs bg-blue-50 ${inputClass}`} value={form.doctor} onChange={e => setForm({ ...form, doctor: e.target.value })} />}
          </div>

          {canManageSchedule && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">Residente Principal</label>
                <select
                  className={`text-xs ${inputClass}`}
                  value={isOtherRes ? 'Otro' : form.resident}
                  onChange={e => { if (e.target.value === 'Otro') { setIsOtherRes(true); setForm({ ...form, resident: '' }); } else { setIsOtherRes(false); setForm({ ...form, resident: e.target.value }); } }}
                >
                  <option value="">No Asignado</option>
                  {renderResOptions()}
                  <option value="Otro">Otro / Agregar...</option>
                </select>
                {isOtherRes && <input placeholder="Nombre Residente" required className={`text-xs bg-blue-50 ${inputClass}`} value={form.resident} onChange={e => setForm({ ...form, resident: e.target.value })} />}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">2do Residente (Opcional)</label>
                <select
                  className={`text-xs ${inputClass}`}
                  value={form.resident2 || ''}
                  onChange={e => setForm({ ...form, resident2: e.target.value })}
                >
                  <option value="">Ninguno</option>
                  {renderResOptions()}
                </select>
              </div>
            </>
          )}

          <div className="flex gap-2 mt-4 pt-2 border-t dark:border-slate-700">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 dark:bg-slate-600 text-gray-800 dark:text-white py-3 rounded font-bold">Cancelar</button>
            <button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded font-bold shadow-lg">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TransferToCensusModal({ onClose, surgery, dynamicResidents, dynamicDoctors, dynamicLocations, settingsMeta = {} }) {
  const [form, setForm] = useState({
    name: surgery.patientName || '', bed: '', hospital: surgery.location || 'HZH', type: 'HO', doctor: surgery.doctor || '', resident: surgery.resident || '', admissionDate: getLocalISODate(), dob: '', diagnosis: `Post-op ${surgery.procedure || ''}`,
    antecedents: { dm: false, has: false, cancer: false, other: '' }, allergies: ''
  });
  const [isOtherDoc, setIsOtherDoc] = useState(false);
  const [isOtherRes, setIsOtherRes] = useState(false);
  const [isOtherHosp, setIsOtherHosp] = useState(false);

  const resOptions = [...(dynamicResidents || [])];
  if (form.resident && !resOptions.includes(form.resident) && form.resident !== 'Otro') resOptions.push(form.resident);
  const { allOrdered: orderedRes, hzhResidents, otherResidents } = getOrderedResidents(resOptions, settingsMeta);

  const docOptions = [...(dynamicDoctors || [])];
  if (form.doctor && !docOptions.includes(form.doctor) && form.doctor !== 'Otro') docOptions.push(form.doctor);
  docOptions.sort();

  const hospOptions = [...(dynamicLocations || [])];
  if (form.hospital && !hospOptions.includes(form.hospital) && form.hospital !== 'Otro') hospOptions.push(form.hospital);
  hospOptions.sort();

  useEffect(() => {
    if (form.doctor && !dynamicDoctors?.includes(form.doctor)) setIsOtherDoc(true);
    if (form.resident && !dynamicResidents?.includes(form.resident)) setIsOtherRes(true);
    if (form.hospital && !dynamicLocations?.includes(form.hospital)) setIsOtherHosp(true);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "patients"), { ...form, status: 'pending', hasPending: false, discharged: false, notes: [], checklist: [] });
      alert(`¡${form.name} ha sido ingresado al censo!`);
      onClose();
    } catch (err) { alert("Error: " + err.message); }
  };

  const inputClass = "w-full p-2 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white bg-white dark:bg-slate-700";

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-1 text-slate-800 dark:text-white">Hospitalizar Paciente</h2>
        <p className="text-xs text-blue-600 dark:text-blue-400 mb-4 font-bold bg-blue-50 dark:bg-blue-900/30 p-2 rounded">Datos copiados desde Quirófano</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-2">
            <select className={`w-1/3 text-xs ${inputClass}`} value={isOtherHosp ? 'Otro' : (form.hospital || '')}
              onChange={e => { if (e.target.value === 'Otro') { setIsOtherHosp(true); setForm({ ...form, hospital: '' }); } else { setIsOtherHosp(false); setForm({ ...form, hospital: e.target.value }); } }}>
              <option value="">Hospital...</option>{hospOptions.map(l => <option key={l} value={l}>{l}</option>)}<option value="Otro">Otro...</option>
            </select>
            <input required placeholder="Cama" className={`w-1/3 ${inputClass}`} value={form.bed} onChange={e => setForm({ ...form, bed: e.target.value })} />
            <select className={`w-1/3 text-xs ${inputClass}`} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option>HO</option><option>IC</option><option>SND</option><option>NOVER</option></select>
          </div>
          {isOtherHosp && <input placeholder="Escribe el nombre del Hospital" className={`text-xs bg-blue-50 ${inputClass}`} value={form.hospital} onChange={e => setForm({ ...form, hospital: e.target.value })} required />}

          <input required placeholder="Nombre Completo" className={inputClass} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />

          <div className="bg-slate-50 dark:bg-slate-700/50 p-2 rounded border dark:border-slate-600">
            <p className="text-xs font-bold text-gray-500 dark:text-gray-300 mb-1">Antecedentes</p>
            <div className="flex gap-2 mb-2 text-sm text-slate-700 dark:text-slate-200">
              <label className="flex items-center gap-1"><input type="checkbox" checked={form.antecedents?.dm || false} onChange={e => setForm({ ...form, antecedents: { ...form.antecedents, dm: e.target.checked } })} /> DM</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={form.antecedents?.has || false} onChange={e => setForm({ ...form, antecedents: { ...form.antecedents, has: e.target.checked } })} /> HAS</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={form.antecedents?.cancer || false} onChange={e => setForm({ ...form, antecedents: { ...form.antecedents, cancer: e.target.checked } })} /> Onco</label>
            </div>
            <input placeholder="Otros antecedentes..." className={`text-xs mb-2 ${inputClass}`} value={form.antecedents?.other || ''} onChange={e => setForm({ ...form, antecedents: { ...form.antecedents, other: e.target.value } })} />
            <input placeholder="Alergias" className={`text-xs border-red-200 dark:border-red-900/50 ${inputClass}`} value={form.allergies} onChange={e => setForm({ ...form, allergies: e.target.value })} />
          </div>

          <div className="space-y-1">
            <select required={!isOtherDoc} className={`text-xs ${inputClass}`} value={isOtherDoc ? 'Otro' : form.doctor}
              onChange={e => { if (e.target.value === 'Otro') { setIsOtherDoc(true); setForm({ ...form, doctor: '' }); } else { setIsOtherDoc(false); setForm({ ...form, doctor: e.target.value }); } }}>
              <option value="">Tratante...</option>{docOptions.map(d => <option key={d} value={d}>{d}</option>)}<option value="Otro">Otro / Agregar Nuevo</option>
            </select>
            {isOtherDoc && <input placeholder="Escribe nombre del Tratante" className={`text-xs bg-blue-50 ${inputClass}`} value={form.doctor} onChange={e => setForm({ ...form, doctor: e.target.value })} required />}
          </div>
          <div className="space-y-1">
            <select required={!isOtherRes} className={`text-xs ${inputClass}`} value={isOtherRes ? 'Otro' : form.resident}
              onChange={e => { if (e.target.value === 'Otro') { setIsOtherRes(true); setForm({ ...form, resident: '' }); } else { setIsOtherRes(false); setForm({ ...form, resident: e.target.value }); } }}>
              <option value="">Residente...</option>
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
              <option value="Otro">Otro / Agregar Nuevo</option>
            </select>
            {isOtherRes && <input placeholder="Escribe nombre del Residente" className={`text-xs bg-blue-50 ${inputClass}`} value={form.resident} onChange={e => setForm({ ...form, resident: e.target.value })} required />}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col"><label className="text-[10px] text-gray-500 dark:text-gray-400">Ingreso</label><input type="date" required className={`text-xs ${inputClass}`} value={form.admissionDate} onChange={e => setForm({ ...form, admissionDate: e.target.value })} /></div>
            <div className="flex flex-col"><label className="text-[10px] text-gray-500 dark:text-gray-400">Nacimiento</label><input type="date" className={`text-xs ${inputClass}`} value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} /></div>
          </div>
          <input required placeholder="Diagnóstico" className={inputClass} value={form.diagnosis} onChange={e => setForm({ ...form, diagnosis: e.target.value })} />
          <div className="flex gap-2 mt-4 pt-2 border-t dark:border-slate-700"><button type="button" onClick={onClose} className="flex-1 bg-gray-100 dark:bg-slate-600 text-gray-800 dark:text-white py-3 rounded font-bold">Cancelar</button><button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded font-bold shadow-lg">Completar Ingreso</button></div>
        </form>
      </div>
    </div>
  );
}
