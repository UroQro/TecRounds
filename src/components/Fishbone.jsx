import React from 'react';

const Fishbone = ({ labs, onChange, readOnly = false }) => {
  const handleChange = (field, val) => {
    if(!readOnly && onChange) onChange({...labs, [field]: val});
  };

  const Input = ({ f, ph, cls = "" }) => (
    <input 
      value={labs[f] || ''} 
      onChange={e => handleChange(f, e.target.value)} 
      placeholder={ph}
      disabled={readOnly}
      className={`w-full text-center bg-transparent text-xs p-1 focus:outline-none ${cls}`} 
    />
  );

  return (
    <div className="border border-gray-300 bg-white p-2 rounded max-w-[240px] mx-auto select-none">
       {/* Top Row: Na | Cl | BUN */}
       <div className="grid grid-cols-3 border-b-2 border-black pb-1">
          <Input f="na" ph="Na" />
          <Input f="cl" ph="Cl" cls="border-l-2 border-r-2 border-black" />
          <Input f="bun" ph="BUN" />
       </div>
       {/* Middle Line + Glu */}
       <div className="relative flex items-center h-[2px] bg-black my-2">
           <span className="absolute left-[-25px] font-bold text-sm">{labs.glu || 'Glu'}</span>
           {!readOnly && <input className="absolute left-[-30px] w-[25px] opacity-0" onChange={e => handleChange('glu', e.target.value)} />}
       </div>
       {/* Bottom Row: K | HCO3 | Cr */}
       <div className="grid grid-cols-3 border-t-2 border-black pt-1">
          <Input f="k" ph="K" />
          <Input f="co2" ph="HCO3" cls="border-l-2 border-r-2 border-black" />
          <Input f="cr" ph="Cr" />
       </div>
    </div>
  );
};
export default Fishbone;
