import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [masterPass, setMasterPass] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const FAKE_DOMAIN = "@rounds.app"; 

  const handleAuth = async (e) => {
    e.preventDefault(); setError(''); setMsg('');
    
    // LOGIN HÍBRIDO: Si tiene '@', es correo real. Si no, le pegamos el dominio falso.
    const email = username.includes('@') ? username.trim() : username.trim().toUpperCase() + FAKE_DOMAIN;
    
    if (isRegistering) {
        if (masterPass !== 'urotec123') {
            setError('Clave maestra incorrecta.');
            return;
        }
        if (!username.includes('@')) {
            setError('Para cuentas nuevas es OBLIGATORIO usar un correo electrónico real.');
            return;
        }
    }

    try { 
        if (isRegistering) {
            await createUserWithEmailAndPassword(auth, email, password);
        } else {
            await signInWithEmailAndPassword(auth, email, password); 
        }
    } 
    catch (err) { 
        setError(isRegistering ? "Error al crear cuenta. Usa una contraseña de al menos 6 caracteres." : "Credenciales incorrectas."); 
    }
  };

  const handleResetPassword = async () => {
      setError(''); setMsg('');
      if (!username.includes('@')) {
          return setError("Escribe tu correo electrónico real en la barra superior para recuperar la contraseña.");
      }
      try {
          await sendPasswordResetEmail(auth, username.trim());
          setMsg("¡Enlace de recuperación enviado! Revisa tu bandeja de entrada o carpeta de Spam.");
      } catch (err) {
          setError("Error: Verifica que el correo esté bien escrito y haya sido registrado.");
      }
  };

  // Se quitó el 'uppercase' forzado visualmente para que los correos reales se vean normales
  const inputClass = "w-full p-3 border rounded outline-none focus:border-blue-500 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-slate-900 transition-colors">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-xl w-full max-w-sm border border-slate-200 dark:border-slate-700">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 text-center">Urología TecSalud</h1>
        
        {error && <div className="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-200 p-3 rounded text-sm mb-4 border border-red-200 dark:border-red-700">{error}</div>}
        {msg && <div className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-200 p-3 rounded text-sm mb-4 border border-green-200 dark:border-green-700">{msg}</div>}
        
        <form onSubmit={handleAuth} className="space-y-4">
            <div>
                <label className="text-sm font-bold text-slate-600 dark:text-gray-400 block mb-1">Usuario / Correo Electrónico</label>
                <input type="text" value={username} onChange={e=>setUsername(e.target.value)} className={inputClass} placeholder="Ej. zazueta@gmail.com" required />
            </div>
            <div>
                <label className="text-sm font-bold text-slate-600 dark:text-gray-400 block mb-1">Contraseña</label>
                <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className={inputClass} required minLength="6" />
            </div>
            
            {isRegistering && (
                <div>
                    <label className="text-sm font-bold text-slate-600 dark:text-gray-400 block mb-1">Clave Maestra</label>
                    <input type="password" value={masterPass} onChange={e=>setMasterPass(e.target.value)} className={inputClass} placeholder="Requerida para registro" required />
                </div>
            )}

            <button type="submit" className="w-full bg-blue-600 dark:bg-blue-700 text-white py-3 rounded-lg font-bold hover:opacity-90 transition shadow-lg">
                {isRegistering ? 'Crear Cuenta' : 'Entrar'}
            </button>
        </form>
        
        <div className="mt-5 flex flex-col gap-3 text-center">
            {!isRegistering && (
                <button onClick={handleResetPassword} className="text-xs text-gray-500 dark:text-gray-400 font-semibold hover:underline">
                    ¿Olvidaste tu contraseña?
                </button>
            )}
            <button onClick={() => { setIsRegistering(!isRegistering); setError(''); setMsg(''); setMasterPass(''); }} className="text-sm text-blue-600 dark:text-blue-400 font-bold hover:underline">
                {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : 'Crear un usuario nuevo'}
            </button>
        </div>
      </div>
    </div>
  );
}
