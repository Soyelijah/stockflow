import React, { useState, useEffect, useMemo } from "react";
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  serverTimestamp,
  where,
  limit
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  X, 
  Save, 
  Users, 
  Mail,
  Phone,
  MapPin,
  History,
  TrendingUp,
  Star,
  ChevronRight,
  Filter,
  CreditCard,
  Target,
  Zap,
  MessageCircle,
  Gift
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { cn, formatCurrency, formatRUT, formatChileanPhone, formatNumber, getCustomerTier, getHealthStatus, LOYALTY_TIERS } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";

export function Customers() {
  const { profile } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerTransactions, setCustomerTransactions] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    name: "",
    taxId: "",
    email: "",
    phone: "",
    address: "",
    points: 0,
    segment: "regular" as "regular" | "vip" | "churn",
    notes: "",
    totalSpent: 0
  });

  useEffect(() => {
    const q = query(collection(db, "customers"), orderBy("name"));
    const unsub = onSnapshot(q, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "customers");
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (selectedCustomerId) {
      const q = query(
        collection(db, "transactions"),
        where("customerId", "==", selectedCustomerId),
        orderBy("timestamp", "desc"),
        limit(20)
      );
      const unsub = onSnapshot(q, (snapshot) => {
        const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        setCustomerTransactions(txs);
        
        // Use the totalSpent from the customer document if it exists, 
        // otherwise fallback to visible transaction summation
        const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
        if (selectedCustomer?.totalSpent !== undefined) {
          setFormData(prev => ({ ...prev, totalSpent: selectedCustomer.totalSpent }));
        } else {
          const total = txs.reduce((sum, tx) => {
            const amount = Number(tx.amount);
            return sum + (isNaN(amount) ? 0 : amount);
          }, 0);
          setFormData(prev => ({ ...prev, totalSpent: total }));
        }
      });
      return unsub;
    }
  }, [selectedCustomerId, customers]);

  const openModal = (customer: any = null) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name,
        taxId: formatRUT(customer.taxId || ""),
        email: customer.email || "",
        phone: formatChileanPhone(customer.phone || ""),
        address: customer.address || "",
        points: customer.points || 0,
        segment: customer.segment || "regular",
        notes: customer.notes || ""
      });
    } else {
      setEditingCustomer(null);
      setFormData({
        name: "",
        taxId: "",
        email: "",
        phone: "+56 ",
        address: "",
        points: 0,
        segment: "regular",
        notes: ""
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await updateDoc(doc(db, "customers", editingCustomer.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, "customers"), {
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "customers");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`¿Eliminar al cliente "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, "customers", id));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "delete customer");
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.taxId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = useMemo(() => {
    return {
      total: customers.length,
      vips: customers.filter(c => c.segment === "vip").length,
      totalPoints: customers.reduce((acc, c) => acc + (c.points || 0), 0)
    };
  }, [customers]);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Relaciones con Clientes (CRM)</h1>
          <p className="text-slate-500 font-medium">Gestiona tu base de datos y programas de lealtad.</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="bg-indigo-600 text-white font-bold px-6 py-3 rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-500 hover:-translate-y-0.5 transition-all flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>Nuevo Cliente</span>
        </button>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex items-center justify-between group overflow-hidden relative">
          <div className="relative z-10">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Clientes</p>
             <h3 className="text-3xl font-black text-slate-800">{stats.total}</h3>
          </div>
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform rotate-12 group-hover:rotate-0">
             <Users size={32} />
          </div>
        </div>
        
        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex items-center justify-between group overflow-hidden relative">
          <div className="relative z-10">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Clientes VIP</p>
             <h3 className="text-3xl font-black text-emerald-600">{stats.vips}</h3>
          </div>
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform -rotate-12 group-hover:rotate-0">
             <Star size={32} />
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex items-center justify-between group overflow-hidden relative">
          <div className="relative z-10">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Puntos de Lealtad</p>
             <h3 className="text-3xl font-black text-amber-600">{formatNumber(stats.totalPoints)}</h3>
          </div>
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform rotate-6 group-hover:rotate-0">
             <Target size={32} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Customer List */}
        <div className="lg:col-span-7 space-y-6">
           <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center">
             <div className="relative flex-1">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
               <input 
                 type="text" 
                 placeholder="Buscar por nombre, email o identificación..."
                 className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/10 transition-all text-slate-700"
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
               />
             </div>
           </div>

           <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden p-2">
             <div className="divide-y divide-slate-50">
               {filteredCustomers.map(c => (
                 <motion.button 
                   layout
                   key={c.id}
                   onClick={() => setSelectedCustomerId(c.id)}
                   className={cn(
                     "w-full flex items-center justify-between p-5 rounded-3xl transition-all group",
                     selectedCustomerId === c.id ? "bg-indigo-600 text-white shadow-xl shadow-indigo-100" : "hover:bg-slate-50 text-slate-800"
                   )}
                 >
                   <div className="flex items-center space-x-4">
                     <div className={cn(
                       "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base shadow-sm",
                       selectedCustomerId === c.id ? "bg-white/20" : "bg-slate-100 text-slate-500"
                     )}>
                       {c.name.charAt(0).toUpperCase()}
                     </div>
                     <div className="text-left">
                       <p className="font-bold text-sm truncate max-w-[180px]">{c.name}</p>
                       <p className={cn(
                         "text-[10px] font-bold uppercase tracking-widest mt-0.5",
                         selectedCustomerId === c.id ? "text-indigo-200" : "text-slate-400"
                       )}>
                         {formatRUT(c.taxId || "Sin ID Tributario")}
                       </p>
                     </div>
                   </div>
                   <div className="flex items-center space-x-4">
                      {c.segment === "vip" && (
                        <div className={cn(
                          "px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest",
                          selectedCustomerId === c.id ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-600"
                        )}>
                          VIP
                        </div>
                      )}
                      <ChevronRight size={18} className={cn(selectedCustomerId === c.id ? "text-white" : "text-slate-200")} />
                   </div>
                 </motion.button>
               ))}
               {filteredCustomers.length === 0 && (
                 <div className="text-center py-20 opacity-30">
                    <Users size={64} className="mx-auto mb-4" />
                    <p className="text-xs font-black uppercase tracking-widest">No hay clientes</p>
                 </div>
               )}
             </div>
           </div>
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-5 relative">
          <AnimatePresence mode="wait">
            {selectedCustomerId ? (
              <motion.div 
                key={selectedCustomerId}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl overflow-hidden flex flex-col min-h-[600px]"
              >
                {/* Header Profile */}
                <div className="bg-slate-900 p-8 text-white">
                  <div className="flex items-start justify-between mb-8">
                     <div className="flex items-center space-x-4">
                       <div className="w-16 h-16 bg-white/10 rounded-[1.5rem] flex items-center justify-center text-white border border-white/10 shadow-inner">
                         <Users size={32} />
                       </div>
                       <div>
                         <h2 className="text-2xl font-black tracking-tight">{customers.find(c => c.id === selectedCustomerId)?.name}</h2>
                         <p className="text-xs font-bold text-white/50 uppercase tracking-widest mt-1">Registrado {customers.find(c => c.id === selectedCustomerId)?.createdAt?.toDate()?.toLocaleDateString()}</p>
                       </div>
                     </div>
                     <div className="flex space-x-2">
                        <button 
                          onClick={() => openModal(customers.find(c => c.id === selectedCustomerId))}
                          className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-all"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDelete(selectedCustomerId, customers.find(c => c.id === selectedCustomerId)?.name)}
                          className="p-3 bg-rose-500/20 text-rose-300 rounded-2xl hover:bg-rose-500/40 transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                     </div>
                  </div>                   <div className="grid grid-cols-2 gap-4">
                     <div className="bg-white/5 p-4 rounded-[1.5rem] border border-white/5 text-center">
                        <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-1 text-center">Nivel de Lealtad</p>
                        <div className="flex items-center justify-center space-x-2">
                           <span className={cn("text-xl font-black uppercase text-xs tracking-widest", getCustomerTier(customers.find(c => c.id === selectedCustomerId)?.points).color)}>
                             {getCustomerTier(customers.find(c => c.id === selectedCustomerId)?.points).name}
                           </span>
                        </div>
                     </div>
                     <div className="bg-white/5 p-4 rounded-[1.5rem] border border-white/5 text-center">
                        <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-1 text-center">Salud del Cliente</p>
                        <div className="flex items-center justify-center space-x-2">
                           <span className={cn("text-xl font-black uppercase text-xs tracking-widest", getHealthStatus(customers.find(c => c.id === selectedCustomerId)?.lastPurchaseAt).color)}>
                             {getHealthStatus(customers.find(c => c.id === selectedCustomerId)?.lastPurchaseAt).label}
                           </span>
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                     <div className="bg-emerald-500/10 p-4 rounded-[1.5rem] border border-emerald-500/10 text-center">
                        <p className="text-[9px] font-black text-emerald-300 uppercase tracking-widest mb-1 text-center">Lifetime Value (LTV)</p>
                        <div className="flex items-center justify-center space-x-2">
                           <span className="text-xl font-black text-emerald-400">
                             {formatCurrency(formData.totalSpent)}
                           </span>
                        </div>
                     </div>
                     <div className="bg-white/5 p-4 rounded-[1.5rem] border border-white/5 text-center">
                        <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-1 text-center">Puntos</p>
                        <div className="flex items-center justify-center space-x-2">
                           <Target size={14} className="text-amber-400" />
                           <span className="text-xl font-black">
                             {formatNumber(customers.find(c => c.id === selectedCustomerId)?.points)}
                           </span>
                        </div>
                     </div>
                  </div>

                  {/* Churn Prevention Action */}
                  {getHealthStatus(customers.find(c => c.id === selectedCustomerId)?.lastPurchaseAt).label === "Crítico" && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-6 p-5 bg-rose-500/20 border border-rose-500/30 rounded-[2rem] flex flex-col items-center space-y-3"
                    >
                      <div className="flex items-center space-x-2 text-rose-300 text-[10px] font-black uppercase tracking-widest">
                        <Zap size={12} className="animate-pulse" />
                        <span>Acción de Retención IA Sugerida</span>
                      </div>
                      <p className="text-xs text-center font-bold text-rose-100">Este cliente no ha comprado hace tiempo. Envíale un incentivo hoy.</p>
                      <button 
                        onClick={() => alert(`Sugerencia IA: Enviando Cupón de 15% DCTO a ${customers.find(c => c.id === selectedCustomerId)?.name}.`)}
                        className="w-full py-3 bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center space-x-2 hover:bg-rose-400 transition-all shadow-lg shadow-rose-900/20"
                      >
                        <Gift size={14} />
                        <span>Enviar Cupón Reactivación</span>
                      </button>
                    </motion.div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 p-8 space-y-10">
                   {/* Contact Info */}
                   <div className="space-y-4">
                     <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest ml-1">Información de Contacto</h3>
                     <div className="grid grid-cols-1 gap-3">
                        <div className="flex items-center space-x-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <Mail size={18} className="text-indigo-500" />
                          <p className="font-bold text-sm text-slate-700">{customers.find(c => c.id === selectedCustomerId)?.email || "Sin email"}</p>
                        </div>
                        <div className="flex items-center space-x-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <Phone size={18} className="text-indigo-500" />
                          <p className="font-bold text-sm text-slate-700">{formatChileanPhone(customers.find(c => c.id === selectedCustomerId)?.phone || "") || "Sin teléfono"}</p>
                        </div>
                        <div className="flex items-center space-x-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <MapPin size={18} className="text-indigo-500" />
                          <p className="font-bold text-sm text-slate-700 leading-tight">{customers.find(c => c.id === selectedCustomerId)?.address || "Sin dirección"}</p>
                        </div>
                     </div>
                   </div>

                   {/* Benefits */}
                   <div className="space-y-4">
                     <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest ml-1">Beneficios del Nivel</h3>
                     <div className="grid grid-cols-1 gap-2">
                        {customers.find(c => c.id === selectedCustomerId)?.points >= LOYALTY_TIERS.PLATINUM.min && (
                          <div className="flex items-center space-x-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                            <Zap size={14} className="text-indigo-600" />
                            <p className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">Despacho Priority 24h + Descuento 10%</p>
                          </div>
                        )}
                        {customers.find(c => c.id === selectedCustomerId)?.points >= LOYALTY_TIERS.GOLD.min && (
                          <div className="flex items-center space-x-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                            <Star size={14} className="text-amber-600" />
                            <p className="text-[10px] font-black text-amber-900 uppercase tracking-widest">Atención Preferencial + Regalo Mensual</p>
                          </div>
                        )}
                        {customers.find(c => c.id === selectedCustomerId)?.points >= LOYALTY_TIERS.SILVER.min && (
                          <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                            <TrendingUp size={14} className="text-slate-600" />
                            <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Crédito a 30 días + Alertas Preventas</p>
                          </div>
                        )}
                        {customers.find(c => c.id === selectedCustomerId)?.points < LOYALTY_TIERS.SILVER.min && (
                          <div className="flex items-center space-x-3 p-3 bg-orange-50 rounded-xl border border-orange-100">
                            <Target size={14} className="text-orange-600" />
                            <p className="text-[10px] font-black text-orange-900 uppercase tracking-widest">Suma {500 - (customers.find(c => c.id === selectedCustomerId)?.points || 0)} puntos para Nivel Silver</p>
                          </div>
                        )}
                     </div>
                   </div>

                   {/* History */}
                   <div className="space-y-4">
                     <div className="flex items-center justify-between">
                       <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest ml-1">Últimas 20 Compras</h3>
                       <History size={16} className="text-slate-300" />
                     </div>
                     <div className="space-y-3">
                        {customerTransactions.map(tx => (
                          <div key={tx.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-100 transition-all group">
                             <div className="flex items-center space-x-3">
                               <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500 font-bold text-xs">
                                  #{tx.id.slice(-4)}
                               </div>
                               <div>
                                 <p className="text-xs font-black text-slate-800 tracking-tight">{tx.productName}</p>
                                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                   {tx.timestamp?.toDate()?.toLocaleDateString()}
                                 </p>
                               </div>
                             </div>
                             <div className="text-right">
                               <p className="text-xs font-black text-slate-800">{formatCurrency(tx.amount)}</p>
                               <span className="text-[8px] font-black uppercase text-indigo-400">Total: {tx.quantity} uds</span>
                             </div>
                          </div>
                        ))}
                        {customerTransactions.length === 0 && (
                          <p className="text-center py-10 text-[10px] font-black text-slate-300 uppercase tracking-widest">Sin transacciones registradas</p>
                        )}
                     </div>
                   </div>
                </div>
              </motion.div>
            ) : (
              <div className="bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 h-[600px] flex flex-col items-center justify-center p-12 text-center">
                 <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center text-slate-200 mb-6 shadow-sm">
                   <Target size={48} />
                 </div>
                 <h3 className="text-xl font-black text-slate-400 tracking-tight">Centro de Inteligencia Humana</h3>
                 <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mt-4 leading-relaxed">Selecciona un cliente para visualizar su perfil, lealtad y comportamiento de compra estratégico.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 pb-20 sm:pb-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl relative z-10 overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center space-x-4 text-indigo-600">
                  <div className="p-3 bg-indigo-100 rounded-2xl">
                    <Users size={24} />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">
                    {editingCustomer ? "Editar Perfil" : "Nuevo Registro"}
                  </h3>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Nombre / Empresa *</label>
                    <input 
                      required
                      type="text" 
                      className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-800"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Identificación (TaxID/RUT)</label>
                    <input 
                      type="text" 
                      placeholder="11.111.111-K"
                      className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-800"
                      value={formData.taxId}
                      onChange={e => setFormData({...formData, taxId: formatRUT(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Puntos Iniciales</label>
                    <input 
                      type="number" 
                      className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-800"
                      value={formData.points}
                      onChange={e => setFormData({...formData, points: Number(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Email</label>
                    <input 
                      type="email" 
                      className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-800"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Teléfono</label>
                    <input 
                      type="tel" 
                      placeholder="+56 9 XXXX XXXX"
                      className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-800"
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: formatChileanPhone(e.target.value)})}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Dirección de Despacho</label>
                    <input 
                      type="text" 
                      className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-800"
                      value={formData.address}
                      onChange={e => setFormData({...formData, address: e.target.value})}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Clasificación</label>
                    <div className="flex gap-4">
                       {["regular", "vip", "churn"].map((seg) => (
                         <button
                           key={seg}
                           type="button"
                           onClick={() => setFormData({...formData, segment: seg as any})}
                           className={cn(
                             "flex-1 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all",
                             formData.segment === seg 
                               ? "bg-slate-900 text-white border-slate-900" 
                               : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                           )}
                         >
                           {seg}
                         </button>
                       ))}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Notas Estratégicas</label>
                    <textarea 
                      rows={3}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-800"
                      value={formData.notes}
                      onChange={e => setFormData({...formData, notes: e.target.value})}
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 bg-slate-50 text-slate-400 font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-slate-100 transition-all"
                  >
                    Cerrar
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-4 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center space-x-2"
                  >
                    <Save size={18} />
                    <span>Guardar Cambios</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
