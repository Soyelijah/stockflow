import React, { useState, useEffect } from "react";
import { 
  CreditCard, 
  Plus, 
  Search, 
  Trash2, 
  X, 
  Calendar,
  Tag,
  DollarSign,
  PieChart as PieChartIcon,
  Filter,
  RefreshCw,
  Edit2
} from "lucide-react";
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  orderBy,
  limit,
  Timestamp
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { cn, formatCurrency } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { ModernAlert } from "./ui/ModernAlert";

const CATEGORIES = [
  "Servicios (Luz, Agua, Gas)",
  "Alquiler",
  "Sueldos",
  "Mantenimiento",
  "Suministros de Oficina",
  "Transporte / Logística",
  "Impuestos",
  "Marketing",
  "Otros"
];

export function Expenses() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
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
    description: "",
    amount: "",
    category: CATEGORIES[0],
    date: new Date().toISOString().split("T")[0]
  });

  useEffect(() => {
    const q = query(collection(db, "expenses"), orderBy("date", "desc"), limit(100));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setExpenses(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "expenses");
    });
    return unsub;
  }, []);

  const totalExpenses = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  
  const topCategory = React.useMemo(() => {
    if (expenses.length === 0) return "Sin Datos";
    const totals: Record<string, number> = {};
    expenses.forEach(exp => {
      totals[exp.category] = (totals[exp.category] || 0) + (Number(exp.amount) || 0);
    });
    return Object.entries(totals).sort((a, b) => b[1] - a[1])[0][0];
  }, [expenses]);

  const handleEdit = (expense: any) => {
    setEditingExpense(expense);
    setFormData({
      description: expense.description,
      amount: expense.amount.toString(),
      category: expense.category,
      date: expense.date
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, description: string) => {
    setAlertConfig({
      isOpen: true,
      type: "delete",
      title: "¿Eliminar Gasto?",
      message: `¿Realmente desea eliminar el registro de "${description}"?`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "expenses", id));
          setAlertConfig(prev => ({
            ...prev,
            isOpen: true,
            type: "success",
            title: "Eliminado",
            message: "Registro borrado exitosamente.",
            onConfirm: undefined
          }));
        } catch (err: any) {
          console.error(err);
          setAlertConfig({
            isOpen: true,
            type: "error",
            title: "Error de Servidor",
            message: "No se pudo eliminar el gasto."
          });
          handleFirestoreError(err, OperationType.DELETE, "expenses");
        }
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const data = {
        ...formData,
        amount: Number(formData.amount),
        updatedAt: Timestamp.now(),
        createdBy: user?.uid
      };

      if (editingExpense) {
        await updateDoc(doc(db, "expenses", editingExpense.id), data);
      } else {
        await addDoc(collection(db, "expenses"), {
          ...data,
          timestamp: Timestamp.now()
        });
      }
      
      setIsModalOpen(false);
      setEditingExpense(null);
      setFormData({
        description: "",
        amount: "",
        category: CATEGORIES[0],
        date: new Date().toISOString().split("T")[0]
      });
      setAlertConfig({
        isOpen: true,
        type: "success",
        title: editingExpense ? "¡Actualizado!" : "¡Éxito!",
        message: editingExpense ? "Gasto actualizado correctamente." : "Gasto registrado en el sistema."
      });
    } catch (err) {
      setAlertConfig({
        isOpen: true,
        type: "error",
        title: "Error",
        message: "No se pudo guardar la información del gasto."
      });
      handleFirestoreError(err, OperationType.WRITE, "expenses");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = exp.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "Todos" || exp.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight">Egresos y Gastos</h1>
          <p className="text-slate-500 font-medium">Lleva el control de los costos operativos de tu negocio.</p>
        </div>
        <button 
          onClick={() => {
            setEditingExpense(null);
            setFormData({
              description: "",
              amount: "",
              category: CATEGORIES[0],
              date: new Date().toISOString().split("T")[0]
            });
            setIsModalOpen(true);
          }}
          className="bg-slate-900 text-white font-bold px-8 py-4 rounded-2xl shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>Registrar Gasto</span>
        </button>
      </header>

      {/* Stats Area */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex items-center justify-between overflow-hidden relative group">
          <div className="relative z-10">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Gasto Total Periodo</p>
            <h3 className="text-3xl font-black text-rose-500 tracking-tight">{formatCurrency(totalExpenses)}</h3>
          </div>
          <div className="w-16 h-16 bg-rose-50 rounded-[1.5rem] flex items-center justify-center -rotate-12 group-hover:rotate-0 transition-transform">
            <CreditCard size={32} className="text-rose-200" />
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex items-center justify-between overflow-hidden relative group">
          <div className="relative z-10">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Transacciones</p>
            <h3 className="text-3xl font-black text-slate-800 tracking-tight">{filteredExpenses.length}</h3>
          </div>
          <div className="w-16 h-16 bg-slate-50 rounded-[1.5rem] flex items-center justify-center rotate-12 group-hover:rotate-0 transition-transform">
            <RefreshCw size={32} className="text-slate-200" />
          </div>
        </div>

        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white flex items-center justify-between overflow-hidden relative group">
          <div className="relative z-10">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">Categoría Mayor</p>
            <h3 className="text-xl font-black tracking-tight truncate max-w-[160px]">{topCategory}</h3>
          </div>
          <div className="w-16 h-16 bg-white/5 rounded-[1.5rem] flex items-center justify-center -rotate-12 group-hover:rotate-0 transition-transform">
            <PieChartIcon size={32} className="text-white/20" />
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="flex-1 relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por descripción..."
            className="w-full bg-slate-50 border-none rounded-xl py-3 pl-12 focus:ring-2 focus:ring-slate-400 transition-all text-sm font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center space-x-2 overflow-x-auto w-full md:w-auto no-scrollbar pb-1 md:pb-0">
          <button 
            onClick={() => setSelectedCategory("Todos")}
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all",
              selectedCategory === "Todos" ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
            )}
          >
            Todos
          </button>
          {CATEGORIES.slice(0, 4).map(cat => (
            <button 
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all",
                selectedCategory === cat ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Expenses List */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoría</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Monto</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredExpenses.map((exp) => (
              <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-8 py-5">
                  <div className="flex items-center space-x-2 text-slate-600">
                    <Calendar size={14} className="text-slate-300" />
                    <span className="text-xs font-bold">{exp.date}</span>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <p className="text-sm font-bold text-slate-800">{exp.description}</p>
                </td>
                <td className="px-8 py-5">
                  <div className="inline-flex items-center space-x-2 bg-slate-100 px-3 py-1 rounded-lg">
                    <Tag size={12} className="text-slate-400" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight">{exp.category}</span>
                  </div>
                </td>
                <td className="px-8 py-5 text-right">
                  <span className="text-sm font-black text-rose-500">{formatCurrency(exp.amount)}</span>
                </td>
                <td className="px-8 py-5 text-right">
                  <div className="flex items-center justify-end space-x-2">
                    <button 
                      onClick={() => handleEdit(exp)}
                      className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-indigo-600 transition-all"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(exp.id, exp.description)}
                      className="p-2 hover:bg-rose-100 rounded-xl text-rose-400 hover:text-rose-600 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredExpenses.length === 0 && (
          <div className="py-20 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard size={32} className="text-slate-200" />
            </div>
            <p className="text-slate-400 font-bold">No se encontraron registros de gastos.</p>
          </div>
        )}
      </div>

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
                  <h2 className="text-xl md:text-2xl font-black text-slate-800">{editingExpense ? "Editar Gasto" : "Nuevo Registro"}</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Egresos operativos</p>
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
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descripción</label>
                  <input 
                    required
                    type="text" 
                    className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 focus:bg-white transition-all text-slate-800"
                    placeholder="Ej: Pago de Luz local 4"
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Monto ($)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                        required
                        type="number" 
                        min="1"
                        className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl pl-10 pr-5 text-sm font-bold focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 focus:bg-white transition-all text-slate-800"
                        value={formData.amount}
                        onChange={e => setFormData({...formData, amount: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha</label>
                    <input 
                      required
                      type="date" 
                      className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 focus:bg-white transition-all text-slate-800"
                      value={formData.date}
                      onChange={e => setFormData({...formData, date: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoría</label>
                  <select 
                    className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 focus:bg-white transition-all text-slate-800 appearance-none"
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-6 flex flex-col sm:flex-row gap-3 sm:gap-4 shrink-0">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="w-full sm:flex-1 h-14 md:h-16 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:flex-[2] h-14 md:h-16 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 shadow-xl transition-all flex items-center justify-center space-x-2"
                  >
                    {isSubmitting ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    ) : (
                      <>
                        <RefreshCw size={16} />
                        <span>{editingExpense ? "Actualizar" : "Registrar Pago"}</span>
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
