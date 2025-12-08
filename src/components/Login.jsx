import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

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
    
    try { 
        const userCredential = await createUserWithEmailAndPassword(auth, email, password); 
        // Crear registro en colección 'users' para poder listarlos en el admin panel
        await setDoc(doc(db, "users", userCredential.user.uid), {
            name: username.toUpperCase(),
            email: email,
            role: 'resident',
            createdAt: new Date().toISOString()
        });
    } 
    catch (err) { setError(err.message); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-200">
      <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-sm">
        <h1 className="text-2xl font-bold text-blue-900 mb-6 text-center">Rounds TecSalud</h1>
        {error && <div className="bg-red-100 text-red-700 p-3 rounded text-sm mb-4 border border-red-200">{error}</div>}
        <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
            {isRegistering && (
                <div className="bg-red-50 p-3 rounded border border-red-100">
                    <label className="text-xs font-bold text-red-800 block mb-1">Clave Maestra</label>
                    <input type="password" value={masterPass} onChange={e=>setMasterPass(e.target.value)} 
                           className="w-full p-2 border border-red-200 rounded text-sm bg-white" placeholder="********" required />
                </div>
            )}
            <div>
                <label className="text-sm font-bold text-gray-600 block mb-1">Usuario</label>
                <input type="text" value={username} onChange={e=>setUsername(e.target.value)} 
                       className="w-full p-3 border rounded bg-slate-50 outline-none uppercase" placeholder="EJ. ANDRES" required />
            </div>
            <div>
                <label className="text-sm font-bold text-gray-600 block mb-1">Contraseña</label>
                <input type="password" value={password} onChange={e=>setPassword(e.target.value)} 
                       className="w-full p-3 border rounded bg-slate-50 outline-none" required />
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow-lg">
                {isRegistering ? 'Crear Usuario' : 'Entrar'}
            </button>
        </form>
        <div className="mt-6 text-center pt-4 border-t">
            <button onClick={() => {setIsRegistering(!isRegistering); setError('')}} className="text-sm text-blue-500 font-semibold hover:underline">
                {isRegistering ? '← Regresar al Login' : 'Crear usuario nuevo'}
            </button>
        </div>
      </div>
    </div>
  );
}
