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

// 🔥 NUEVA DESCARGA HÍBRIDA (MOBILE SHARE + DESKTOP DOWNLOAD) 🔥
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
  
  // 1. Detección de celular (Web Share API)
  if (navigator.share && navigator.canShare) {
      const file = new File([blob], filename, { type: 'text/csv' });
      if (navigator.canShare({ files: [file] })) {
          try {
              await navigator.share({
                  files: [file],
                  title: 'Documento UroTec',
              });
              return; // Si el usuario lo compartió exitosamente, cortamos la función aquí.
          } catch (err) {
              console.log("El usuario cerró la ventana de compartir o hubo un error:", err);
              // Si falla o cancela, dejamos que continúe a la descarga tradicional (Fallback)
          }
      }
  }

  // 2. Descarga Tradicional (Computadoras o si falla el share)
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
