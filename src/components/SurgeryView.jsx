import React from 'react';

const SurgeryView = () => {
  return (
    <div className="p-2 space-y-4">
       <h2 className="font-bold text-xl">Quirófano (Demo)</h2>
       <div className="bg-white border-l-4 border-blue-600 p-4 rounded shadow-sm">
           <div className="flex justify-between font-bold text-sm text-gray-600 mb-1">
              <span>08:00 - HZH Qx3</span>
              <span>Dr. Mendoza</span>
           </div>
           <h3 className="text-lg font-bold text-slate-800">Jose Lopez</h3>
           <p className="text-blue-700 font-medium">RTU Próstata</p>
           <p className="text-xs text-gray-500 mt-1">Residente: Andres</p>
       </div>
    </div>
  );
};
export default SurgeryView;
