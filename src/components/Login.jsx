import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

export default function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [masterPass, setMasterPass] = useState('');
  const [error, setError] = useState('');
  const FAKE_DOMAIN = "@rounds.app"; 

  const handleLogin = async (e) => {
    e.preventDefault(); setError('');
    const email = username.trim() + FAKE_DOMAIN;
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (err) { setError("Credenciales incorrectas."); }
  };

  const handleRegister = async (e) => {
    e.preventDefault(); setError('');
    if (masterPass !== 'urotec123') return setError("Contraseña maestra incorrecta.");
    const email = username.trim() + FAKE_DOMAIN;
    try { await createUserWithEmailAndPassword(auth, email, password); } 
    catch (err) { setError(err.message); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-200">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-100">
        <h1 className="text-3xl font-extrabold text-blue-900 mb-2 text-center tracking-tight">Urología TecSalud</h1>
        <p className="text-center text-slate-400 text-sm mb-6">Acceso Residentes y Adscritos</p>
        
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 border border-red-100 text-center font-medium">{error}</div>}
        
        <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
            {isRegistering && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <label className="text-xs font-bold text-slate-500 block mb-1 uppercase">Clave Maestra</label>
                    <input type="password" value={masterPass} onChange={e=>setMasterPass(e.target.value)} 
                           className="w-full p-2 border border-slate-300 rounded bg-white focus:ring-2 focus:ring-blue-500" placeholder="••••••••" required />
                </div>
            )}
            <div><label className="text-sm font-bold text-slate-700 block mb-1">Usuario</label><input type="text" value={username} onChange={e=>setUsername(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 uppercase font-medium" placeholder="EJ. ANDRES" required /></div>
            <div><label className="text-sm font-bold text-slate-700 block mb-1">Contraseña</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500" required /></div>
            <button type="submit" className="w-full bg-blue-700 text-white py-3.5 rounded-lg font-bold hover:bg-blue-800 transition shadow-lg active:scale-95">{isRegistering ? 'Registrar Usuario' : 'Iniciar Sesión'}</button>
        </form>
        <div className="mt-6 text-center pt-4 border-t border-slate-100"><button onClick={() => {setIsRegistering(!isRegistering); setError('')}} className="text-sm text-blue-600 font-semibold hover:underline hover:text-blue-800">{isRegistering ? '← Volver al Login' : 'Crear cuenta nueva'}</button></div>
      </div>
    </div>
  );
}
