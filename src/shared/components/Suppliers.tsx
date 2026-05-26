import React, { useState, useEffect, useRef, useId } from "react";
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
  UserPlus,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { 
  collection, 
  query, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  orderBy,
  limit,
  getDocs,
  startAfter
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../../lib/firebase";
import { cn, formatChileanPhone, INPUT_MAX } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { ModernAlert } from "./ui/ModernAlert";

export function Suppliers() {
  const fid = useId();
  const fId = (s: string) => `${fid}-${s}`;
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

  const PAGE_SIZE = 25;
  const [currentPage, setCurrentPage] = useState(1);
  const cursorsRef = useRef<any[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchSuppliers = async (direction: "init" | "next" | "prev" = "init") => {
    setLoading(true);
    try {
      let q = query(collection(db, "suppliers"), orderBy("name"));

      let targetPage = currentPage;
      if (direction === "next") {
        targetPage = currentPage + 1;
        const lastVisible = cursorsRef.current[currentPage - 1];
        if (lastVisible) {
          q = query(q, startAfter(lastVisible), limit(PAGE_SIZE));
        } else {
          q = query(q, limit(PAGE_SIZE));
        }
      } else if (direction === "prev") {
        targetPage = Math.max(1, currentPage - 1);
        const prevIndex = targetPage - 1;
        const prevVisible = prevIndex > 0 ? cursorsRef.current[prevIndex - 1] : null;
        if (prevVisible) {
          q = query(q, startAfter(prevVisible), limit(PAGE_SIZE));
        } else {
          q = query(q, limit(PAGE_SIZE));
        }
      } else {
        targetPage = 1;
        q = query(q, limit(PAGE_SIZE));
      }

      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSuppliers(data);

      const lastVisibleDoc = snap.docs[snap.docs.length - 1];
      if (direction === "init") {
        cursorsRef.current = [lastVisibleDoc];
        setCurrentPage(1);
      } else if (direction === "next") {
        {
        
          const nextCursors = [...cursorsRef.current];
          nextCursors[targetPage - 1] = lastVisibleDoc;
        cursorsRef.current = nextCursors;
      }
        setCurrentPage(targetPage);
      } else if (direction === "prev") {
        setCurrentPage(targetPage);
      }

      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, "suppliers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers("init");
    // Mount-only fetch; fetchSuppliers closes over pagination state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Data Sanitization & Normalization
      const normalizedData = {
        name: formData.name.trim().replace(/\s+/g, " "), // Trim and remove double-spaces
        contactName: formData.contactName.trim().replace(/\s+/g, " "),
        email: formData.email.trim().toLowerCase(), // Case-insensitive emails
        phone: formData.phone.trim(),
        category: formData.category.trim().replace(/\s+/g, " "),
        address: formData.address.trim().replace(/\s+/g, " ")
      };

      if (editingSupplier) {
        await updateDoc(doc(db, "suppliers", editingSupplier.id), normalizedData);
      } else {
        await addDoc(collection(db, "suppliers"), normalizedData);
      }
      setIsModalOpen(false);
      setEditingSupplier(null);
      setFormData({ name: "", contactName: "", email: "", phone: "", category: "", address: "" });
      fetchSuppliers("init");
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
          fetchSuppliers("init");
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
        <button type="button" 
          onClick={() => {
            setEditingSupplier(null);
            // L-SAN-1: blank phone (was "+56 " placeholder that could persist if user submits without typing).
            setFormData({ name: "", contactName: "", email: "", phone: "", category: "", address: "" });
            setIsModalOpen(true);
          }}
          className="bg-indigo-600 text-white font-bold px-6 py-4 rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-x-2"
        >
          <UserPlus size={20} />
          <span>Nuevo Proveedor</span>
        </button>
      </header>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            aria-label="Buscar proveedores"
            type="text" 
            placeholder="Buscar por nombre, contacto o rubro…"
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
              <div className="absolute top-0 right-0 size-32 bg-indigo-50/50 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-indigo-100/50 transition-colors" />
              
              <div className="flex justify-between items-start mb-6 relative z-10">
                <div className="flex items-center gap-x-3">
                  <div className="size-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-100">
                    {supplier.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 tracking-tight">{supplier.name}</h3>
                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg uppercase tracking-widest">
                      {supplier.category || "General"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" aria-label="Editar proveedor" onClick={() => handleEdit(supplier)} className="p-2 hover:bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors">
                    <Edit2 size={16} />
                  </button>
                  <button type="button" 
                    aria-label="Eliminar proveedor"
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
                <div className="flex items-center gap-x-3 text-slate-500">
                  <div className="size-8 bg-slate-50 rounded-xl flex items-center justify-center">
                    <Users size={14} />
                  </div>
                  <span className="text-xs font-bold">{supplier.contactName || "Sin contacto directo"}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-x-3 text-slate-500">
                    <div className="size-8 bg-slate-50 rounded-xl flex items-center justify-center">
                      <Phone size={14} />
                    </div>
                    <span className="text-[10px] font-black">{formatChileanPhone(supplier.phone || "") || "N/A"}</span>
                  </div>
                  <div className="flex items-center gap-x-3 text-slate-500">
                    <div className="size-8 bg-slate-50 rounded-xl flex items-center justify-center">
                      <Mail size={14} />
                    </div>
                    <span className="text-[10px] font-black truncate">{supplier.email || "N/A"}</span>
                  </div>
                </div>

                <div className="flex items-start gap-x-3 text-slate-500">
                  <div className="size-8 bg-slate-50 rounded-xl flex items-center justify-center mt-0.5">
                    <MapPin size={14} />
                  </div>
                  <span className="text-[10px] font-bold leading-relaxed">{supplier.address || "Sin dirección registrada"}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Controles de Paginación */}
      {!loading && (
        <div className="flex items-center justify-between px-8 py-5 border-t border-slate-100 bg-white rounded-[2rem] shadow-sm">
          <span className="text-xs font-semibold text-slate-500">
            Página <span className="font-bold text-slate-700">{currentPage}</span>
          </span>
          <div className="flex items-center gap-x-2">
            <button
              type="button"
              onClick={() => fetchSuppliers("prev")}
              disabled={currentPage === 1 || loading}
              className={cn(
                "p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
              )}
              title="Página Anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => fetchSuppliers("next")}
              disabled={!hasMore || loading}
              className={cn(
                "p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
              )}
              title="Siguiente Página"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredSuppliers.length === 0 && (
        <div className="bg-white rounded-[3rem] p-20 text-center border-2 border-dashed border-slate-100">
          <div className="size-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
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
                <button type="button" 
                  aria-label="Cerrar modal"
                  onClick={() => setIsModalOpen(false)}
                  className="p-2.5 hover:bg-slate-100 rounded-2xl transition-all"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 text-slate-700">
                <div className="space-y-2">
                  <label htmlFor={fId("name")} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre de la Empresa</label>
                  <input
                    id={fId("name")}
                    required
                    type="text"
                    maxLength={INPUT_MAX.NAME}
                    className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                    placeholder="Ej: Distribuidora Nacional"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor={fId("contactName")} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Persona de Contacto</label>
                    <input
                      id={fId("contactName")}
                      type="text"
                      maxLength={INPUT_MAX.NAME}
                      className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                      placeholder="Nombre del agente"
                      value={formData.contactName}
                      onChange={e => setFormData({...formData, contactName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor={fId("category")} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rubro / Categoría</label>
                    <input
                      id={fId("category")}
                      type="text"
                      maxLength={INPUT_MAX.SHORT_TEXT}
                      className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                      placeholder="Ej: Abarrotes"
                      value={formData.category}
                      onChange={e => setFormData({...formData, category: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor={fId("phone")} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono</label>
                    <input
                      id={fId("phone")}
                      type="tel"
                      maxLength={INPUT_MAX.PHONE}
                      className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                      placeholder="+56 9 XXXX XXXX"
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: formatChileanPhone(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor={fId("email")} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                    <input
                      id={fId("email")}
                      type="email"
                      maxLength={INPUT_MAX.EMAIL}
                      className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                      placeholder="ventas@proveedor.com"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor={fId("address")} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dirección / Oficina</label>
                  <input
                    id={fId("address")}
                    type="text"
                    maxLength={INPUT_MAX.ADDRESS}
                    className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                    placeholder="Casa matriz o bodega"
                    value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                  />
                </div>

                <div className="pt-6 flex flex-col sm:flex-row gap-3 sm:gap-4 shrink-0">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="w-full sm:flex-1 h-14 md:h-16 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:flex-[2] h-14 md:h-16 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-x-2 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <div className="size-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
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
