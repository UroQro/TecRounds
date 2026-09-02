import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, updateProfile } from 'firebase/auth';
import { auth } from '../firebase';

export default function Login() {
  const [loginIdentifier, setLoginIdentifier] = useState(''); 
  const [loginPassword, setLoginPassword] = useState('');
  
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [masterPass, setMasterPass] = useState('');
  
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const FAKE_DOMAIN = "@rounds.app"; 

  const handleAuth = async (e) => {
    e.preventDefault(); setError(''); setMsg('');
    
    try { 
        if (isRegistering) {
            if (masterPass !== 'urotec123') return setError('Clave maestra incorrecta.');
            if (!regEmail.includes('@')) return setError('Debes usar un correo electrónico real.');
            if (!regDisplayName) return setError('Debes ingresar tu nombre o firma.');
            
            const userCred = await createUserWithEmailAndPassword(auth, regEmail.trim(), regPassword);
            await updateProfile(userCred.user, { displayName: regDisplayName.trim().toUpperCase() });
            
        } else {
            const email = loginIdentifier.includes('@') ? loginIdentifier.trim() : loginIdentifier.trim().toUpperCase() + FAKE_DOMAIN;
            await signInWithEmailAndPassword(auth, email, loginPassword); 
        }
    } 
    catch (err) { 
        setError(isRegistering ? "Error al crear cuenta. Verifica que el correo sea válido y la contraseña tenga 6 caracteres." : "Credenciales incorrectas."); 
    }
  };

  const handleResetPassword = async () => {
      setError(''); setMsg('');
      if (!loginIdentifier.includes('@')) {
          return setError("Escribe tu correo electrónico real en la casilla para poder recuperar tu contraseña.");
      }
      try {
          await sendPasswordResetEmail(auth, loginIdentifier.trim());
          setMsg("¡Enlace de recuperación enviado! Revisa tu correo (y la bandeja de Spam).");
      } catch (err) {
          setError("Error: No se encontró este correo electrónico o está mal escrito.");
      }
  };

  const inputClass = "w-full p-3 border rounded outline-none focus:border-blue-500 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-slate-900 transition-colors">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-xl w-full max-w-sm border border-slate-200 dark:border-slate-700">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 text-center">Urología TecSalud</h1>
        
        {error && <div className="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-200 p-3 rounded text-sm mb-4 border border-red-200 dark:border-red-700">{error}</div>}
        {msg && <div className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-200 p-3 rounded text-sm mb-4 border border-green-200 dark:border-green-700">{msg}</div>}
        
        <form onSubmit={handleAuth} className="space-y-4">
            
            {!isRegistering && (
                <>
                    <div>
                        <label className="text-sm font-bold text-slate-600 dark:text-gray-400 block mb-1">Usuario o Correo</label>
                        <input type="text" value={loginIdentifier} onChange={e=>setLoginIdentifier(e.target.value)} className={inputClass} placeholder="Ej. zazueta@gmail.com" required />
                    </div>
                    <div>
                        <label className="text-sm font-bold text-slate-600 dark:text-gray-400 block mb-1">Contraseña</label>
                        <input type="password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} className={inputClass} required />
                    </div>
                </>
            )}

            {isRegistering && (
                <>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded border border-blue-100 dark:border-blue-800">
                        <label className="text-xs font-bold text-blue-800 dark:text-blue-400 block mb-1">Nombre de Usuario (Firma)</label>
                        <input type="text" value={regDisplayName} onChange={e=>setRegDisplayName(e.target.value)} className={`uppercase ${inputClass}`} placeholder="Ej. ZAZUETA" required />
                        <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">Este nombre aparecerá en todas tus notas.</p>
                    </div>
                    <div>
                        <label className="text-sm font-bold text-slate-600 dark:text-gray-400 block mb-1">Correo Electrónico</label>
                        <input type="email" value={regEmail} onChange={e=>setRegEmail(e.target.value)} className={inputClass} placeholder="Para recuperar contraseña" required />
                    </div>
                    <div>
                        <label className="text-sm font-bold text-slate-600 dark:text-gray-400 block mb-1">Contraseña</label>
                        <input type="password" value={regPassword} onChange={e=>setRegPassword(e.target.value)} className={inputClass} placeholder="Mínimo 6 caracteres" required minLength="6" />
                    </div>
                    <div>
                        <label className="text-sm font-bold text-slate-600 dark:text-gray-400 block mb-1">Clave Maestra</label>
                        <input type="password" value={masterPass} onChange={e=>setMasterPass(e.target.value)} className={inputClass} placeholder="***" required />
                    </div>
                </>
            )}

            <button type="submit" className="w-full bg-blue-600 dark:bg-blue-700 text-white py-3 rounded-lg font-bold hover:opacity-90 transition shadow-lg">
                {isRegistering ? 'Registrar Usuario' : 'Entrar'}
            </button>
        </form>
        
        <div className="mt-5 flex flex-col gap-3 text-center">
            {!isRegistering && (
                <button onClick={handleResetPassword} type="button" className="text-xs text-gray-500 dark:text-gray-400 font-semibold hover:underline">
                    ¿Olvidaste tu contraseña? (Ingresa tu correo arriba)
                </button>
            )}
            <button onClick={() => { setIsRegistering(!isRegistering); setError(''); setMsg(''); setMasterPass(''); }} type="button" className="text-sm text-blue-600 dark:text-blue-400 font-bold hover:underline">
                {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : 'Crear un usuario nuevo'}
            </button>
        </div>
      </div>
    </div>
  );
}
