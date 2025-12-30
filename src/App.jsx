import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import Login from './components/Login';
import Census from './components/Census';
import Surgery from './components/Surgery';
import Discharges from './components/Discharges';
import { LogOut, ClipboardList, Archive, Scissors } from 'lucide-react';
import { getLocalISODate } from './utils';

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('login'); 
  const [loading, setLoading] = useState(true);

  // AUTO THEME: Day (8-20) Light, Night (20-8) Dark
  useEffect(() => {
      const updateTheme = () => {
          const hour = new Date().getHours();
          const isNight = hour >= 20 || hour < 8; 
          if (isNight) document.documentElement.classList.add('dark');
          else document.documentElement.classList.remove('dark');
      };
      updateTheme(); 
      const interval = setInterval(updateTheme, 60000); 
      return () => clearInterval(interval);
  }, []);

  const checkDailyReset = async () => {
      const todayStr = getLocalISODate();
      const metaRef = doc(db, 'metadata', 'daily_reset');
      try {
          const metaSnap = await getDoc(metaRef);
          if (!metaSnap.exists() || metaSnap.data().date !== todayStr) {
              const batch = writeBatch(db);
              const q = query(collection(db, 'patients'), where('status', '==', 'done'));
              const snapshot = await getDocs(q);
              snapshot.docs.forEach(doc => { batch.update(doc.ref, { status: 'pending' }); });
              batch.set(metaRef, { date: todayStr });
              await batch.commit();
          }
      } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) { setView('census'); checkDailyReset(); } else { setView('login'); }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = () => signOut(auth);
  const getUserName = () => user && user.email ? user.email.split('@')[0] : "";

  if (loading) return <div className="h-screen flex items-center justify-center bg-gray-100 dark:bg-slate-900 dark:text-white">Cargando...</div>;
  if (!user) return <Login />;

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gray-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-500">
      <header className="bg-black text-white p-3 shadow-md sticky top-0 z-50 pt-safe">
        <div className="max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-2">
                <h1 className="text-lg font-bold">Urología TecSalud</h1>
                <div className="text-xs flex items-center gap-2 font-mono bg-gray-800 px-2 py-1 rounded">
                    <span className="uppercase">{getUserName()}</span>
                    <button onClick={handleLogout}><LogOut size={14}/></button>
                </div>
            </div>
            <nav className="flex space-x-2 overflow-x-auto pb-1">
                <NavBtn active={view==='census'} onClick={()=>setView('census')} label="Censo" icon={<ClipboardList size={16}/>} />
                <NavBtn active={view==='or'} onClick={()=>setView('or')} label="Quirófano" icon={<Scissors size={16}/>} />
                <NavBtn active={view==='discharges'} onClick={()=>setView('discharges')} label="Egresos" icon={<Archive size={16}/>} />
            </nav>
        </div>
      </header>
      <main className="flex-1 p-2 max-w-5xl mx-auto w-full pb-safe">
        {view === 'census' && <Census user={user} />}
        {view === 'or' && <Surgery user={user} />}
        {view === 'discharges' && <Discharges />}
      </main>
      <footer className="bg-gray-200 dark:bg-black p-3 text-center text-[10px] text-slate-500 dark:text-slate-500 border-t border-gray-300 dark:border-gray-800 pb-8">© 2026 Rosenzweig/Gemini</footer>
    </div>
  );
}
const NavBtn = ({ active, onClick, label, icon }) => (<button onClick={onClick} className={`flex items-center gap-1 px-4 py-2 rounded-full text-sm font-bold transition whitespace-nowrap ${active ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>{icon} {label}</button>);
