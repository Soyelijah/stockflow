import React, { useState, useEffect } from "react";
import { 
  Users, 
  Plus, 
  Search, 
  MoreVertical, 
  Mail, 
  Phone, 
  MapPin, 
  Briefcase,
  X,
  Edit2,
  Trash2,
  UserPlus
} from "lucide-react";
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc 
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { cn, formatChileanPhone } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { ModernAlert } from "./ui/ModernAlert";

export function Suppliers() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Alert Modal State
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "warning" | "delete" | "info";
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info"
  });

  const [formData, setFormData] = useState({
    name: "",
    contactName: "",
    email: "",
    phone: "",
    category: "",
    address: ""
  });

  useEffect(() => {
    const q = query(collection(db, "suppliers"));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSuppliers(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "suppliers");
    });
    return unsub;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingSupplier) {
        await updateDoc(doc(db, "suppliers", editingSupplier.id), formData);
      } else {
        await addDoc(collection(db, "suppliers"), formData);
      }
      setIsModalOpen(false);
      setEditingSupplier(null);
      setFormData({ name: "", contactName: "", email: "", phone: "", category: "", address: "" });
      setAlertConfig({
        isOpen: true,
        type: "success",
        title: editingSupplier ? "¡Actualizado!" : "¡Éxito!",
        message: editingSupplier ? "Proveedor actualizado correctamente." : "Nuevo proveedor registrado."
      });
    } catch (err) {
      setAlertConfig({
        isOpen: true,
        type: "error",
        title: "Error",
        message: "No se pudo guardar la información del proveedor."
      });
      handleFirestoreError(err, OperationType.WRITE, "suppliers");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (supplier: any) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contactName: supplier.contactName || "",
      email: supplier.email || "",
      phone: formatChileanPhone(supplier.phone || ""),
      category: supplier.category || "",
      address: supplier.address || ""
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    setAlertConfig({
      isOpen: true,
      type: "delete",
      title: "¿Eliminar Proveedor?",
      message: `¿Realmente desea eliminar a "${name}"? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "suppliers", id));
          setAlertConfig(prev => ({
            ...prev,
            isOpen: true,
            type: "success",
            title: "Eliminado",
            message: "El proveedor ha sido borrado exitosamente.",
            onConfirm: undefined
          }));
        } catch (err: any) {
          console.error(err);
          setAlertConfig({
            isOpen: true,
            type: "error",
            title: "Error de Servidor",
            message: "No tienes permisos para eliminar este proveedor."
          });
          handleFirestoreError(err, OperationType.DELETE, "suppliers");
        }
      }
    });
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.contactName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight">Proveedores</h1>
          <p className="text-slate-500 font-medium">Gestiona tus contactos comerciales y fuentes de abastecimiento.</p>
        </div>
        <button 
          onClick={() => {
            setEditingSupplier(null);
            setFormData({ name: "", contactName: "", email: "", phone: "+56 ", category: "", address: "" });
            setIsModalOpen(true);
          }}
          className="bg-indigo-600 text-white font-bold px-6 py-4 rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center space-x-2"
        >
          <UserPlus size={20} />
          <span>Nuevo Proveedor</span>
        </button>
      </header>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex items-center space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nombre, contacto o rubro..."
            className="w-full bg-slate-50 border-none rounded-xl py-3 pl-12 focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Suppliers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {filteredSuppliers.map((supplier) => (
            <motion.div
              layout
              key={supplier.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-indigo-100/50 transition-colors" />
              
              <div className="flex justify-between items-start mb-6 relative z-10">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-100">
                    {supplier.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 tracking-tight">{supplier.name}</h3>
                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg uppercase tracking-widest">
                      {supplier.category || "General"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(supplier)} className="p-2 hover:bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors">
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(supplier.id, supplier.name);
                    }} 
                    className="p-2 hover:bg-rose-100 text-rose-400 hover:text-rose-600 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-4 relative z-10">
                <div className="flex items-center space-x-3 text-slate-500">
                  <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center">
                    <Users size={14} />
                  </div>
                  <span className="text-xs font-bold">{supplier.contactName || "Sin contacto directo"}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center space-x-3 text-slate-500">
                    <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center">
                      <Phone size={14} />
                    </div>
                    <span className="text-[10px] font-black">{formatChileanPhone(supplier.phone || "") || "N/A"}</span>
                  </div>
                  <div className="flex items-center space-x-3 text-slate-500">
                    <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center">
                      <Mail size={14} />
                    </div>
                    <span className="text-[10px] font-black truncate">{supplier.email || "N/A"}</span>
                  </div>
                </div>

                <div className="flex items-start space-x-3 text-slate-500">
                  <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center mt-0.5">
                    <MapPin size={14} />
                  </div>
                  <span className="text-[10px] font-bold leading-relaxed">{supplier.address || "Sin dirección registrada"}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {filteredSuppliers.length === 0 && (
        <div className="bg-white rounded-[3rem] p-20 text-center border-2 border-dashed border-slate-100">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
            <Users size={40} />
          </div>
          <h3 className="text-xl font-black text-slate-800 mb-2">No tienes proveedores registrados</h3>
          <p className="text-slate-500 font-medium">Comienza agregando los contactos de tus distribuidores.</p>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[90vh]"
            >
              <div className="p-6 md:p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50 shrink-0">
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-slate-800">{editingSupplier ? "Editar Proveedor" : "Nuevo Proveedor"}</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Completa los detalles</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2.5 hover:bg-slate-100 rounded-2xl transition-all"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 text-slate-700">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre de la Empresa</label>
                  <input 
                    required
                    type="text" 
                    className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                    placeholder="Ej: Distribuidora Nacional"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Persona de Contacto</label>
                    <input 
                      type="text" 
                      className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                      placeholder="Nombre del agente"
                      value={formData.contactName}
                      onChange={e => setFormData({...formData, contactName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rubro / Categoría</label>
                    <input 
                      type="text" 
                      className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                      placeholder="Ej: Abarrotes"
                      value={formData.category}
                      onChange={e => setFormData({...formData, category: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono</label>
                    <input 
                      type="tel" 
                      className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                      placeholder="+56 9 XXXX XXXX"
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: formatChileanPhone(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                    <input 
                      type="email" 
                      className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                      placeholder="ventas@proveedor.com"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dirección / Oficina</label>
                  <input 
                    type="text" 
                    className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                    placeholder="Casa matriz o bodega"
                    value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                  />
                </div>

                <div className="pt-6 flex space-x-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 h-16 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-[2] h-16 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center justify-center space-x-2"
                  >
                    {isSubmitting ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    ) : (
                      <>
                        <Plus size={16} />
                        <span>{editingSupplier ? "Guardar Cambios" : "Agregar Proveedor"}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ModernAlert 
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={alertConfig.onConfirm}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        confirmText={alertConfig.type === "delete" ? "Eliminar" : "Aceptar"}
      />
    </div>
  );
}
