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
  return Math.round(Math.abs((firstDate - secondDate) / oneDay));
};

export const downloadCSV = (data, filename) => {
  const csvContent = "data:text/csv;charset=utf-8," + data.map(e => e.join(",")).join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
