import React, { useState, useMemo } from 'react';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { X, MapPin, ArrowUp, ArrowDown, Sparkles, Calendar, Check, Plus, Trash2 } from 'lucide-react';
import { getMemberProfile, getOrderedResidents, getLocalISODate, canUserManageSchedule, buildGuardCycleABCD } from '../utils';

export default function RotationScheduleModal({ user, onClose, dynamicResidents = [], settingsMeta = {} }) {
  const today = getLocalISODate();
  const currentRot = settingsMeta?.hzhRotation || {};
  const { allowed: canManage } = useMemo(
    () => canUserManageSchedule(user, settingsMeta),
    [user, settingsMeta]
  );

  // Si estamos en los últimos 3 días del mes, preseleccionar el mes siguiente
  const defaultMonth = useMemo(() => {
    if (currentRot.month) return currentRot.month;
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    if (now.getDate() >= lastDay - 2) {
      const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    }
    return today.slice(0, 7);
  }, [currentRot.month, today]);

  const [monthStr, setMonthStr] = useState(defaultMonth);
  const [selectedHzh, setSelectedHzh] = useState(() => currentRot.residents || []);
  const [cycleOrder, setCycleOrder] = useState(() =>
    buildGuardCycleABCD(currentRot.residents || [], settingsMeta, currentRot.cycleOrder || [])
  );
  const [cycleStartDate, setCycleStartDate] = useState(() => currentRot.cycleStartDate || `${defaultMonth}-01`);
  const [schedule, setSchedule] = useState(() => currentRot.schedule || {});
  const [activeSection, setActiveSection] = useState('rotation'); // 'rotation' | 'guards'
  const [saving, setSaving] = useState(false);

  const { allOrdered } = useMemo(
    () => getOrderedResidents(dynamicResidents, settingsMeta),
    [dynamicResidents, settingsMeta]
  );

  const toggleHzhResident = (resName) => {
    if (!canManage) return;
    setSelectedHzh(prev => {
      const exists = prev.includes(resName);
      const next = exists ? prev.filter(r => r !== resName) : [...prev, resName];
      setCycleOrder(prevCycle => buildGuardCycleABCD(next, settingsMeta, prevCycle));
      return next;
    });
  };

  const moveInCycle = (idx, dir) => {
    if (!canManage) return;
    const target = idx + dir;
    if (target < 0 || target >= cycleOrder.length) return;
    const copy = [...cycleOrder];
    const temp = copy[idx];
    copy[idx] = copy[target];
    copy[target] = temp;
    setCycleOrder(copy);
  };

  const updateCycleSlot = (idx, value) => {
    if (!canManage) return;
    setCycleOrder(prev => {
      const copy = [...prev];
      copy[idx] = value || 'Nadie';
      return copy;
    });
  };

  const addCycleSlot = () => {
    if (!canManage) return;
    setCycleOrder(prev => [...prev, 'Nadie']);
  };

  const removeCycleSlot = (idx) => {
    if (!canManage) return;
    // La frecuencia máxima de guardias es ABCD (mínimo 4 posiciones en el ciclo)
    if (cycleOrder.length <= 4) return;
    setCycleOrder(prev => prev.filter((_, i) => i !== idx));
  };

  // Días del mes seleccionado para vista/ajuste día por día
  const daysInMonth = useMemo(() => {
    const [y, m] = monthStr.split('-').map(Number);
    if (!y || !m) return [];
    const totalDays = new Date(y, m, 0).getDate();
    const list = [];
    for (let d = 1; d <= totalDays; d++) {
      const dStr = `${monthStr}-${String(d).padStart(2, '0')}`;
      const dateObj = new Date(dStr + 'T12:00:00');
      const weekday = dateObj.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '');
      list.push({ dateStr: dStr, dayNum: d, weekday });
    }
    return list;
  }, [monthStr]);

  const effectiveCycle = useMemo(() => {
    if (cycleOrder.length === 0) return [];
    if (cycleOrder.length < 4) {
      return [...cycleOrder, ...Array(4 - cycleOrder.length).fill('Nadie')];
    }
    return cycleOrder;
  }, [cycleOrder]);

  // Calcula la guardia de una fecha usando schedule actual o el ciclo ABCD
  const getGuardForDay = (dateStr) => {
    if (schedule[dateStr]?.guardia) return schedule[dateStr].guardia;
    if (effectiveCycle.length > 0 && cycleStartDate) {
      const d1 = new Date(cycleStartDate + 'T12:00:00');
      const d2 = new Date(dateStr + 'T12:00:00');
      const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
      if (diff >= 0) {
        return effectiveCycle[diff % effectiveCycle.length] || '';
      }
    }
    return '';
  };

  // Calcula automáticamente la posguardia como quien tuvo guardia el día anterior
  const getAutoPosguardiaForDay = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    const offset = d.getTimezoneOffset() * 60000;
    const prevDateStr = new Date(d - offset).toISOString().slice(0, 10);
    return getGuardForDay(prevDateStr);
  };

  // Autollenar todo el mes seleccionado según el orden del ciclo ABCD
  const autoFillMonthGuards = () => {
    if (!canManage) return;
    const cycleToUse = effectiveCycle.length >= 4 ? effectiveCycle : ['Nadie', 'Nadie', 'Nadie', 'Nadie'];
    const nextSchedule = { ...schedule };
    const startObj = new Date(cycleStartDate + 'T12:00:00');

    daysInMonth.forEach((day) => {
      const curObj = new Date(day.dateStr + 'T12:00:00');
      const diff = Math.round((curObj - startObj) / (1000 * 60 * 60 * 24));
      const cycleIdx = ((diff % cycleToUse.length) + cycleToUse.length) % cycleToUse.length;
      const guardiaRes = cycleToUse[cycleIdx] || 'Nadie';

      nextSchedule[day.dateStr] = {
        guardia: guardiaRes
      };
    });

    setSchedule(nextSchedule);
  };

  const setDayGuard = (dateStr, value) => {
    if (!canManage) return;
    setSchedule(prev => ({
      ...prev,
      [dateStr]: {
        guardia: value
      }
    }));
  };

  const handleSave = async () => {
    if (!canManage) return;
    setSaving(true);
    try {
      const payload = {
        hzhRotation: {
          month: monthStr,
          residents: selectedHzh,
          cycleOrder: effectiveCycle,
          cycleStartDate,
          schedule,
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
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-3 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabecera */}
        <div className="bg-slate-900 text-white p-3.5 flex justify-between items-center">
          <div>
            <h3 className="font-black text-sm sm:text-base flex items-center gap-1.5">
              <MapPin size={16} className="text-orange-400" />
              Rotación Zambrano (HZH) y Guardias
            </h3>
            <p className="text-[11px] text-slate-400">
              Residentes en HZH y rol mensual de guardias
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X size={18} />
          </button>
        </div>

        {/* Selector de mes y pestañas */}
        <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 border-b border-gray-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Calendar size={14} className="text-orange-500" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Mes:</span>
            <input
              type="month"
              value={monthStr}
              onChange={e => {
                setMonthStr(e.target.value);
                setCycleStartDate(`${e.target.value}-01`);
              }}
              className="px-2 py-1 border border-gray-300 dark:border-slate-600 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex bg-gray-200 dark:bg-slate-700 p-0.5 rounded-lg text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveSection('rotation')}
              className={`px-2.5 py-1 rounded-md transition ${activeSection === 'rotation' ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-sm' : 'text-gray-600 dark:text-slate-300'}`}
            >
              1. Rotación HZH ({selectedHzh.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('guards')}
              className={`px-2.5 py-1 rounded-md transition ${activeSection === 'guards' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-600 dark:text-slate-300'}`}
            >
              2. Rol de Guardias
            </button>
          </div>
        </div>

        {/* Contenido scrolleable */}
        <div className="p-3.5 overflow-y-auto flex-1 space-y-3">
          {activeSection === 'rotation' ? (
            <>
              <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/60 p-2.5 rounded-xl text-xs text-orange-800 dark:text-orange-200">
                Residentes rotando en el <strong>Hospital Zambrano Hellion</strong> durante <strong>{monthStr}</strong>. Aparecen primero en todos los selectores.
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
                      } ${canManage ? 'hover:opacity-100' : 'cursor-default'}`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${prof.colorObj.dot}`} />
                        <span className="text-xs font-bold text-slate-800 dark:text-white truncate">{resName}</span>
                      </div>
                      {canManage ? (
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
          ) : (
            <div className="space-y-3">
              {/* Generador automático por ciclo ABCD (solo visible si puede gestionar) */}
              {canManage && (
                <div className="bg-slate-50 dark:bg-slate-700/40 p-3 rounded-xl border border-gray-200 dark:border-slate-600 space-y-2">
                  <div className="flex flex-wrap justify-between items-center gap-1.5">
                    <div>
                      <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                        <Sparkles size={14} className="text-blue-500" />
                        Ciclo de Guardia (Frecuencia máx. ABCD)
                      </span>
                      <p className="text-[10px] text-gray-500 dark:text-slate-400">
                        Mínimo 4 posiciones (A-B-C-D). Los días sin residente quedan como <strong>Nadie</strong>.
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
                        ⚡ Autollenar Mes
                      </button>
                    </div>
                  </div>

                  {effectiveCycle.length === 0 ? (
                    <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-dashed border-gray-300 dark:border-slate-600">
                      <p className="text-[11px] text-gray-500 dark:text-slate-400">
                        Selecciona residentes en "1. Rotación HZH" o inicia un ciclo ABCD.
                      </p>
                      <button
                        type="button"
                        onClick={() => setCycleOrder(['Nadie', 'Nadie', 'Nadie', 'Nadie'])}
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

              {/* Tabla día por día (Guardia editable si tiene permiso, Posguardia 100% automática) */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1">
                  <span>Fecha</span>
                  <div className="flex gap-8 pr-4">
                    <span>🛡️ Guardia</span>
                    <span>💤 Posguardia (Auto)</span>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1 pr-0.5">
                  {daysInMonth.map(d => {
                    const dayGuard = getGuardForDay(d.dateStr);
                    const dayPos = getAutoPosguardiaForDay(d.dateStr);
                    const isToday = d.dateStr === today;
                    const guardProf = dayGuard ? getMemberProfile(dayGuard, settingsMeta) : null;
                    const posProf = dayPos ? getMemberProfile(dayPos, settingsMeta) : null;

                    return (
                      <div key={d.dateStr} className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg border text-xs ${isToday ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700' : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700'}`}>
                        <span className="font-mono font-bold text-[11px] text-slate-700 dark:text-slate-300 w-20 flex-shrink-0 capitalize">
                          {d.dayNum} {d.weekday}
                        </span>

                        {/* Guardia */}
                        <div className="flex-1">
                          {canManage ? (
                            <select
                              value={dayGuard}
                              onChange={e => setDayGuard(d.dateStr, e.target.value)}
                              className="w-full p-1 border border-gray-200 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-700 text-[11px] font-bold text-slate-800 dark:text-white"
                            >
                              <option value="">— Guardia —</option>
                              <option value="Nadie">🚫 Nadie</option>
                              {selectedHzh.length > 0 && (
                                <optgroup label="📍 HZH">
                                  {selectedHzh.map(r => <option key={r} value={r}>{r}</option>)}
                                </optgroup>
                              )}
                              <optgroup label="Todos">
                                {allOrdered.map(r => <option key={r} value={r}>{r}</option>)}
                              </optgroup>
                            </select>
                          ) : (
                            dayGuard && guardProf ? (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold ${guardProf.colorObj.badge}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${guardProf.colorObj.dot}`} />
                                {dayGuard}
                              </span>
                            ) : (
                              <span className="text-[11px] text-gray-400">—</span>
                            )
                          )}
                        </div>

                        {/* Posguardia: 100% Automática (quien tuvo guardia ayer) */}
                        <div className="flex-1 flex justify-end">
                          {dayPos && posProf ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold opacity-90 ${posProf.colorObj.badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${posProf.colorObj.dot}`} />
                              {dayPos}
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400 italic pr-2">Automática</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
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
              {saving ? 'Guardando...' : 'Guardar Rotación y Rol'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
