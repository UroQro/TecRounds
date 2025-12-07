import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Census from './components/Census';
import SurgeryView from './components/SurgeryView';
import Discharges from './components/Discharges';
import PatientDetail from './components/PatientDetail';
import { LogOut, User } from 'lucide-react';

// NOTA: Para este demo usaremos estado local para la navegación,
// pero Firebase ya está configurado en src/firebase.js para futuras llamadas a DB.

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('login'); // login, census, or, discharges
  const [selectedPatient, setSelectedPatient] = useState(null);

  // Mock Data Global (En producción esto vendría de Firestore)
  const [patients, setPatients] = useState([
    { 
       id: '1', bed: '304', type: 'HO', name: 'Maria Refugio', doctor: 'Dr. Olvera', resident: 'Andres', 
       admissionDate: '2025-11-20', dob: '1965-05-12', diagnosis: 'Pielonefritis Enfisematosa',
       status: 'pending', checklist: [{task: 'TAC Control', done: false}], notes: []
    }
  ]);

  const handleLogin = (username) => {
    setUser({ name: username });
    setView('census');
  };

  const updatePatient = (updatedP) => {
    setPatients(patients.map(p => p.id === updatedP.id ? updatedP : p));
    setSelectedPatient(updatedP);
  };

  if (view === 'login') {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-100">
      {/* Header */}
      <header className="bg-blue-900 text-white p-3 shadow-md sticky top-0 z-50">
        <div className="flex justify-between items-center mb-2 max-w-4xl mx-auto w-full">
            <h1 className="text-lg font-bold">Rounds TecSalud</h1>
            <div className="text-xs flex items-center gap-2">
               <User size={14} /> {user?.name} 
               <button onClick={() => setView('login')}><LogOut size={14}/></button>
            </div>
        </div>
        <nav className="flex space-x-2 overflow-x-auto text-sm max-w-4xl mx-auto w-full pb-1">
          <button onClick={() => {setSelectedPatient(null); setView('census')}} 
             className={`px-4 py-1 rounded-full transition ${view === 'census' ? 'bg-white text-blue-900 font-bold' : 'bg-blue-800 text-blue-100'}`}>
             Censo
          </button>
          <button onClick={() => {setSelectedPatient(null); setView('or')}} 
             className={`px-4 py-1 rounded-full transition ${view === 'or' ? 'bg-white text-blue-900 font-bold' : 'bg-blue-800 text-blue-100'}`}>
             Quirófano
          </button>
          <button onClick={() => {setSelectedPatient(null); setView('discharges')}} 
             className={`px-4 py-1 rounded-full transition ${view === 'discharges' ? 'bg-white text-blue-900 font-bold' : 'bg-blue-800 text-blue-100'}`}>
             Egresos
          </button>
        </nav>
      </header>

      <main className="flex-1 p-2 max-w-4xl mx-auto w-full relative">
        {selectedPatient ? (
           <PatientDetail 
             patient={selectedPatient} 
             onBack={() => setSelectedPatient(null)}
             onUpdate={updatePatient}
             user={user}
           />
        ) : (
           <>
             {view === 'census' && (
                <Census 
                  patients={patients} 
                  setPatients={setPatients} 
                  onSelect={setSelectedPatient} 
                />
             )}
             {view === 'or' && <SurgeryView />}
             {view === 'discharges' && <Discharges patients={patients} />}
           </>
        )}
      </main>
    </div>
  );
}

export default App;
