import React from 'react';
import { downloadCSV } from '../utils';

const Discharges = ({ patients }) => {
  const downloadAll = () => {
      // Mock download logic
      downloadCSV([], "Egresos_Historico.csv");
      alert("Descargando historial...");
  };

  return (
     <div className="p-4 text-center">
        <h2 className="text-xl font-bold mb-4">Archivo de Egresos</h2>
        <button onClick={downloadAll} className="bg-green-600 text-white px-6 py-3 rounded-lg shadow font-bold">
           Descargar Histórico CSV
        </button>
     </div>
  );
};
export default Discharges;
