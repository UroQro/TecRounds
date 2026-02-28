import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Lock } from 'lucide-react';

export default function Login({ onGoAdmin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const FAKE_DOMAIN = "@rounds.app"; 

  const handleLogin = async (e) => {
    e.preventDefault(); setError('');
    const email = username.trim() + FAKE_DOMAIN;
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (err) { setError("Credenciales incorrectas."); }
  };

  const inputClass = "w-full p-3 border rounded outline-none uppercase focus:border-blue-500 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-slate-900 transition-colors">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-xl w-full max-w-sm border border-slate-200 dark:border-slate-700 relative">
        <button onClick={onGoAdmin} className="absolute top-4 right-4 text-gray-400 opacity-10 hover:opacity-100 transition-opacity p-2">
            <Lock size={16} />
        </button>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 text-center">Urología TecSalud</h1>
        {error && <div className="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-200 p-3 rounded text-sm mb-4 border border-red-200 dark:border-red-700">{error}</div>}
        <form onSubmit={handleLogin} className="space-y-4">
            <div><label className="text-sm font-bold text-slate-600 dark:text-gray-400 block mb-1">Usuario</label><input type="text" value={username} onChange={e=>setUsername(e.target.value)} className={inputClass} placeholder="EJ. ANDRES" required /></div>
            <div><label className="text-sm font-bold text-slate-600 dark:text-gray-400 block mb-1">Contraseña</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} className={inputClass.replace('uppercase','')} required /></div>
            <button type="submit" className="w-full bg-blue-600 dark:bg-blue-700 text-white py-3 rounded-lg font-bold hover:opacity-90 transition shadow-lg">Entrar</button>
        </form>
      </div>
    </div>
  );
}
