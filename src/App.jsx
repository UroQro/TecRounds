import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, getDocs, writeBatch, arrayUnion } from 'firebase/firestore';
import Login from './components/Login';
import Census from './components/Census';
import Surgery from './components/Surgery';
import Discharges from './components/Discharges';
import AdminPanel from './components/AdminPanel';
import { LogOut, ClipboardList, Archive, Scissors } from 'lucide-react';
import { getLocalISODate } from './utils';
import { DEFAULT_RESIDENTS } from './constants';

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('login'); 
  const [loading, setLoading] = useState(true);
  const [dynamicResidents, setDynamicResidents] = useState(DEFAULT_RESIDENTS);

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

  useEffect(() => {
      const unsub = onSnapshot(doc(db, 'metadata', 'settings'), (docSnap) => {
          if (docSnap.exists() && docSnap.data().residents) {
              setDynamicResidents(docSnap.data().residents.sort());
          } else {
              setDoc(doc(db, 'metadata', 'settings'), { residents: DEFAULT_RESIDENTS, bannedUsers: [], knownUsers: [] }, { merge: true });
          }
      });
      return () => unsub();
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
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
          const snap = await getDoc(doc(db, 'metadata', 'settings'));
          const data = snap.exists() ? snap.data() : {};
          
          if (data.bannedUsers?.includes(currentUser.email)) {
              alert("Acceso denegado. Este usuario ha sido dado de baja por el administrador.");
              await signOut(auth);
              setUser(null);
              setView('login');
              setLoading(false);
              return;
          }

          const knownUsers = data.knownUsers || [];
          if (!knownUsers.includes(currentUser.email)) {
              await setDoc(doc(db, 'metadata', 'settings'), { knownUsers: arrayUnion(currentUser.email) }, { merge: true });
          }

          setUser(currentUser);
          setView(prev => prev === 'login' ? 'census' : prev); 
          checkDailyReset(); 
      } else { 
          setUser(null);
          setView(prev => prev === 'admin' ? 'admin' : 'login'); 
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = () => { signOut(auth); setView('login'); };
  const getUserName = () => user && user.email ? user.email.split('@')[0] : "";

  if (loading) return <div className="h-screen flex items-center justify-center bg-gray-100 dark:bg-slate-900 dark:text-white">Cargando...</div>;

  if (!user) {
      if (view === 'admin') return <AdminPanel onClose={() => setView('login')} />;
      return <Login onGoAdmin={() => setView('admin')} />;
  }

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
        {view === 'census' && <Census user={user} dynamicResidents={dynamicResidents} />}
        {view === 'or' && <Surgery user={user} dynamicResidents={dynamicResidents} />}
        {view === 'discharges' && <Discharges />}
      </main>
      <footer className="bg-gray-200 dark:bg-black p-3 text-center text-[10px] text-slate-500 dark:text-slate-500 border-t border-gray-300 dark:border-gray-800 pb-8 flex justify-center items-center gap-2">
        <span>© 2026 Rosenzweig/Gemini</span> <span className="opacity-50">v57.0</span>
      </footer>
    </div>
  );
}
const NavBtn = ({ active, onClick, label, icon }) => (<button onClick={onClick} className={`flex items-center gap-1 px-4 py-2 rounded-full text-sm font-bold transition whitespace-nowrap ${active ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>{icon} {label}</button>);
