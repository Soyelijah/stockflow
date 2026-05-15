import React, { useState, useEffect } from "react";
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  serverTimestamp
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { 
  Plus, 
  X, 
  Save, 
  Tag, 
  Trash2, 
  Edit2,
  Palette,
  LayoutGrid
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

const COLORS = [
  { name: "Indigo", value: "bg-indigo-500", text: "text-indigo-600", light: "bg-indigo-50" },
  { name: "Emerald", value: "bg-emerald-500", text: "text-emerald-600", light: "bg-emerald-50" },
  { name: "Rose", value: "bg-rose-500", text: "text-rose-600", light: "bg-rose-50" },
  { name: "Amber", value: "bg-amber-500", text: "text-amber-600", light: "bg-amber-50" },
  { name: "Sky", value: "bg-sky-500", text: "text-sky-600", light: "bg-sky-50" },
  { name: "Violet", value: "bg-violet-500", text: "text-violet-600", light: "bg-violet-50" },
];

export function CategoryManager({ onClose }: { onClose: () => void }) {
  const [categories, setCategories] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: COLORS[0].value
  });

  useEffect(() => {
    const q = query(collection(db, "categories"), orderBy("name"));
    const unsub = onSnapshot(q, (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "categories");
    });
    return unsub;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, "categories", editingId), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        setEditingId(null);
      } else {
        await addDoc(collection(db, "categories"), {
          ...formData,
          createdAt: serverTimestamp()
        });
      }
      setFormData({ name: "", description: "", color: COLORS[0].value });
      setIsAdding(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "categories");
    }
  };

  const handleEdit = (cat: any) => {
    setEditingId(cat.id);
    setFormData({
      name: cat.name,
      description: cat.description || "",
      color: cat.color || COLORS[0].value
    });
    setIsAdding(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`¿Eliminar categoría "${name}"? Los productos asociados quedarán sin categoría.`)) return;
    try {
      await deleteDoc(doc(db, "categories", id));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "delete category");
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Tag size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Gestión de Categorías</h2>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-0.5">Organización de Catálogo</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {isAdding ? (
            <form onSubmit={handleSubmit} className="bg-slate-50 p-8 rounded-[2rem] space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Nombre de Categoría</label>
                  <input 
                    required
                    className="w-full h-14 bg-white border border-slate-200 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="Ej: Bebidas, Snacks..."
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Color Distintivo</label>
                  <div className="flex flex-wrap gap-3">
                    {COLORS.map(c => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setFormData({...formData, color: c.value})}
                        className={cn(
                          "w-10 h-10 rounded-full transition-all border-4",
                          c.value,
                          formData.color === c.value ? "border-slate-800 scale-110 shadow-lg" : "border-transparent opacity-60 hover:opacity-100"
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-4">
                <button 
                  type="button" 
                  onClick={() => setIsAdding(false)}
                  className="flex-1 py-4 bg-white border border-slate-200 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-100 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center space-x-2"
                >
                  <Save size={18} />
                  <span>{editingId ? "Actualizar" : "Guardar Categoría"}</span>
                </button>
              </div>
            </form>
          ) : (
            <button 
              onClick={() => {
                setEditingId(null);
                setFormData({ name: "", description: "", color: COLORS[0].value });
                setIsAdding(true);
              }}
              className="w-full py-6 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center text-slate-400 hover:text-indigo-500 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all"
            >
              <Plus size={32} className="mb-2" />
              <span className="text-xs font-black uppercase tracking-widest">Añadir Nueva Categoría</span>
            </button>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categories.map(cat => (
              <div key={cat.id} className="bg-white border border-slate-100 p-5 rounded-3xl flex items-center justify-between group hover:shadow-lg transition-all hover:-translate-y-1">
                <div className="flex items-center space-x-4">
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-inner", cat.color || "bg-slate-500")}>
                    <Tag size={20} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 text-sm">{cat.name}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Catálogo Activo</p>
                  </div>
                </div>
                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(cat)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(cat.id, cat.name)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
