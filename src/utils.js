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
