import React, { useState, useMemo } from 'react';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { X, ArrowUp, ArrowDown, Sparkles, Calendar, Check, Plus, Trash2, Palmtree, Lock, RotateCcw } from 'lucide-react';
import {
  getMemberProfile,
  getOrderedResidents,
  getLocalISODate,
  canUserManageSchedule,
  buildGuardCycleABCD,
  getMonthWeekends,
  getFreeWeekendRulesForDate,
  getMinGuardCalendarDate,
  normalizeText
} from '../utils';

export default function RotationScheduleModal({ user, onClose, dynamicResidents = [], settingsMeta = {} }) {
  const today = getLocalISODate();
  const currentMonthStr = today.slice(0, 7); // Ej: '2026-10'
  const minOctoberDate = getMinGuardCalendarDate(); // Ej: '2026-10-01'
  const minOctoberMonth = minOctoberDate.slice(0, 7); // Ej: '2026-10'

  const currentRot = settingsMeta?.hzhRotation || {};
  const { allowed: canManage } = useMemo(
    () => canUserManageSchedule(user, settingsMeta),
    [user, settingsMeta]
  );

  // Siempre abrir por defecto en el mes en curso
  const [monthStr, setMonthStr] = useState(currentMonthStr);

  // Configuración independiente por cada mes (months[YYYY-MM] = { residents, cycleOrder, freeWeekends })
  // para que cambiar los integrantes de un mes NUNCA mueva ni afecte otros meses
  const [monthsData, setMonthsData] = useState(() => {
    const existingMonths = { ...(currentRot.months || {}) };
    // Si aún no existía entrada para el mes en curso pero había datos en la raíz, migrarlos al mes en curso
    if (!existingMonths[currentMonthStr] && (currentRot.residents?.length || currentRot.cycleOrder?.length || currentRot.freeWeekends?.length)) {
      existingMonths[currentMonthStr] = {
        residents: currentRot.residents || [],
        cycleOrder: buildGuardCycleABCD(currentRot.residents || [], settingsMeta, currentRot.cycleOrder || []),
        freeWeekends: (currentRot.freeWeekends || []).filter(r => !r?.startDate || r.startDate >= minOctoberDate)
      };
    }
    return existingMonths;
  });

  // Guardias día por día: conservar intactas todas las de octubre en adelante y limpiar cualquier fecha previa a octubre
  const [schedule, setSchedule] = useState(() => {
    const raw = currentRot.schedule || {};
    const cleaned = {};
    Object.keys(raw).forEach(dStr => {
      if (dStr >= minOctoberDate && raw[dStr]?.guardia) {
        cleaned[dStr] = { guardia: raw[dStr].guardia };
      }
    });
    return cleaned;
  });

  const [activeSection, setActiveSection] = useState('calendar'); // 'calendar' | 'guards' | 'rotation'
  const [selectedCalDate, setSelectedCalDate] = useState(null);
  const [saving, setSaving] = useState(false);

  // Estado para agregar nueva regla de Fin Libre en el mes activo
  const [freeRes, setFreeRes] = useState('');
  const [freeWeekendId, setFreeWeekendId] = useState('');
  const [freeSpanMode, setFreeSpanMode] = useState('vie-dom'); // 'vie-dom' | 'sab-dom'
  const [freeReplacement, setFreeReplacement] = useState('Nadie');

  // Reglas de bloqueo por mes:
  // - Meses previos a octubre (< minOctoberMonth): siempre en blanco y bloqueados
  // - Meses pasados (< currentMonthStr): guardados y bloqueados (no se pueden editar)
  const isBeforeOctober = monthStr < minOctoberMonth;
  const isPastMonth = monthStr < currentMonthStr || isBeforeOctober;
  const isCurrentMonth = monthStr === currentMonthStr;
  const isFutureMonth = monthStr > currentMonthStr;
  const canEditMonth = canManage && !isPastMonth;

  // Datos exclusivos del mes seleccionado (si es previo a octubre, siempre vacío)
  const activeMonthObj = useMemo(() => {
    if (isBeforeOctober) {
      return { residents: [], cycleOrder: [], freeWeekends: [] };
    }
    return monthsData[monthStr] || { residents: [], cycleOrder: [], freeWeekends: [] };
  }, [monthsData, monthStr, isBeforeOctober]);

  const selectedHzh = activeMonthObj.residents || [];
  const cycleOrder = activeMonthObj.cycleOrder || [];
  const freeWeekends = activeMonthObj.freeWeekends || [];

  const updateActiveMonthData = (updater) => {
    if (!canEditMonth) return;
    setMonthsData(prev => {
      const current = prev[monthStr] || { residents: [], cycleOrder: [], freeWeekends: [] };
      const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
      return {
        ...prev,
        [monthStr]: next
      };
    });
  };

  const { allOrdered } = useMemo(
    () => getOrderedResidents(dynamicResidents, settingsMeta),
    [dynamicResidents, settingsMeta]
  );

  const monthWeekends = useMemo(() => getMonthWeekends(monthStr), [monthStr]);

  const toggleHzhResident = (resName) => {
    if (!canEditMonth) return;
    updateActiveMonthData(cur => {
      const prevRes = cur.residents || [];
      const exists = prevRes.includes(resName);
      const nextRes = exists ? prevRes.filter(r => r !== resName) : [...prevRes, resName];
      const nextCycle = buildGuardCycleABCD(nextRes, settingsMeta, cur.cycleOrder || []);
      return {
        ...cur,
        residents: nextRes,
        cycleOrder: nextCycle
      };
    });
  };

  const moveInCycle = (idx, dir) => {
    if (!canEditMonth) return;
    const base = effectiveCycle;
    const target = idx + dir;
    if (target < 0 || target >= base.length) return;
    const copy = [...base];
    const temp = copy[idx];
    copy[idx] = copy[target];
    copy[target] = temp;
    updateActiveMonthData(cur => ({ ...cur, cycleOrder: copy }));
  };

  const updateCycleSlot = (idx, value) => {
    if (!canEditMonth) return;
    const copy = [...effectiveCycle];
    copy[idx] = value || 'Nadie';
    updateActiveMonthData(cur => ({ ...cur, cycleOrder: copy }));
  };

  const addCycleSlot = () => {
    if (!canEditMonth) return;
    const base = effectiveCycle.length >= 4 ? effectiveCycle : ['Nadie', 'Nadie', 'Nadie', 'Nadie'];
    updateActiveMonthData(cur => ({ ...cur, cycleOrder: [...base, 'Nadie'] }));
  };

  const removeCycleSlot = (idx) => {
    if (!canEditMonth) return;
    if (effectiveCycle.length <= 4) return;
    updateActiveMonthData(cur => ({
      ...cur,
      cycleOrder: effectiveCycle.filter((_, i) => i !== idx)
    }));
  };

  // Agregar una regla de Fin Libre para que la persona seleccionada no tenga guardias ese fin de semana
  const handleAddFreeWeekendRule = () => {
    if (!canEditMonth) return;
    if (!freeRes) return alert('Selecciona el residente que tendrá el Fin Libre.');
    const wk = monthWeekends.find(w => w.id === freeWeekendId) || monthWeekends[0];
    if (!wk) return alert('Selecciona el fin de semana.');

    const startDate = freeSpanMode === 'vie-dom' ? wk.friStr : wk.satStr;
    const endDate = wk.sunStr;
    const label = freeSpanMode === 'vie-dom' ? wk.labelVieDom : wk.labelSabDom;

    const newRule = {
      id: `${freeRes}-${startDate}-${Date.now()}`,
      resident: freeRes,
      startDate,
      endDate,
      spanMode: freeSpanMode,
      replacement: freeReplacement || 'Nadie',
      label
    };

    updateActiveMonthData(cur => ({
      ...cur,
      freeWeekends: [...(cur.freeWeekends || []), newRule]
    }));

    // Si en el schedule de este mes ya estaba asignado este residente en esos días, reemplazarlo
    setSchedule(prev => {
      const nextSched = { ...prev };
      Object.keys(nextSched).forEach(dStr => {
        if (dStr.startsWith(monthStr) && dStr >= startDate && dStr <= endDate) {
          if (normalizeText(nextSched[dStr]?.guardia) === normalizeText(freeRes)) {
            nextSched[dStr] = { guardia: freeReplacement || 'Nadie' };
          }
        }
      });
      return nextSched;
    });

    setFreeRes('');
  };

  const handleRemoveFreeWeekendRule = (ruleId) => {
    if (!canEditMonth) return;
    updateActiveMonthData(cur => ({
      ...cur,
      freeWeekends: (cur.freeWeekends || []).filter(r => r.id !== ruleId)
    }));
  };

  // Días del mes seleccionado para vista calendario
  const daysInMonth = useMemo(() => {
    const [y, m] = monthStr.split('-').map(Number);
    if (!y || !m) return [];
    const totalDays = new Date(y, m, 0).getDate();
    const list = [];
    for (let d = 1; d <= totalDays; d++) {
      const dStr = `${monthStr}-${String(d).padStart(2, '0')}`;
      const dateObj = new Date(dStr + 'T12:00:00');
      const weekday = dateObj.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '');
      list.push({ dateStr: dStr, dayNum: d, weekday, dow: dateObj.getDay() });
    }
    return list;
  }, [monthStr]);

  // Celdas para la cuadrícula visual del Calendario de Guardias (Dom - Sáb)
  const calendarCells = useMemo(() => {
    if (daysInMonth.length === 0) return [];
    const firstDow = daysInMonth[0].dow; // 0 = Dom
    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    daysInMonth.forEach(d => cells.push(d));
    return cells;
  }, [daysInMonth]);

  const effectiveCycle = useMemo(() => {
    if (cycleOrder.length === 0) return [];
    if (cycleOrder.length < 4) {
      return [...cycleOrder, ...Array(4 - cycleOrder.length).fill('Nadie')];
    }
    return cycleOrder;
  }, [cycleOrder]);

  // Verifica si el mes seleccionado ya tiene guardias asignadas en schedule
  const hasAssignedGuardsInMonth = useMemo(() => {
    if (isBeforeOctober) return false;
    return daysInMonth.some(d => Boolean(schedule[d.dateStr]?.guardia));
  }, [daysInMonth, schedule, isBeforeOctober]);

  // Calcula la guardia de una fecha leyendo ÚNICAMENTE lo guardado/asignado en schedule
  // (Sin autoproyección automática a otros meses; meses previos a octubre siempre en blanco)
  const getGuardForDay = (dateStr) => {
    if (!dateStr || dateStr < minOctoberDate) return '';
    const dMonth = dateStr.slice(0, 7);
    const rulesForThatMonth = monthsData[dMonth]?.freeWeekends || (dMonth === currentMonthStr ? freeWeekends : []);
    const activeRules = getFreeWeekendRulesForDate(dateStr, rulesForThatMonth);
    const freeNormSet = new Set(activeRules.map(r => normalizeText(r.resident)));

    const candidate = schedule[dateStr]?.guardia || '';
    if (!candidate) return '';

    // Si la persona seleccionada tiene Fin Libre en esta fecha, no hace guardia
    if (candidate !== 'Nadie' && freeNormSet.has(normalizeText(candidate))) {
      const matchingRule = activeRules.find(r => normalizeText(r.resident) === normalizeText(candidate));
      return matchingRule?.replacement || 'Nadie';
    }

    return candidate;
  };

  // Calcula automáticamente la posguardia como quien tuvo guardia el día anterior
  const getAutoPosguardiaForDay = (dateStr) => {
    if (!dateStr || dateStr < minOctoberDate) return '';
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    const offset = d.getTimezoneOffset() * 60000;
    const prevDateStr = new Date(d - offset).toISOString().slice(0, 10);
    return getGuardForDay(prevDateStr);
  };

  // Autollenar ÚNICAMENTE el mes seleccionado según su propio ciclo ABCD y respetando sus reglas de Fin Libre
  const autoFillMonthGuards = () => {
    if (!canEditMonth) return;
    if (effectiveCycle.length === 0 || effectiveCycle.every(x => x === 'Nadie')) {
      alert('Primero selecciona a los residentes del ciclo ABCD para este mes.');
      return;
    }
    if (hasAssignedGuardsInMonth) {
      const ok = window.confirm(
        `El mes ${monthStr} ya tiene guardias asignadas (por ejemplo, llenadas a mano). ¿Seguro que deseas reemplazarlas con el autollenado ABCD?`
      );
      if (!ok) return;
    }

    const cycleToUse = effectiveCycle.length >= 4 ? effectiveCycle : ['Nadie', 'Nadie', 'Nadie', 'Nadie'];
    const nextSchedule = { ...schedule };
    const startObj = new Date(`${monthStr}-01T12:00:00`);

    daysInMonth.forEach((day) => {
      const curObj = new Date(day.dateStr + 'T12:00:00');
      const diff = Math.round((curObj - startObj) / (1000 * 60 * 60 * 24));
      const cycleIdx = ((diff % cycleToUse.length) + cycleToUse.length) % cycleToUse.length;
      let guardiaRes = cycleToUse[cycleIdx] || 'Nadie';

      const activeRules = getFreeWeekendRulesForDate(day.dateStr, freeWeekends);
      const matchingRule = activeRules.find(r => normalizeText(r.resident) === normalizeText(guardiaRes));
      if (matchingRule) {
        guardiaRes = matchingRule.replacement || 'Nadie';
      }

      nextSchedule[day.dateStr] = {
        guardia: guardiaRes
      };
    });

    setSchedule(nextSchedule);
  };

  // Dejar en blanco todas las guardias del mes seleccionado (solo disponible en mes actual o futuros)
  const clearMonthGuards = () => {
    if (!canEditMonth) return;
    if (!window.confirm(`¿Dejar en blanco todas las guardias de ${monthStr}?`)) return;
    setSchedule(prev => {
      const next = { ...prev };
      daysInMonth.forEach(d => {
        delete next[d.dateStr];
      });
      return next;
    });
    setSelectedCalDate(null);
  };

  const setDayGuard = (dateStr, value) => {
    if (!canEditMonth) return;
    if (dateStr < minOctoberDate || dateStr.slice(0, 7) < currentMonthStr) return;

    if (value && value !== 'Nadie') {
      const activeRules = getFreeWeekendRulesForDate(dateStr, freeWeekends);
      const hasFreeRule = activeRules.some(r => normalizeText(r.resident) === normalizeText(value));
      if (hasFreeRule) {
        alert(`${value} tiene regla de Fin Libre activa en esta fecha (${dateStr}).`);
        return;
      }
    }
    setSchedule(prev => {
      const next = { ...prev };
      if (!value) {
        delete next[dateStr];
      } else {
        next[dateStr] = { guardia: value };
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!canManage) return;
    setSaving(true);
    try {
      // Asegurar que ninguna fecha previa a octubre se guarde en schedule
      const cleanSchedule = {};
      Object.keys(schedule).forEach(dStr => {
        if (dStr >= minOctoberDate && schedule[dStr]?.guardia) {
          cleanSchedule[dStr] = { guardia: schedule[dStr].guardia };
        }
      });

      // Mantener sincronizados los campos raíz con los del mes en curso para los dropdowns activos de la app
      const curMonthCfg = monthsData[currentMonthStr] || {
        residents: currentRot.residents || [],
        cycleOrder: currentRot.cycleOrder || [],
        freeWeekends: currentRot.freeWeekends || []
      };

      const payload = {
        hzhRotation: {
          month: currentMonthStr,
          residents: curMonthCfg.residents || [],
          cycleOrder: curMonthCfg.cycleOrder || [],
          cycleStartDate: `${currentMonthStr}-01`,
          schedule: cleanSchedule,
          freeWeekends: curMonthCfg.freeWeekends || [],
          months: monthsData,
          updatedAt: new Date().toISOString()
        }
      };
      await setDoc(doc(db, 'metadata', 'settings'), payload, { merge: true });
      onClose();
    } catch (err) {
      alert("Error guardando rotación: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Cabecera */}
        <div className="bg-slate-900 text-white p-3.5 flex justify-between items-center">
          <div>
            <h3 className="font-black text-sm sm:text-base flex items-center gap-1.5">
              <Calendar size={16} className="text-orange-400" />
              Calendario de Guardias y Rotación HZH
            </h3>
            <p className="text-[11px] text-slate-400">
              Guardias por mes (meses pasados guardados y bloqueados; meses futuros en blanco hasta generarlos)
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X size={18} />
          </button>
        </div>

        {/* Selector de mes y pestañas */}
        <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 border-b border-gray-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Calendar size={14} className="text-orange-500" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Mes:</span>
            <input
              type="month"
              value={monthStr}
              onChange={e => {
                setMonthStr(e.target.value);
                setSelectedCalDate(null);
              }}
              className="px-2 py-1 border border-gray-300 dark:border-slate-600 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
            {isPastMonth && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-black">
                <Lock size={11} />
                {isBeforeOctober ? 'Previo a Oct (En blanco)' : 'Mes pasado (Solo lectura)'}
              </span>
            )}
            {isCurrentMonth && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-black">
                Mes en curso
              </span>
            )}
            {isFutureMonth && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-black">
                {hasAssignedGuardsInMonth ? 'Mes futuro (Configurado)' : 'Mes futuro (En blanco)'}
              </span>
            )}
          </div>

          <div className="flex bg-gray-200 dark:bg-slate-700 p-0.5 rounded-lg text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setActiveSection('calendar')}
              className={`px-2.5 py-1 rounded-md transition ${activeSection === 'calendar' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-600 dark:text-slate-300'}`}
            >
              📅 Calendario
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('guards')}
              className={`px-2.5 py-1 rounded-md transition ${activeSection === 'guards' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-600 dark:text-slate-300'}`}
            >
              🔄 Rol ABCD / Fin Libre
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('rotation')}
              className={`px-2.5 py-1 rounded-md transition ${activeSection === 'rotation' ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-sm' : 'text-gray-600 dark:text-slate-300'}`}
            >
              📍 HZH ({selectedHzh.length})
            </button>
          </div>
        </div>

        {/* Contenido scrolleable */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-3">
          {/* =================================================================
              SECCIÓN 1: CALENDARIO VISUAL DE GUARDIAS (POP-UP PRINCIPAL)
             ================================================================= */}
          {activeSection === 'calendar' && (
            <div className="space-y-3">
              {/* Leyenda superior */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40 px-2.5 py-1.5 rounded-lg border border-gray-100 dark:border-slate-700">
                <div className="flex flex-wrap items-center gap-3">
                  <span>🛡️ Guardia del día</span>
                  <span>💤 Posguardia (Guardia de ayer)</span>
                  <span className="text-emerald-600 dark:text-emerald-400">🏖️ Fin Libre</span>
                </div>
                {canEditMonth ? (
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600 dark:text-blue-400">Toca un día para asignar guardia</span>
                    {hasAssignedGuardsInMonth && isFutureMonth && (
                      <button
                        type="button"
                        onClick={clearMonthGuards}
                        className="text-red-500 hover:text-red-700 underline flex items-center gap-0.5"
                        title="Dejar este mes futuro en blanco"
                      >
                        <RotateCcw size={10} /> Vaciar mes
                      </button>
                    )}
                  </div>
                ) : isPastMonth ? (
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Lock size={11} /> Mes cerrado (no editable)
                  </span>
                ) : null}
              </div>

              {/* Editor rápido al tocar un día del calendario (solo si el mes es editable) */}
              {canEditMonth && selectedCalDate && (() => {
                const currentG = getGuardForDay(selectedCalDate);
                const currentP = getAutoPosguardiaForDay(selectedCalDate);
                const activeFree = getFreeWeekendRulesForDate(selectedCalDate, freeWeekends);
                return (
                  <div className="bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 animate-in fade-in">
                    <div className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <span>📅 {selectedCalDate}</span>
                      {activeFree.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-black">
                          🏖️ Fin Libre: {activeFree.map(r => r.resident).join(', ')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-black uppercase text-orange-600 dark:text-orange-400">🛡️ Guardia:</label>
                      <select
                        value={currentG}
                        onChange={e => setDayGuard(selectedCalDate, e.target.value)}
                        className="p-1 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                      >
                        <option value="">— En blanco —</option>
                        <option value="Nadie">🚫 Nadie (Sin guardia)</option>
                        {selectedHzh.length > 0 && (
                          <optgroup label="📍 Rotando en HZH">
                            {selectedHzh.map(r => {
                              const isFree = activeFree.some(rule => normalizeText(rule.resident) === normalizeText(r));
                              return <option key={r} value={r} disabled={isFree}>{r}{isFree ? ' (🏖️ Fin Libre)' : ''}</option>;
                            })}
                          </optgroup>
                        )}
                        <optgroup label="Todos">
                          {allOrdered.map(r => {
                            const isFree = activeFree.some(rule => normalizeText(rule.resident) === normalizeText(r));
                            return <option key={r} value={r} disabled={isFree}>{r}{isFree ? ' (🏖️ Fin Libre)' : ''}</option>;
                          })}
                        </optgroup>
                      </select>
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                        💤 Pos: {currentP || '—'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedCalDate(null)}
                        className="text-gray-400 hover:text-gray-700 dark:hover:text-white p-0.5"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Cuadrícula Mensual 7 columnas (Dom - Sáb) */}
              <div>
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1">
                  <div>Dom</div>
                  <div>Lun</div>
                  <div>Mar</div>
                  <div>Mié</div>
                  <div>Jue</div>
                  <div>Vie</div>
                  <div>Sáb</div>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarCells.map((cell, idx) => {
                    if (!cell) {
                      return <div key={`empty-${idx}`} className="min-h-[68px] rounded-lg bg-slate-50/40 dark:bg-slate-900/20" />;
                    }
                    const dGuard = getGuardForDay(cell.dateStr);
                    const dPos = getAutoPosguardiaForDay(cell.dateStr);
                    const freeRules = isBeforeOctober ? [] : getFreeWeekendRulesForDate(cell.dateStr, freeWeekends);
                    const gProf = dGuard ? getMemberProfile(dGuard, settingsMeta) : null;
                    const pProf = dPos ? getMemberProfile(dPos, settingsMeta) : null;
                    const isToday = cell.dateStr === today;
                    const isSelected = cell.dateStr === selectedCalDate;
                    const isWeekend = cell.dow === 0 || cell.dow === 6;

                    return (
                      <div
                        key={cell.dateStr}
                        onClick={() => canEditMonth && setSelectedCalDate(cell.dateStr === selectedCalDate ? null : cell.dateStr)}
                        className={`min-h-[68px] p-1 rounded-lg border flex flex-col justify-between transition ${
                          canEditMonth ? 'cursor-pointer hover:border-blue-400' : ''
                        } ${
                          isSelected
                            ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50/40 dark:bg-blue-950/40'
                            : isToday
                            ? 'border-blue-400 bg-blue-50/30 dark:bg-blue-900/20'
                            : isWeekend
                            ? 'bg-slate-50/90 dark:bg-slate-800/80 border-gray-200 dark:border-slate-700'
                            : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700/80'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-black leading-none ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}>
                            {cell.dayNum}
                          </span>
                          {freeRules.length > 0 && (
                            <span
                              className="text-[9px] px-1 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-bold truncate max-w-[48px]"
                              title={`Fin Libre: ${freeRules.map(r => r.resident).join(', ')}`}
                            >
                              🏖️{freeRules[0].resident.slice(0, 4)}
                            </span>
                          )}
                        </div>

                        <div className="space-y-0.5 mt-1">
                          {/* Guardia */}
                          {dGuard && gProf ? (
                            <div
                              className={`px-1 py-0.5 rounded border text-[9px] font-black truncate flex items-center gap-1 ${gProf.colorObj.badge}`}
                              title={`Guardia: ${dGuard}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${gProf.colorObj.dot}`} />
                              <span className="truncate">{dGuard}</span>
                            </div>
                          ) : (
                            <div className="text-[9px] text-gray-300 dark:text-slate-600 font-semibold text-center">—</div>
                          )}

                          {/* Posguardia */}
                          {dPos && pProf && (
                            <div
                              className="px-1 py-0.2 rounded text-[8px] font-bold text-slate-500 dark:text-slate-400 truncate flex items-center gap-0.5 opacity-85"
                              title={`Posguardia: ${dPos}`}
                            >
                              <span>💤</span>
                              <span className="truncate">{dPos}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Resumen de Fines Libres del Mes debajo del Calendario */}
              {freeWeekends.length > 0 && (
                <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-2.5 space-y-1.5">
                  <div className="text-[11px] font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                    <Palmtree size={13} /> Fines Libres Programados ({monthStr})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {freeWeekends.map(rule => {
                      const prof = getMemberProfile(rule.resident, settingsMeta);
                      return (
                        <span
                          key={rule.id}
                          className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 px-2 py-1 rounded-lg text-[10px] font-bold text-slate-700 dark:text-slate-200"
                        >
                          <span className={`w-2 h-2 rounded-full ${prof.colorObj.dot}`} />
                          <span>{rule.resident}</span>
                          <span className="text-emerald-600 dark:text-emerald-400">({rule.label})</span>
                          {canEditMonth && (
                            <button
                              type="button"
                              onClick={() => handleRemoveFreeWeekendRule(rule.id)}
                              className="text-red-400 hover:text-red-600 ml-0.5"
                              title="Quitar Fin Libre"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              SECCIÓN 2: CONFIGURACIÓN DEL ROL ABCD + REGLAS DE FIN LIBRE
             ================================================================= */}
          {activeSection === 'guards' && (
            <div className="space-y-3">
              {isPastMonth && (
                <div className="bg-slate-100 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 p-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2">
                  <Lock size={14} />
                  <span>Este es un mes pasado ({monthStr}). Las guardias están guardadas y no se pueden editar.</span>
                </div>
              )}

              {/* Regla de Fin Libre (para que ese fin la persona seleccionada no tenga guardias) */}
              <div className="bg-emerald-50/60 dark:bg-emerald-950/25 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60 space-y-2.5">
                <div>
                  <span className="text-xs font-extrabold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                    <Palmtree size={15} className="text-emerald-600 dark:text-emerald-400" />
                    Regla de Fin Libre en {monthStr} (Sin Guardias en Fin de Semana)
                  </span>
                  <p className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80">
                    La persona seleccionada quedará exenta de guardias durante todo ese fin de semana de {monthStr}.
                  </p>
                </div>

                {canEditMonth && (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 block mb-0.5">Residente:</label>
                      <select
                        value={freeRes}
                        onChange={e => setFreeRes(e.target.value)}
                        className="w-full p-1.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white"
                      >
                        <option value="">Elegir...</option>
                        {selectedHzh.length > 0 && (
                          <optgroup label="📍 Rotando en HZH">
                            {selectedHzh.map(r => <option key={r} value={r}>{r}</option>)}
                          </optgroup>
                        )}
                        <optgroup label="Todos">
                          {allOrdered.map(r => <option key={r} value={r}>{r}</option>)}
                        </optgroup>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 block mb-0.5">Fin de Semana:</label>
                      <select
                        value={freeWeekendId || (monthWeekends[0]?.id || '')}
                        onChange={e => setFreeWeekendId(e.target.value)}
                        className="w-full p-1.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white"
                      >
                        {monthWeekends.map(wk => (
                          <option key={wk.id} value={wk.id}>
                            {freeSpanMode === 'vie-dom' ? wk.labelVieDom : wk.labelSabDom}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 block mb-0.5">Días y Suplencia:</label>
                      <div className="flex gap-1">
                        <select
                          value={freeSpanMode}
                          onChange={e => setFreeSpanMode(e.target.value)}
                          className="w-1/2 p-1.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-[10px] font-bold text-slate-800 dark:text-white"
                          title="Días que abarca el Fin Libre"
                        >
                          <option value="vie-dom">Vie–Dom</option>
                          <option value="sab-dom">Sáb–Dom</option>
                        </select>
                        <select
                          value={freeReplacement}
                          onChange={e => setFreeReplacement(e.target.value)}
                          className="w-1/2 p-1.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-[10px] font-bold text-slate-800 dark:text-white"
                          title="Quién queda en la guardia si le tocaba ese fin"
                        >
                          <option value="Nadie">🚫 Nadie</option>
                          {allOrdered.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddFreeWeekendRule}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm transition flex items-center justify-center gap-1"
                    >
                      <Plus size={14} /> Agregar Fin Libre
                    </button>
                  </div>
                )}

                {freeWeekends.length > 0 ? (
                  <div className="space-y-1 pt-1">
                    {freeWeekends.map(rule => {
                      const prof = getMemberProfile(rule.resident, settingsMeta);
                      return (
                        <div key={rule.id} className="flex items-center justify-between bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/70 text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`w-2.5 h-2.5 rounded-full ${prof.colorObj.dot}`} />
                            <span className="font-bold text-slate-800 dark:text-white">{rule.resident}</span>
                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">🏖️ {rule.label}</span>
                            <span className="text-[10px] text-gray-400">
                              (Cubre: {rule.replacement || 'Nadie'})
                            </span>
                          </div>
                          {canEditMonth && (
                            <button
                              type="button"
                              onClick={() => handleRemoveFreeWeekendRule(rule.id)}
                              className="text-red-400 hover:text-red-600 p-1"
                              title="Eliminar regla"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-400 italic">No hay reglas de Fin Libre activas en {monthStr}.</p>
                )}
              </div>

              {/* Generador automático por ciclo ABCD (solo visible si puede editar este mes) */}
              {canEditMonth && (
                <div className="bg-slate-50 dark:bg-slate-700/40 p-3 rounded-xl border border-gray-200 dark:border-slate-600 space-y-2">
                  <div className="flex flex-wrap justify-between items-center gap-1.5">
                    <div>
                      <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                        <Sparkles size={14} className="text-blue-500" />
                        Ciclo ABCD para {monthStr}
                      </span>
                      <p className="text-[10px] text-gray-500 dark:text-slate-400">
                        Cambiar integrantes aquí NO mueve otros meses ni modifica días hasta que pulses "Autollenar {monthStr}".
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={addCycleSlot}
                        className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-0.5 hover:bg-gray-100 transition"
                        title="Agregar posición al ciclo (ej. ABCDE)"
                      >
                        <Plus size={12} /> Posición
                      </button>
                      <button
                        type="button"
                        onClick={autoFillMonthGuards}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-sm transition"
                      >
                        ⚡ Autollenar {monthStr}
                      </button>
                    </div>
                  </div>

                  {effectiveCycle.length === 0 ? (
                    <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-dashed border-gray-300 dark:border-slate-600">
                      <p className="text-[11px] text-gray-500 dark:text-slate-400">
                        Selecciona residentes en "📍 HZH" para {monthStr} o inicia un ciclo ABCD.
                      </p>
                      <button
                        type="button"
                        onClick={() => updateActiveMonthData(cur => ({ ...cur, cycleOrder: ['Nadie', 'Nadie', 'Nadie', 'Nadie'] }))}
                        className="text-[10px] font-bold text-blue-600 dark:text-blue-400 underline ml-2 whitespace-nowrap"
                      >
                        Iniciar ABCD
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {effectiveCycle.map((resName, idx) => {
                        const slotLetter = String.fromCharCode(65 + idx); // A, B, C, D...
                        const prof = getMemberProfile(resName, settingsMeta);
                        return (
                          <div key={`${slotLetter}-${idx}`} className="flex items-center justify-between gap-2 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-xs">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-[10px] font-black bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 w-5 h-5 rounded flex items-center justify-center flex-shrink-0">
                                {slotLetter}
                              </span>
                              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${prof.colorObj.dot}`} />
                              <select
                                value={resName || 'Nadie'}
                                onChange={e => updateCycleSlot(idx, e.target.value)}
                                className="flex-1 p-1 rounded border border-gray-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-xs font-bold text-slate-800 dark:text-white truncate"
                              >
                                <option value="Nadie">🚫 Nadie (Sin guardia)</option>
                                {selectedHzh.length > 0 && (
                                  <optgroup label="📍 Rotando en HZH">
                                    {selectedHzh.map(r => <option key={r} value={r}>{r}</option>)}
                                  </optgroup>
                                )}
                                <optgroup label="Todos los Residentes">
                                  {allOrdered.map(r => <option key={r} value={r}>{r}</option>)}
                                </optgroup>
                              </select>
                            </div>
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                              <button type="button" onClick={() => moveInCycle(idx, -1)} disabled={idx === 0} className="p-1 text-gray-400 hover:text-slate-800 dark:hover:text-white disabled:opacity-20"><ArrowUp size={13} /></button>
                              <button type="button" onClick={() => moveInCycle(idx, 1)} disabled={idx === effectiveCycle.length - 1} className="p-1 text-gray-400 hover:text-slate-800 dark:hover:text-white disabled:opacity-20"><ArrowDown size={13} /></button>
                              {effectiveCycle.length > 4 && (
                                <button type="button" onClick={() => removeCycleSlot(idx)} className="p-1 text-red-400 hover:text-red-600" title="Quitar posición">
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              SECCIÓN 3: SELECCIÓN DE RESIDENTES ROTANDO EN ZAMBRANO (HZH)
             ================================================================= */}
          {activeSection === 'rotation' && (
            <>
              {isPastMonth && (
                <div className="bg-slate-100 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 p-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2">
                  <Lock size={14} />
                  <span>Este es un mes pasado ({monthStr}). La rotación está guardada en modo de solo lectura.</span>
                </div>
              )}

              <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/60 p-2.5 rounded-xl text-xs text-orange-800 dark:text-orange-200">
                Residentes rotando en el <strong>Hospital Zambrano Hellion</strong> durante <strong>{monthStr}</strong>.
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {allOrdered.map(resName => {
                  const isSelected = selectedHzh.includes(resName);
                  const prof = getMemberProfile(resName, settingsMeta);
                  return (
                    <button
                      key={resName}
                      type="button"
                      onClick={() => toggleHzhResident(resName)}
                      className={`p-2 rounded-xl border text-left transition flex items-center justify-between gap-1.5 ${
                        isSelected
                          ? 'bg-orange-50 dark:bg-orange-950/50 border-orange-500 ring-1 ring-orange-500/50 shadow-sm'
                          : 'bg-white dark:bg-slate-700/60 border-gray-200 dark:border-slate-600 opacity-75'
                      } ${canEditMonth ? 'hover:opacity-100' : 'cursor-default'}`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${prof.colorObj.dot}`} />
                        <span className="text-xs font-bold text-slate-800 dark:text-white truncate">{resName}</span>
                      </div>
                      {canEditMonth ? (
                        <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${isSelected ? 'bg-orange-500 text-white' : 'border border-gray-300 dark:border-slate-500'}`}>
                          {isSelected && <Check size={11} />}
                        </span>
                      ) : (
                        isSelected && (
                          <span className="w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0 bg-orange-500 text-white">
                            <Check size={11} />
                          </span>
                        )
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer botones */}
        <div className="p-3 bg-gray-50 dark:bg-slate-900/80 border-t border-gray-200 dark:border-slate-700 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-gray-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold"
          >
            {canManage ? 'Cancelar' : 'Cerrar'}
          </button>
          {canManage && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black shadow-md transition"
            >
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
