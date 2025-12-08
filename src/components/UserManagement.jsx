import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { Trash2, User } from 'lucide-react';

export default function UserManagement() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const handleDelete = async (u) => {
      if(confirm(`¿Eliminar a ${u.name} de la lista del equipo?`)) {
          await deleteDoc(doc(db, "users", u.id));
      }
  };

  return (
    <div className="p-4 max-w-lg mx-auto">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><User/> Gestión de Usuarios</h2>
        <div className="bg-white rounded shadow border">
            {users.length === 0 ? (
                <div className="p-4 text-center text-gray-400">No hay usuarios registrados en el directorio.</div>
            ) : (
                <ul className="divide-y">
                    {users.map(u => (
                        <li key={u.id} className="p-3 flex justify-between items-center hover:bg-slate-50">
                            <div><p className="font-bold text-slate-700">{u.name}</p><p className="text-xs text-gray-400">{u.email}</p></div>
                            <button onClick={()=>handleDelete(u)} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={16}/></button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
        <p className="text-[10px] text-gray-400 mt-4 text-center p-2 bg-yellow-50 rounded border border-yellow-100">
            Nota: Al eliminar un usuario aquí, se quita de la lista visual. Para revocar el acceso (Login) permanentemente, el administrador debe deshabilitar la cuenta en la Consola de Firebase.
        </p>
    </div>
  );
}
