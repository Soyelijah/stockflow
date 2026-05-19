import React, { useState, useEffect } from "react";
import { 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  Save, 
  Sparkles, 
  ShieldCheck, 
  Bell,
  Globe,
  Settings as SettingsIcon,
  CreditCard,
  Target,
  RefreshCw,
  Users,
  AlertCircle,
  Smartphone,
  Printer
} from "lucide-react";
import { collection, getDoc, getDocs, doc, setDoc, query, orderBy } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { cn, formatChileanPhone } from "../lib/utils";
import { motion } from "motion/react";

import { useAuth } from "../contexts/AuthContext";

export function Settings() {
  const { profile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [settings, setSettings] = useState({
    businessName: "StockFlow Pro",
    email: "contacto@negocio.cl",
    phone: "+56 9 1234 5678",
    address: "Santiago, Chile",
    currency: "CLP",
    taxEnabled: true,
    taxRate: 19,
    aiEnabled: false,
    notificationsEnabled: true,
    printerType: 'thermal',
    printerInterface: 'system',
    autoPrintInvoice: false
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "global");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSettings({
            ...data,
            phone: formatChileanPhone(data.phone || "")
          } as any);
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
      }
    };
    fetchSettings();

    const fetchUsers = async () => {
      if (profile?.role !== "admin") return;
      try {
        const q = query(collection(db, "users"));
        const snap = await getDocs(q);
        setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("Error fetching users:", err);
      }
    };
    fetchUsers();
  }, [profile?.role]);

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      await setDoc(doc(db, "users", userId), { role: newRole }, { merge: true });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      alert("Rol actualizado correctamente");
    } catch (err) {
      alert("Error al actualizar rol");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await setDoc(doc(db, "settings", "global"), settings);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <header>
        <h1 className="text-4xl font-black text-slate-800 tracking-tight">Configuración</h1>
        <p className="text-slate-500 font-medium mt-1">Personaliza tu espacio de trabajo y reglas de negocio.</p>
      </header>

      <form onSubmit={handleSave} className="space-y-8 pb-20">
        {/* Business Profile */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex items-center space-x-4">
            <div className="p-3 bg-white rounded-2xl shadow-sm text-indigo-600">
              <Building2 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Perfil de Negocio</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Identidad de tu marca</p>
            </div>
          </div>
          
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Comercial</label>
              <div className="relative">
                <Target className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="text" 
                  className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-12 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                  value={settings.businessName}
                  onChange={e => setSettings({...settings, businessName: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Correo de Contacto</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="email" 
                  className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-12 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                  value={settings.email}
                  onChange={e => setSettings({...settings, email: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="tel" 
                  placeholder="+56 9 XXXX XXXX"
                  className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-12 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                  value={settings.phone}
                  onChange={e => setSettings({...settings, phone: formatChileanPhone(e.target.value)})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dirección Física</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="text" 
                  className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-12 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                  value={settings.address}
                  onChange={e => setSettings({...settings, address: e.target.value})}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Feature Toggles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Printer Management */}
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 space-y-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                <Printer size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800 tracking-tight">Impresión y Tickets</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">Configuración de comprobantes</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo de Impresora</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold"
                  value={settings.printerType}
                  onChange={e => setSettings({...settings, printerType: e.target.value as any})}
                >
                  <option value="thermal">Térmica (58mm/80mm)</option>
                  <option value="regular">Inyección / Láser (A4/Carta)</option>
                  <option value="none">Sin Impresora (Digital)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Interfaz de Conexión</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold"
                  value={settings.printerInterface}
                  onChange={e => setSettings({...settings, printerInterface: e.target.value as any})}
                >
                  <option value="system">Sistema (Windows/Android)</option>
                  <option value="usb">USB Directo (Nativo)</option>
                  <option value="bluetooth">Bluetooth (Nativo)</option>
                  <option value="network">Red IP / Wireless</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                <div className="space-y-0.5">
                  <p className="text-xs font-black text-slate-800">Impresión Automática</p>
                  <p className="text-[10px] text-slate-400 font-bold">Imprimir ticket al cerrar la venta</p>
                </div>
                <div 
                  className={cn(
                    "w-10 h-5 rounded-full relative cursor-pointer transition-all",
                    settings.autoPrintInvoice ? "bg-indigo-600" : "bg-slate-200"
                  )}
                  onClick={() => setSettings({...settings, autoPrintInvoice: !settings.autoPrintInvoice})}
                >
                  <div className={cn(
                    "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all",
                    settings.autoPrintInvoice ? "left-5.5" : "left-0.5"
                  )} />
                </div>
              </div>
            </div>
          </div>

          {/* AI Settings */}
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 space-y-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <Sparkles size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800 tracking-tight">Inteligencia Artificial</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">Asistente de stock inteligente</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-5 bg-slate-50 rounded-3xl border border-transparent hover:border-indigo-200 transition-all cursor-pointer" onClick={() => setSettings({...settings, aiEnabled: !settings.aiEnabled})}>
              <div className="space-y-1">
                <p className="text-xs font-black text-slate-800">Smart Predictions</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Predicción de quiebre de stock</p>
              </div>
              <div className={cn(
                "w-12 h-6 rounded-full transition-all relative",
                settings.aiEnabled ? "bg-indigo-600" : "bg-slate-200"
              )}>
                <div className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                  settings.aiEnabled ? "left-7" : "left-1"
                )} />
              </div>
            </div>
          </div>

          {/* Operational Settings */}
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 space-y-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800 tracking-tight">Operaciones</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">Reglas de flujo y seguridad</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Moneda del Sistema</span>
                <span className="text-xs font-black text-slate-800 bg-slate-100 px-3 py-1 rounded-lg">CLP ($)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Tasa de Impuesto (IVA)</span>
                <div className="flex items-center space-x-2">
                  <input 
                    type="number"
                    className="w-16 h-8 bg-slate-50 border-none rounded-lg text-xs font-black text-center focus:ring-2 focus:ring-indigo-500"
                    value={settings.taxRate}
                    onChange={e => setSettings({...settings, taxRate: Number(e.target.value)})}
                  />
                  <span className="text-xs font-black text-slate-400">%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* User Management */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex items-center space-x-4">
            <div className="p-3 bg-white rounded-2xl shadow-sm text-amber-600">
              <Users size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Gestión de Usuarios</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Control de accesos y roles</p>
            </div>
          </div>
          
          <div className="p-8 space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {users.map((u) => (
                <div key={u.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:bg-white hover:border-indigo-100 transition-all">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-slate-400 font-black text-lg shadow-sm border border-slate-50 uppercase">
                      {u.name?.charAt(0) || u.email?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{u.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <select 
                      className="bg-white border border-slate-100 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                      value={u.role || "seller"}
                      onChange={(e) => updateUserRole(u.id, e.target.value)}
                    >
                      <option value="admin">Administrador</option>
                      <option value="manager">Gerente / Encargado</option>
                      <option value="seller">Vendedor / POS</option>
                      <option value="logistics">Logística / Bodega</option>
                    </select>
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      u.role === "admin" ? "bg-indigo-600" : u.role === "manager" ? "bg-emerald-500" : u.role === "logistics" ? "bg-amber-500" : "bg-slate-300"
                    )} title={u.role} />
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-indigo-50 p-6 rounded-2xl mt-4">
              <div className="flex items-start space-x-3 text-indigo-600">
                <Smartphone size={20} className="mt-0.5" />
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase tracking-widest">URL Acceso Vendedores (Móvil)</p>
                  <p className="text-xs font-bold text-slate-800 mt-1 break-all bg-white/50 px-2 py-1 rounded">
                    {window.location.origin}/mobile
                  </p>
                  <p className="text-[10px] text-indigo-700 font-medium mt-2 leading-relaxed">
                    Comparte este enlace con tus vendedores para que puedan operar desde sus celulares con la interfaz simplificada.
                  </p>
                  <button 
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/mobile`);
                      alert("Copiado al portapapeles");
                    }}
                    className="mt-3 text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white px-3 py-1.5 rounded-lg shadow-sm"
                  >
                    Copiar Enlace
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Global Save Bar */}
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-lg px-6 z-50">
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className="bg-slate-900 rounded-3xl p-4 shadow-2xl flex items-center justify-between border border-white/10"
          >
            <div className="pl-4">
              <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Estado de Guardado</p>
              <p className="text-xs font-black text-white">
                {showSuccess ? "✓ Cambios Guardados" : isSaving ? "Guardando..." : "Cambios pendientes"}
              </p>
            </div>
            <button 
              type="submit"
              disabled={isSaving}
              className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-50 transition-all flex items-center space-x-2 disabled:opacity-50"
            >
              {isSaving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
              <span>{isSaving ? "Procesando" : "Guardar Ajustes"}</span>
            </button>
          </motion.div>
        </div>
      </form>
    </div>
  );
}
