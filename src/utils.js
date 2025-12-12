
// UTILS BLINDADOS CONTRA ERRORES
export const calculateAge = (dob) => {
  if (!dob) return '';
  try {
    const diff = Date.now() - new Date(dob).getTime();
    if(isNaN(diff)) return '';
    const ageDt = new Date(diff);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
  } catch(e) { return ''; }
};

export const calculateLOS = (admissionDate) => {
  if (!admissionDate) return 0;
  try {
    const oneDay = 24 * 60 * 60 * 1000;
    const firstDate = new Date(admissionDate);
    const secondDate = new Date();
    const diff = Math.round(Math.abs((secondDate - firstDate) / oneDay));
    return isNaN(diff) ? 0 : diff;
  } catch(e) { return 0; }
};

export const calculateDaysSince = (dateString) => {
  if (!dateString) return 0;
  try {
    const oneDay = 24 * 60 * 60 * 1000;
    const firstDate = new Date(dateString);
    const secondDate = new Date();
    const diff = Math.floor((secondDate - firstDate) / oneDay);
    return isNaN(diff) ? 0 : diff;
  } catch(e) { return 0; }
};

export const calculateTreatmentDay = (dateString) => {
  const diff = calculateDaysSince(dateString);
  return diff + 1; 
};

export const calculateBMI = (weight, height) => {
    if (!weight || !height) return '';
    const h = parseFloat(height);
    const w = parseFloat(weight);
    if(isNaN(h) || isNaN(w) || h <= 0) return '';
    const bmi = w / (h * h);
    return bmi.toFixed(1);
};

export const getLocalISODate = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return (new Date(d - offset)).toISOString().slice(0, 10);
};

export const safeDateDisplay = (isoString) => {
    if(!isoString) return 'Fecha inválida';
    try {
        const d = new Date(isoString);
        if(isNaN(d.getTime())) return 'Fecha inválida';
        return d.toLocaleDateString('es-MX', {day:'2-digit', month:'short'});
    } catch(e) { return 'Error Fecha'; }
};

export const safeTimeDisplay = (isoString) => {
    if(!isoString) return '';
    try {
        const d = new Date(isoString);
        if(isNaN(d.getTime())) return '';
        return d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    } catch(e) { return ''; }
};

export const downloadCSV = (data, headers, filename) => {
  const csvContent = "data:text/csv;charset=utf-8," 
    + [headers.join(","), ...data.map(e => e.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
