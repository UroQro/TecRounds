export const calculateAge = (dob) => {
  if (!dob) return '';
  const diff = Date.now() - new Date(dob).getTime();
  const ageDt = new Date(diff);
  return Math.abs(ageDt.getUTCFullYear() - 1970);
};

export const calculateLOS = (admissionDate) => {
  if (!admissionDate) return 0;
  const oneDay = 24 * 60 * 60 * 1000;
  const firstDate = new Date(admissionDate);
  const secondDate = new Date();
  return Math.round(Math.abs((secondDate - firstDate) / oneDay));
};

export const calculateDaysSince = (dateString) => {
  if (!dateString) return 0;
  const oneDay = 24 * 60 * 60 * 1000;
  const firstDate = new Date(dateString);
  const secondDate = new Date();
  return Math.floor((secondDate - firstDate) / oneDay);
};

export const calculateTreatmentDay = (dateString) => {
  if (!dateString) return 0;
  const diff = calculateDaysSince(dateString);
  return diff + 1; 
};

export const calculateBMI = (weight, height) => {
    if (!weight || !height) return '';
    const h = parseFloat(height);
    const w = parseFloat(weight);
    if(h <= 0) return '';
    const bmi = w / (h * h);
    return bmi.toFixed(1);
};

export const getLocalISODate = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return (new Date(d - offset)).toISOString().slice(0, 10);
};

export const downloadCSV = async (data, headers, filename) => {
  const clean = (str) => {
      if (typeof str !== 'string') return str;
      return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };
  
  const csvContent = [
      headers.map(clean).join(","), 
      ...data.map(row => row.map(cell => `"${clean(String(cell || '')).replace(/"/g, '""')}"`).join(","))
  ].join("\n");

  const blob = new Blob(["\ufeff", csvContent], { type: 'text/csv;charset=utf-8;' }); 
  
  if (navigator.share && navigator.canShare) {
      const file = new File([blob], filename, { type: 'text/csv' });
      if (navigator.canShare({ files: [file] })) {
          try {
              await navigator.share({
                  files: [file],
                  title: 'Documento UroTec',
              });
              return; 
          } catch (err) {
              console.log("El usuario cerró la ventana de compartir o hubo un error:", err);
          }
      }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 100);
};

export const applyPrivacy = (text, isPrivacyMode, type = 'name') => {
    if (!isPrivacyMode || !text) return text;
    const strText = String(text); 
    if (type === 'name') {
        return strText.split(' ').map(w => w.charAt(0) ? w.charAt(0) + '***' : '').join(' ');
    }
    if (type === 'bed') {
        return strText;
    }
    return strText;
};

export const normalizeText = (str) => {
    if (!str) return '';
    return String(str)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
};

export const USER_COLORS = [
    { id: 'black', label: 'Negro (Profesor)', badge: 'bg-slate-900 text-white border-slate-800 dark:bg-black dark:text-slate-100 dark:border-slate-700', solid: 'bg-slate-900 text-white', dot: 'bg-slate-950 dark:bg-slate-200' },
    { id: 'gold', label: 'Dorado (R5)', badge: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-600', solid: 'bg-amber-500 text-white', dot: 'bg-amber-400' },
    { id: 'silver', label: 'Plata (R4)', badge: 'bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-500', solid: 'bg-slate-500 text-white', dot: 'bg-slate-400' },
    { id: 'bronze', label: 'Bronce (R3)', badge: 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950/60 dark:text-orange-200 dark:border-orange-700', solid: 'bg-orange-700 text-white', dot: 'bg-orange-700' },
    { id: 'blue', label: 'Azul (R2)', badge: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-200 dark:border-blue-700', solid: 'bg-blue-600 text-white', dot: 'bg-blue-500' },
    { id: 'ext', label: 'Gris (EXT)', badge: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700', solid: 'bg-gray-500 text-white', dot: 'bg-gray-400' },
    // Compatibilidad con colores previos
    { id: 'emerald', label: 'Dorado (R5)', badge: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-600', solid: 'bg-amber-500 text-white', dot: 'bg-amber-400' },
    { id: 'violet', label: 'Bronce (R3)', badge: 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950/60 dark:text-orange-200 dark:border-orange-700', solid: 'bg-orange-700 text-white', dot: 'bg-orange-700' },
    { id: 'amber', label: 'Dorado (R5)', badge: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-600', solid: 'bg-amber-500 text-white', dot: 'bg-amber-400' },
    { id: 'cyan', label: 'Azul (R2)', badge: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-200 dark:border-blue-700', solid: 'bg-blue-600 text-white', dot: 'bg-blue-500' }
];

export const ROLE_OPTIONS = [
    { id: 'profesor', label: 'Profesor', short: 'PROF', rank: 0, isResident: false, canManageSchedule: false, defaultColor: 'black' },
    { id: 'r5', label: 'Residente R5', short: 'R5', rank: 1, isResident: true, canManageSchedule: true, defaultColor: 'gold' },
    { id: 'r4', label: 'Residente R4', short: 'R4', rank: 2, isResident: true, canManageSchedule: true, defaultColor: 'silver' },
    { id: 'r3', label: 'Residente R3', short: 'R3', rank: 3, isResident: true, canManageSchedule: false, defaultColor: 'bronze' },
    { id: 'r2', label: 'Residente R2', short: 'R2', rank: 4, isResident: true, canManageSchedule: false, defaultColor: 'blue' },
    { id: 'ext', label: 'Ex-Residente (EXT)', short: 'EXT', rank: 5, isResident: false, canManageSchedule: false, defaultColor: 'ext' }
];

export const getMemberProfile = (nameOrEmail, settingsMeta = {}) => {
    const defaultR2Role = ROLE_OPTIONS.find(r => r.id === 'r2');
    const defaultBlueColor = USER_COLORS.find(c => c.id === 'blue') || USER_COLORS[0];

    if (!nameOrEmail) {
        return {
            role: 'r2',
            roleShort: 'R2',
            roleObj: defaultR2Role,
            rank: 4,
            isResident: true,
            canManageSchedule: false,
            colorId: 'blue',
            colorObj: defaultBlueColor,
            color: defaultBlueColor,
            inHzh: false
        };
    }
    const raw = String(nameOrEmail).trim();
    const norm = normalizeText(raw);
    if (norm === 'nadie') {
        const neutralColor = USER_COLORS.find(c => c.id === 'ext') || defaultBlueColor;
        return {
            name: 'Nadie',
            email: '',
            role: 'none',
            roleLabel: 'Sin guardia',
            roleShort: '',
            roleObj: null,
            rank: 99,
            isResident: false,
            canManageSchedule: false,
            colorId: 'ext',
            colorObj: neutralColor,
            color: neutralColor,
            inHzh: false
        };
    }

    const emailPrefix = norm.includes('@') ? norm.split('@')[0] : norm;
    const profiles = settingsMeta?.profiles || {};

    // Buscar coincidencia directa por clave normalizada, por prefijo de email o por residentName vinculado
    let found = profiles[norm] || profiles[emailPrefix];
    if (!found) {
        const matchKey = Object.keys(profiles).find(k => {
            const p = profiles[k];
            return normalizeText(k) === norm ||
                   normalizeText(k) === emailPrefix ||
                   normalizeText(p?.name) === norm ||
                   normalizeText(p?.name) === emailPrefix ||
                   (p?.email && normalizeText(p.email).split('@')[0] === emailPrefix);
        });
        if (matchKey) found = profiles[matchKey];
    }

    // Normalizar rol ('adscrito' -> 'profesor', Roberto -> 'profesor', y por defecto cualquier usuario nuevo inicia como 'r2')
    let rawRole = found?.role === 'adscrito' ? 'profesor' : (found?.role || '');
    if (!rawRole) {
        if (norm === 'roberto' || emailPrefix.includes('roberto')) {
            rawRole = 'profesor';
        } else {
            rawRole = 'r2';
        }
    }

    const roleObj = ROLE_OPTIONS.find(r => r.id === rawRole) || defaultR2Role;
    // El color siempre corresponde al rango (Profesor: negro, R5: dorado, R4: plata, R3: bronce, R2: azul, EXT: gris)
    const targetColorId = roleObj?.defaultColor || 'blue';
    const colorObj = USER_COLORS.find(c => c.id === targetColorId) || defaultBlueColor;
    const hzhList = (settingsMeta?.hzhRotation?.residents || []).map(normalizeText);
    const inHzh = hzhList.includes(norm) || hzhList.includes(emailPrefix) || (found?.name && hzhList.includes(normalizeText(found.name)));

    return {
        name: found?.name || raw,
        email: found?.email || '',
        role: roleObj.id,
        roleLabel: roleObj.label,
        roleShort: roleObj.short,
        roleObj,
        rank: roleObj.rank,
        isResident: roleObj.isResident,
        canManageSchedule: Boolean(roleObj.canManageSchedule),
        colorId: colorObj.id,
        colorObj,
        color: colorObj,
        inHzh
    };
};

// Verifica si el usuario actual es R4 o R5 (únicos con permiso para asignar cirugías y poner/quitar guardias)
export const canUserManageSchedule = (user, settingsMeta = {}) => {
    if (!user) return { allowed: false, profile: getMemberProfile('', settingsMeta) };
    const byEmail = user.email ? getMemberProfile(user.email, settingsMeta) : null;
    const byName = user.displayName ? getMemberProfile(user.displayName, settingsMeta) : null;
    // Priorizar el perfil que tenga coincidencia explícita en settingsMeta.profiles
    const profiles = settingsMeta?.profiles || {};
    const emailNorm = normalizeText(user.email || '');
    const emailPrefix = emailNorm.split('@')[0];
    const nameNorm = normalizeText(user.displayName || '');
    const hasEmailProfile = Boolean(profiles[emailNorm] || profiles[emailPrefix]);
    const hasNameProfile = Boolean(nameNorm && profiles[nameNorm]);

    const profile = hasEmailProfile ? byEmail : hasNameProfile ? byName : (byEmail || byName || getMemberProfile('', settingsMeta));
    const allowed = profile.role === 'r4' || profile.role === 'r5';
    return { allowed, profile };
};

export const getOrderedResidents = (residentsList = [], settingsMeta = {}) => {
    const profiles = settingsMeta?.profiles || {};
    const combinedSet = new Map();

    // 1. Agregar residentes del catálogo
    (residentsList || []).forEach(r => {
        if (!r) return;
        const norm = normalizeText(r);
        combinedSet.set(norm, r);
    });

    // 2. Homologar usuarios que tengan rol de residente activo (R5, R4, R3, R2) y nombre configurado
    Object.values(profiles).forEach(p => {
        if (!p?.name || p.name.includes('@')) return;
        const roleId = p.role === 'adscrito' ? 'profesor' : (p.role || 'r2');
        const roleObj = ROLE_OPTIONS.find(ro => ro.id === roleId);
        if (roleObj && roleObj.isResident) {
            const norm = normalizeText(p.name);
            if (!combinedSet.has(norm)) {
                combinedSet.set(norm, p.name);
            }
        }
    });

    // 3. Filtrar a cualquiera que sea Profesor o Ex-Residente (EXT) para que nunca salgan en los dropdowns de residentes
    const validResidents = Array.from(combinedSet.values()).filter(r => {
        const prof = getMemberProfile(r, settingsMeta);
        return prof.role !== 'profesor' && prof.role !== 'adscrito' && prof.role !== 'ext' && prof.isResident !== false;
    });

    const sortFn = (a, b) => {
        const pa = getMemberProfile(a, settingsMeta);
        const pb = getMemberProfile(b, settingsMeta);
        if (pa.rank !== pb.rank) return pa.rank - pb.rank;
        return a.localeCompare(b);
    };

    const hzhResidents = validResidents.filter(r => getMemberProfile(r, settingsMeta).inHzh).sort(sortFn);
    const otherResidents = validResidents.filter(r => !getMemberProfile(r, settingsMeta).inHzh).sort(sortFn);

    return {
        allOrdered: [...hzhResidents, ...otherResidents],
        hzhResidents,
        otherResidents
    };
};

// Construye o ajusta el ciclo de guardias:
// - Por defecto los R5 no hacen guardia (solo entran R4, R3, R2 salvo que se agreguen manualmente).
// - Cuando hay 4 residentes o menos, la frecuencia máxima de guardias es ABCD (mínimo 4 posiciones en el ciclo),
//   rellenando las posiciones faltantes con 'Nadie'.
export const buildGuardCycleABCD = (hzhResidents = [], settingsMeta = {}, existingCycle = []) => {
    // Residentes que hacen guardia por defecto (excluyendo R5)
    const guardEligibleHzh = (hzhResidents || []).filter(r => {
        const prof = getMemberProfile(r, settingsMeta);
        return prof.role !== 'r5' && prof.role !== 'profesor' && prof.role !== 'ext';
    });

    // Partir del ciclo existente pero quitando residentes que ya no están en HZH (conservando 'Nadie')
    let nextCycle = (existingCycle || []).filter(item => {
        if (item === 'Nadie') return true;
        return (hzhResidents || []).includes(item) && getMemberProfile(item, settingsMeta).role !== 'r5';
    });

    // Agregar residentes elegibles de HZH que aún no estén en el ciclo
    guardEligibleHzh.forEach(r => {
        if (!nextCycle.includes(r)) {
            // Si había un slot 'Nadie' de relleno y estamos sumando residentes dentro de los 4 slots ABCD, reemplazar un 'Nadie'
            const nadieIdx = nextCycle.indexOf('Nadie');
            if (nadieIdx !== -1 && nextCycle.length >= 4) {
                nextCycle[nadieIdx] = r;
            } else {
                nextCycle.push(r);
            }
        }
    });

    // Si no hay ningún residente en absoluto en HZH ni en el ciclo, devolver vacío
    if (hzhResidents.length === 0 && nextCycle.every(x => x === 'Nadie')) {
        return [];
    }

    // Si todos los residentes en HZH son R5 (0 residentes de guardia), o hay <= 4 residentes,
    // la frecuencia máxima permitida es ABCD (mínimo 4 slots en el ciclo, rellenando con 'Nadie')
    while (nextCycle.length < 4) {
        nextCycle.push('Nadie');
    }

    // Si sobran 'Nadie' cuando ya hay 4 o más residentes reales, limpiar 'Nadie' sobrantes salvo que hagan falta para llegar a 4
    const realCount = nextCycle.filter(x => x !== 'Nadie').length;
    if (realCount >= 4 && nextCycle.length > realCount) {
        nextCycle = nextCycle.filter(x => x !== 'Nadie');
    }

    return nextCycle;
};

// Promoción anual automática cada 1 de marzo: R5 -> EXT, R4 -> R5, R3 -> R4, R2 -> R3
export const computeMarchPromotion = (profiles = {}, residents = []) => {
    const nextProfiles = { ...profiles };
    const promotedToExtNames = new Set();

    // Asegurar que todos los residentes actuales en catálogo tengan entrada antes de promover
    (residents || []).forEach(rName => {
        const key = normalizeText(rName);
        if (!key) return;
        if (!nextProfiles[key]) {
            nextProfiles[key] = { name: rName, role: 'r2', color: 'blue' };
        }
    });

    Object.keys(nextProfiles).forEach(key => {
        const p = nextProfiles[key];
        if (!p) return;
        const currentRole = p.role || 'r2';
        let nextRole = currentRole;
        if (currentRole === 'r5') {
            nextRole = 'ext';
            if (p.name) promotedToExtNames.add(normalizeText(p.name));
            promotedToExtNames.add(key);
        } else if (currentRole === 'r4') {
            nextRole = 'r5';
        } else if (currentRole === 'r3') {
            nextRole = 'r4';
        } else if (currentRole === 'r2') {
            nextRole = 'r3';
        }
        const roleObj = ROLE_OPTIONS.find(r => r.id === nextRole);
        nextProfiles[key] = {
            ...p,
            role: nextRole,
            color: roleObj?.defaultColor || p.color || 'blue'
        };
    });

    // Los R5 que pasaron a EXT salen del catálogo activo de residentes
    const nextResidents = (residents || []).filter(r => !promotedToExtNames.has(normalizeText(r)));

    return { nextProfiles, nextResidents };
};

const addDaysISO = (dateStr, deltaDays) => {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + deltaDays);
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d - offset).toISOString().slice(0, 10);
};

export const getGuardForDate = (dateStr, settingsMeta = {}) => {
    if (!dateStr) return { guardia: '', posguardia: '' };
    const rot = settingsMeta?.hzhRotation || {};
    const schedule = rot.schedule || {};
    const rawCycle = rot.cycleOrder || [];
    // Garantizar que si hay <= 3 elementos en el ciclo guardado, se respete la frecuencia máxima ABCD (mínimo 4 slots con 'Nadie')
    const effectiveCycle = rawCycle.length > 0 && rawCycle.length < 4
        ? [...rawCycle, ...Array(4 - rawCycle.length).fill('Nadie')]
        : rawCycle;

    const resolveSingleDayGuard = (dStr) => {
        if (schedule[dStr]?.guardia) return schedule[dStr].guardia;
        const startStr = rot.cycleStartDate;
        if (effectiveCycle.length > 0 && startStr) {
            const d1 = new Date(startStr + 'T12:00:00');
            const d2 = new Date(dStr + 'T12:00:00');
            const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
            if (diffDays >= 0) {
                return effectiveCycle[diffDays % effectiveCycle.length] || '';
            }
        }
        return '';
    };

    const guardia = resolveSingleDayGuard(dateStr);
    // Posguardia se asigna 100% automáticamente a quien estuvo de guardia ayer (si ayer estuvo 'Nadie', hoy posguardia es 'Nadie')
    const yesterdayStr = addDaysISO(dateStr, -1);
    const posguardia = resolveSingleDayGuard(yesterdayStr) || '';

    return { guardia, posguardia };
};

export const isEndOfMonthRotationPrompt = (settingsMeta = {}) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const dayOfMonth = now.getDate();

    // Si estamos en los últimos 3 días del mes, sugerir configurar el mes siguiente
    if (dayOfMonth >= lastDayOfMonth - 2) {
        const nextDate = new Date(year, month + 1, 1);
        const nextMonthKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
        if (settingsMeta?.hzhRotation?.month !== nextMonthKey) {
            return { show: true, targetMonth: nextMonthKey, isEndOfMonth: true };
        }
    }
    return { show: false, targetMonth: `${year}-${String(month + 1).padStart(2, '0')}`, isEndOfMonth: false };
};

