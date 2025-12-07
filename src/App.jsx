import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import Login from './components/Login';
import Census from './components/Census';
import Surgery from './components/Surgery';
import Discharges from './components/Discharges';
import { LogOut, Activity, ClipboardList, Archive, Scissors } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('login'); // login, census, or, discharges
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) setView('census');
      else setView('login');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = () => {
    signOut(auth);
  };

  if (loading) return <div className="h-screen flex items-center justify-center">Cargando...</div>;

  if (!user) return <Login />;

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-100">
      {/* Navbar */}
      <header className="bg-blue-900 text-white p-3 shadow-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-2">
                <h1 className="text-lg font-bold">Rounds TecSalud</h1>
                <div className="text-xs flex items-center gap-2">
                    <span className="opacity-80">{user.email}</span>
                    <button onClick={handleLogout}><LogOut size={16}/></button>
                </div>
            </div>
            <nav className="flex space-x-1 overflow-x-auto pb-1">
                <NavBtn active={view === 'census'} onClick={() => setView('census')} icon={<ClipboardList size={16}/>} label="Censo" />
                <NavBtn active={view === 'or'} onClick={() => setView('or')} icon={<Scissors size={16}/>} label="Quirófano" />
                <NavBtn active={view === 'discharges'} onClick={() => setView('discharges')} icon={<Archive size={16}/>} label="Egresos" />
            </nav>
        </div>
      </header>

      <main className="flex-1 p-2 max-w-5xl mx-auto w-full">
        {view === 'census' && <Census user={user} />}
        {view === 'or' && <Surgery user={user} />}
        {view === 'discharges' && <Discharges />}
      </main>
    </div>
  );
}

const NavBtn = ({ active, onClick, icon, label }) => (
    <button onClick={onClick} 
       className={`flex items-center gap-1 px-4 py-2 rounded-full text-sm font-medium transition whitespace-nowrap
       ${active ? 'bg-white text-blue-900 shadow-sm' : 'bg-blue-800 text-blue-100 hover:bg-blue-700'}`}>
       {icon} {label}
    </button>
);
