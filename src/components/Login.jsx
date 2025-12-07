import React, { useState } from 'react';

const Login = ({ onLogin }) => {
  const [mode, setMode] = useState('login'); // login, register
  const [form, setForm] = useState({ user: '', pass: '', master: '' });

  const MASTER_PASS = "urotec123";

  const handleLogin = () => {
    if(form.user && form.pass) onLogin(form.user);
  };

  const handleRegister = () => {
    if(form.master === MASTER_PASS && form.user) {
        alert("Usuario creado correctamente (Simulado)");
        setMode('login');
    } else {
        alert("Contraseña maestra incorrecta");
    }
  };

  return (
    <div className="min-h-screen bg-slate-200 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-sm">
        <h1 className="text-2xl font-bold text-blue-900 mb-6 text-center">Rounds TecSalud</h1>
        
        {mode === 'login' ? (
          <div className="space-y-4">
            <input placeholder="Usuario" className="w-full p-3 border rounded bg-slate-50" 
               onChange={e => setForm({...form, user: e.target.value})} />
            <input type="password" placeholder="Contraseña" className="w-full p-3 border rounded bg-slate-50" 
               onChange={e => setForm({...form, pass: e.target.value})} />
            <button onClick={handleLogin} className="w-full bg-blue-600 text-white py-3 rounded font-bold hover:bg-blue-700">
               Iniciar Sesión
            </button>
            <div className="text-center pt-2">
               <button onClick={()=>setMode('register')} className="text-sm text-blue-500">Crear cuenta nueva</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
             <div className="bg-red-50 p-3 rounded border border-red-100">
               <label className="text-xs font-bold text-red-500 uppercase">Seguridad</label>
               <input type="password" placeholder="Contraseña Maestra" className="w-full p-2 mt-1 border border-red-200 rounded" 
                  onChange={e => setForm({...form, master: e.target.value})} />
             </div>
             <input placeholder="Nuevo Usuario" className="w-full p-3 border rounded" 
                onChange={e => setForm({...form, user: e.target.value})} />
             <input type="password" placeholder="Nueva Contraseña" className="w-full p-3 border rounded" 
                onChange={e => setForm({...form, pass: e.target.value})} />
             <div className="flex gap-2">
                 <button onClick={handleRegister} className="flex-1 bg-green-600 text-white py-2 rounded">Registrar</button>
                 <button onClick={()=>setMode('login')} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded">Cancelar</button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
