import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

export default function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [masterPass, setMasterPass] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError("Error al entrar: Verifica tus credenciales.");
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (masterPass !== 'urotec123') {
      setError("Contraseña maestra incorrecta.");
      return;
    }
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-200">
      <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-sm">
        <h1 className="text-2xl font-bold text-blue-900 mb-6 text-center">Rounds TecSalud</h1>
        
        {error && <div className="bg-red-100 text-red-700 p-2 rounded text-sm mb-4">{error}</div>}

        <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
            {isRegistering && (
                <div className="bg-red-50 p-2 rounded border border-red-100">
                    <label className="text-xs font-bold text-red-800">Contraseña Maestra</label>
                    <input type="password" value={masterPass} onChange={e=>setMasterPass(e.target.value)} 
                           className="w-full p-2 border rounded mt-1" placeholder="Solo residentes" required />
                </div>
            )}
            
            <div>
                <label className="text-sm font-bold text-gray-600">Email</label>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} 
                       className="w-full p-3 border rounded bg-slate-50" placeholder="usuario@tecsalud.mx" required />
            </div>
            
            <div>
                <label className="text-sm font-bold text-gray-600">Contraseña</label>
                <input type="password" value={password} onChange={e=>setPassword(e.target.value)} 
                       className="w-full p-3 border rounded bg-slate-50" placeholder="******" required />
            </div>

            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition">
                {isRegistering ? 'Crear Usuario' : 'Iniciar Sesión'}
            </button>
        </form>

        <div className="mt-4 text-center">
            <button onClick={() => {setIsRegistering(!isRegistering); setError('')}} className="text-sm text-blue-500 hover:underline">
                {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : 'Crear usuario nuevo'}
            </button>
        </div>
      </div>
    </div>
  );
}
