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
  Printer,
  Tag,
  Plus,
  Trash2,
  Truck,
  Server,
  Database,
  Shuffle,
  Activity,
  Cpu,
  Layers,
  Wifi,
  Flame,
  Zap,
  TrendingUp,
  Lock,
  Compass
} from "lucide-react";
import { collection, getDoc, getDocs, doc, setDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "@/src/lib/firebase";
import { cn, formatChileanPhone } from "@/src/lib/utils";
import { motion } from "motion/react";

import { useAuth } from "@/src/contexts/AuthContext";

export function Settings() {
  const { profile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [users, setUsers] = useState<any[]>([]);

  // Interactive Hybrid Architecture States
  const [nodesScale, setNodesScale] = useState<number>(3); // Desired containers count per service (autoscaling)
  const [dbConnectionLimit, setDbConnectionLimit] = useState<number>(200); // DB connections upper limit pool
  const [activeServices, setActiveServices] = useState({
    authGateway: true,
    posService: true,
    logisticEngine: true,
    smartAI: true
  });
  
  // Simulated stats state
  const [simRPS, setSimRPS] = useState<number>(45);
  const [simLatency, setSimLatency] = useState<number>(14);
  const [simCpuCurrent, setSimCpuCurrent] = useState<number>(18);
  const [simStatus, setSimStatus] = useState<"IDLE" | "LOAD_BALANCING" | "STRESS_TEST" | "CRITICAL_SPIKE" | "AUTO_SCALED">("LOAD_BALANCING");
  const [simLogs, setSimLogs] = useState<string[]>([
    "ℹ️ [API Gateway/Nginx Engine] Gateway inicializado correctamente.",
    "🔌 [Central DB/Firestore] Conexión establecida con pools de réplica de baja latencia.",
    "🛡️ [JWT Auth Server] Middleware de validación criptográfica activo."
  ]);
  const [stressIntervalActive, setStressIntervalActive] = useState<boolean>(false);

  // Auto-simulation log runner effect
  useEffect(() => {
    let interval: any = null;
    if (stressIntervalActive) {
      setSimStatus("STRESS_TEST");
      let count = 0;
      interval = setInterval(() => {
        count++;
        // Generate stress levels
        const currentRPS = Math.floor(250 + Math.random() * 850);
        setSimRPS(currentRPS);
        const cpuCurrent = Math.min(98, Math.floor(45 + (currentRPS / 1100) * 45 - (nodesScale * 4)));
        setSimCpuCurrent(cpuCurrent);
        
        let calculatedLatency = Math.floor(10 + (currentRPS / 24) - (nodesScale * 3.5));
        if (calculatedLatency < 8) calculatedLatency = 8;
        setSimLatency(calculatedLatency);

        // Build log message
        const timestamp = new Date().toLocaleTimeString();
        let logMsg = "";
        if (currentRPS > 900) {
          logMsg = `⚠️ [${timestamp}] ¡Pico Crítico de Tráfico! ${currentRPS} RPS. Balanceador de Carga redirigiendo flujos...`;
          setSimStatus("CRITICAL_SPIKE");
        } else if (cpuCurrent > 75) {
          logMsg = `⚡ [${timestamp}] Alerta de Autoscale activada. CPU: ${cpuCurrent}%. Solicitando aprovisionamiento de nodos en Cloud Run...`;
          setSimStatus("AUTO_SCALED");
        } else {
          logMsg = `📡 [${timestamp}] Respuesta exitosa de microservicio en ${calculatedLatency}ms. Carga actual de red: ${currentRPS} RPS.`;
          setSimStatus("STRESS_TEST");
        }

        setSimLogs(prev => [logMsg, ...prev.slice(0, 7)]);
      }, 1500);
    } else {
      setSimStatus("LOAD_BALANCING");
      // Slower ambient traffic simulation
      interval = setInterval(() => {
        const ambientRPS = Math.floor(25 + Math.random() * 30);
        setSimRPS(ambientRPS);
        const cpuCurrent = Math.max(10, Math.floor(12 + Math.random() * 8 - (nodesScale * 0.5)));
        setSimCpuCurrent(cpuCurrent);
        setSimLatency(Math.max(6, Math.floor(12 + Math.random() * 5 - (nodesScale * 0.4))));
      }, 3500);
    }

    return () => clearInterval(interval);
  }, [stressIntervalActive, nodesScale]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [couponError, setCouponError] = useState("");
  const [newCoupon, setNewCoupon] = useState({
    code: "",
    title: "",
    desc: "",
    discountType: "percent",
    discountValue: 10,
    minTier: "BRONZE",
    img: "🎟️",
    active: true,
    color: "bg-indigo-50 border-indigo-100 text-indigo-600"
  });

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "coupons")), (snap) => {
      setCoupons(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.warn("Coupons snapshot listener permission or connection warning:", error);
    });
    return unsub;
  }, []);

  const handleCreateCoupon = async (e: React.MouseEvent) => {
    e.preventDefault();
    setCouponError("");
    const code = newCoupon.code.trim().toUpperCase();
    if (!code) {
      setCouponError("Debe ingresar un código");
      return;
    }
    if (!newCoupon.title.trim()) {
      setCouponError("Debe ingresar el título principal");
      return;
    }
    try {
      const docRef = doc(db, "coupons", code);
      await setDoc(docRef, {
        ...newCoupon,
        id: code,
        code: code,
        active: true
      });
      setNewCoupon({
        code: "",
        title: "",
        desc: "",
        discountType: "percent",
        discountValue: 10,
        minTier: "BRONZE",
        img: "🎟️",
        active: true,
        color: "bg-indigo-50 border-indigo-100 text-indigo-600"
      });
    } catch (err) {
      setCouponError("Error al guardar cupón.");
    }
  };

  const handleToggleCoupon = async (id: string, active: boolean) => {
    try {
      const docRef = doc(db, "coupons", id);
      await updateDoc(docRef, { active });
    } catch (err) {
      console.error("Error toggling coupon", err);
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    try {
      await deleteDoc(doc(db, "coupons", id));
    } catch (err) {
      console.error("Error deleting coupon:", err);
    }
  };
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
    autoPrintInvoice: false,
    deliveryEnabled: true
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "global");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSettings({
            deliveryEnabled: true,
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

          {/* Delivery & Logistics Settings */}
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 space-y-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <Truck size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800 tracking-tight">Sistema de Reparto</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">Logística, despachos y delivery</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-5 bg-slate-50 rounded-3xl border border-transparent hover:border-indigo-200 transition-all cursor-pointer" onClick={() => setSettings({...settings, deliveryEnabled: !settings.deliveryEnabled})}>
              <div className="space-y-1">
                <p className="text-xs font-black text-slate-800">Habilitar Despachos</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Activar mapas y seguimiento en ruta</p>
              </div>
              <div className={cn(
                "w-12 h-6 rounded-full transition-all relative",
                settings.deliveryEnabled ? "bg-indigo-600" : "bg-slate-200"
              )}>
                <div className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                  settings.deliveryEnabled ? "left-7" : "left-1"
                )} />
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Hybrid Architecture and Scalability Control Room */}
        <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden text-white font-sans">
          <div className="p-8 border-b border-slate-800/80 bg-slate-950 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/10">
                <Cpu size={24} className="animate-spin-slow" />
              </div>
              <div className="text-left">
                <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                  Centro de Control: Arquitectura Híbrida 🌟
                </h2>
                <p className="text-[10px] font-black text-[#10b981] uppercase tracking-widest mt-1">
                  Base de Datos Inteligente + Microservicios de Backends Modulares
                </p>
              </div>
            </div>
            <div>
              <button
                type="button"
                onClick={() => setStressIntervalActive(!stressIntervalActive)}
                className={cn(
                  "px-5 h-11 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-2 active:scale-95",
                  stressIntervalActive 
                    ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-950/20" 
                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-950/20"
                )}
              >
                <Flame size={14} className={cn(stressIntervalActive && "animate-bounce")} />
                <span>{stressIntervalActive ? "Detener Stress Test" : "Lanzar Stress Test"}</span>
              </button>
            </div>
          </div>

          <div className="p-8 space-y-8">
            {/* Conceptual Interactive Visual Map of the Hybrid Architecture */}
            <div className="space-y-3 text-left">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">
                Esquema Interactivo de Flujo de Datos Híbrido
              </span>
              
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 relative overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-center">
                  
                  {/* Column 1: Client Interfaces */}
                  <div className="space-y-3 bg-slate-900/40 p-4 rounded-2xl border border-slate-800/40 text-center">
                    <p className="text-[9px] font-black text-[#10b981] tracking-widest uppercase">1. Apps Cliente</p>
                    <div className="space-y-2">
                      <div className="p-2 bg-slate-950 rounded-xl border border-slate-800 text-xs font-semibold text-slate-300">
                        📱 App Móvil POS
                      </div>
                      <div className="p-2 bg-slate-950 rounded-xl border border-slate-800 text-xs font-semibold text-slate-300">
                        💻 Panel Operativo
                      </div>
                      <div className="p-2 bg-slate-950 rounded-xl border border-slate-800 text-xs font-semibold text-slate-300">
                        🌐 Portal de Clientes
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Load Balancer & API Gateway */}
                  <div className="flex flex-col items-center justify-center p-3">
                    <div className="w-12 h-12 bg-indigo-600/10 border-2 border-indigo-500 rounded-full flex items-center justify-center text-indigo-400 font-bold shadow-lg animate-pulse">
                      <Shuffle size={20} />
                    </div>
                    <p className="text-[9px] font-black text-indigo-400 tracking-widest uppercase mt-2">2. API Gateway</p>
                    <p className="text-[8px] text-slate-400 font-semibold mt-0.5 text-center">Balanceo y Filtros JWT</p>
                    {/* Visual trace animation */}
                    <div className="w-full h-0.5 bg-gradient-to-r from-indigo-500 to-emerald-500 mt-2 rounded animate-pulse" />
                  </div>

                  {/* Column 3: Modular Backends / Docker Containers */}
                  <div className="space-y-3 text-center bg-slate-900/40 p-4 rounded-2xl border border-slate-800/40 col-span-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-[#10b981] tracking-widest uppercase">3. Microservicios Cloud Run</span>
                      <span className="text-[8px] font-bold text-slate-400">({nodesScale} Pods x Serv)</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-left">
                      <div className={cn(
                        "p-2 rounded-xl text-[9.5px] font-semibold border flex items-center justify-between transition-colors duration-150",
                        activeServices.authGateway ? "bg-slate-950 border-indigo-500/30 text-slate-200" : "bg-slate-900/30 border-slate-800/40 text-slate-600"
                      )} onClick={() => setActiveServices({...activeServices, authGateway: !activeServices.authGateway})}>
                        <span>🔑 Auth Router</span>
                        <span className={cn("w-1.5 h-1.5 rounded-full", activeServices.authGateway ? "bg-[#10b981] animate-ping" : "bg-slate-600")} />
                      </div>

                      <div className={cn(
                        "p-2 rounded-xl text-[9.5px] font-semibold border flex items-center justify-between transition-colors duration-150",
                        activeServices.posService ? "bg-slate-950 border-emerald-500/30 text-slate-200" : "bg-slate-900/30 border-slate-800/40 text-slate-600"
                      )} onClick={() => setActiveServices({...activeServices, posService: !activeServices.posService})}>
                        <span>📊 Ventas POS</span>
                        <span className={cn("w-1.5 h-1.5 rounded-full", activeServices.posService ? "bg-[#10b981] animate-ping" : "bg-slate-600")} />
                      </div>

                      <div className={cn(
                        "p-2 rounded-xl text-[9.5px] font-semibold border flex items-center justify-between transition-colors duration-150",
                        activeServices.logisticEngine ? "bg-slate-950 border-amber-500/30 text-slate-200" : "bg-slate-900/30 border-slate-800/40 text-slate-600"
                      )} onClick={() => setActiveServices({...activeServices, logisticEngine: !activeServices.logisticEngine})}>
                        <span>🚚 Logística API</span>
                        <span className={cn("w-1.5 h-1.5 rounded-full", activeServices.logisticEngine ? "bg-[#10b981] animate-ping" : "bg-slate-600")} />
                      </div>

                      <div className={cn(
                        "p-2 rounded-xl text-[9.5px] font-semibold border flex items-center justify-between transition-colors duration-150",
                        activeServices.smartAI ? "bg-slate-950 border-indigo-500/30 text-slate-200" : "bg-slate-900/30 border-slate-800/40 text-slate-600"
                      )} onClick={() => setActiveServices({...activeServices, smartAI: !activeServices.smartAI})}>
                        <span>🤖 Predicciones AI</span>
                        <span className={cn("w-1.5 h-1.5 rounded-full", activeServices.smartAI ? "bg-[#10b981] animate-ping" : "bg-slate-600")} />
                      </div>
                    </div>

                    {/* Show scaled container instances visually */}
                    <div className="pt-2 border-t border-slate-800/60 flex items-center justify-start gap-1 flex-wrap">
                      {Array.from({ length: nodesScale }).map((_, i) => (
                        <div 
                          key={i} 
                          className="w-4 h-4 bg-emerald-500/10 border border-emerald-500/30 rounded flex items-center justify-center text-[10px] animate-pulse"
                          title={`Contenedor Docker instance #${i+1} en producción`}
                        >
                          🐳
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Column 4: Firestore Unified Database Storage */}
                  <div className="space-y-2 text-center bg-indigo-950/20 p-4 rounded-2xl border border-indigo-500/10 flex flex-col items-center">
                    <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
                      <Database size={20} />
                    </div>
                    <p className="text-[9px] font-black text-indigo-400 tracking-widest uppercase">4. Base de Datos Centralizada</p>
                    <p className="text-[10px] text-slate-300 font-bold bg-slate-950 py-1 px-3 rounded-lg border border-indigo-500/10 mt-1 max-w-full truncate">
                      🗄️ Firestore (Global)
                    </p>
                    <div className="flex gap-1.5 text-[8px] font-black uppercase text-slate-400 tracking-wider pt-1.5">
                      <span className="text-[#10b981] bg-emerald-500/10 px-1 py-0.5 rounded">Replicada</span>
                      <span className="text-indigo-400 bg-indigo-500/10 px-1 py-0.5 rounded">En tiempo real</span>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* Performance and Latency Statistics Board */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
              
              <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-2xl">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Tráfico de Red</span>
                <p className="text-xl font-black text-white mt-1 flex items-center gap-1.5">
                  <Activity size={16} className="text-indigo-500 animate-pulse" />
                  <span>{simRPS} RPS</span>
                </p>
                <div className="w-full bg-slate-800 h-1 rounded overflow-hidden mt-2.5">
                  <div 
                    className="bg-indigo-500 h-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (simRPS / 1200) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-2xl">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Latencia API</span>
                <p className="text-xl font-black text-[#10b981] mt-1 flex items-center gap-1.5">
                  <Wifi size={16} className="text-[#10b981] animate-pulse" />
                  <span>{simLatency} ms</span>
                </p>
                <p className="text-[8px] text-slate-400 mt-2 font-bold uppercase tracking-wider">Altísima Velocidad (HTTP/3)</p>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-2xl">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Carga Promedio Nodos</span>
                <p className={cn(
                  "text-xl font-black mt-1 flex items-center gap-1.5",
                  simCpuCurrent > 80 ? "text-rose-500" : simCpuCurrent > 60 ? "text-amber-500" : "text-white"
                )}>
                  <Cpu size={16} className="text-slate-400 animate-bounce" />
                  <span>{simCpuCurrent}%</span>
                </p>
                <div className="w-full bg-slate-800 h-1 rounded overflow-hidden mt-2.5">
                  <div 
                    className={cn(
                      "h-full transition-all duration-300",
                      simCpuCurrent > 80 ? "bg-rose-500" : simCpuCurrent > 60 ? "bg-amber-500" : "bg-emerald-500"
                    )}
                    style={{ width: `${simCpuCurrent}%` }}
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-2xl">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Tasa de Disponibilidad</span>
                <p className="text-xl font-black text-yellow-400 mt-1 flex items-center gap-1.5">
                  <Sparkles size={16} className="text-yellow-400 animate-pulse" />
                  <span>99.998%</span>
                </p>
                <p className="text-[8px] text-slate-400 mt-2 font-bold uppercase tracking-wider">Multi-región act-act</p>
              </div>

            </div>

            {/* Interactive Control Configuration Sliders */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left border-t border-slate-800/60 pt-6">
              
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Layers size={14} className="text-indigo-400" /> Escalado de Contenedores Docker (Pods Cloud Run)
                  </label>
                  <span className="text-xs font-black text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/10">
                    {nodesScale} {nodesScale === 1 ? "instancia" : "instancias"}
                  </span>
                </div>
                
                <input 
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={nodesScale}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setNodesScale(val);
                    setSimLogs(prev => [
                      `⚙️ [Ajuste de Carga] Kubernetes / Cloud run configurado para un mínimo de ${val} pods activos.`,
                      ...prev.slice(0, 7)
                    ]);
                  }}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <p className="text-[9px] text-slate-450 leading-relaxed font-semibold">
                  Aprovisiona dinámicamente más contenedores Docker independientes para mitigar picos altos de solicitudes (RPS) durante promociones, posibilitando una concurrencia ilimitada.
                </p>
              </div>

              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Database size={14} className="text-[#10b981]" /> Pool de Conexión a Base de Datos (Firestore)
                  </label>
                  <span className="text-xs font-black text-[#10b981] bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/10">
                    Max: {dbConnectionLimit} oyentes
                  </span>
                </div>
                
                <input 
                  type="range"
                  min="50"
                  max="500"
                  step="50"
                  value={dbConnectionLimit}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setDbConnectionLimit(val);
                    setSimLogs(prev => [
                      `🖥️ [Parámetro de Red] Límite máximo de conexiones concurrentes establecido en ${val} sockets.`,
                      ...prev.slice(0, 7)
                    ]);
                  }}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <p className="text-[9px] text-slate-450 leading-relaxed font-semibold">
                  Evita que picos imprevistos saturen las lecturas. El almacenamiento modular de Firestore escala de forma nativa sin cuellos de botella ni bloqueos de transacciones.
                </p>
              </div>

            </div>

            {/* Real-time Simulated Network and Firestore Logs Console */}
            <div className="space-y-3 text-left">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Lock size={12} className="text-amber-500" /> Registro de Transacciones Sincrónicas & Seguridad JWT
                </span>
                <span className="text-[8px] font-bold text-slate-500 font-mono tracking-widest">
                  ESTADO: {simStatus}
                </span>
              </div>

              <div className="bg-black/80 rounded-2xl p-4 border border-slate-800/80 font-mono text-[9.5px] leading-relaxed text-emerald-400 space-y-1.5 max-h-44 overflow-y-auto font-semibold scrollbar-none">
                {simLogs.map((log, idx) => (
                  <p key={idx} className="truncate border-b border-white/5 pb-1 last:border-0">{log}</p>
                ))}
              </div>
            </div>

            {/* Explanatory Cards detailing Quality, Security and Scalability */}
            <div className="hidden md:grid grid-cols-3 gap-6 text-left border-t border-slate-800/60 pt-6">
              
              <div className="space-y-1">
                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">🛡️ Seguridad</span>
                <p className="text-[10px] text-slate-300 font-bold leading-relaxed">
                  Autenticación asimétrica + Reglas de control en Firestore garantizan que los datos estén aislados por rol (POS, Manager, Logística) protegiendo el negocio contra filtraciones.
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-black text-[#10b981] uppercase tracking-widest">📋 Calidad</span>
                <p className="text-[10px] text-slate-300 font-bold leading-relaxed">
                  Modularidad absoluta del código. Cada API o microservicio posee su propio alcance y manejo de excepciones, evitando fallas en cascada y facilitando el mantenimiento.
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">🚀 Escalabilidad</span>
                <p className="text-[10px] text-slate-300 font-bold leading-relaxed">
                  Docker containers en Cloud Run escalan a cero cuando no se usan (ahorrando costos) y se duplican automáticamente en milisegundos ante ráfagas de ventas concurrentes.
                </p>
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

        {/* Coupon Management Card */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden mt-8">
          <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex items-center space-x-4">
            <div className="p-3 bg-white rounded-2xl shadow-sm text-indigo-600">
              <Tag size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Gestor de Cupones de Descuento</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Crear, activar y administrar promociones</p>
            </div>
          </div>

          <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Create Coupon Form */}
            <div className="lg:col-span-1 space-y-4">
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider mb-2">Crear Nuevo Cupón</h3>
              
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">Código (Único)</label>
                <input 
                  type="text" 
                  placeholder="Ej: FIESTAS20"
                  className="w-full h-11 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold uppercase text-slate-800 animate-none focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
                  value={newCoupon.code}
                  onChange={e => setNewCoupon({...newCoupon, code: e.target.value})}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">Título / Nombre</label>
                <input 
                  type="text" 
                  placeholder="Ej: Descuento dieciochero"
                  className="w-full h-11 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
                  value={newCoupon.title}
                  onChange={e => setNewCoupon({...newCoupon, title: e.target.value})}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">Descripción / Beneficio</label>
                <input 
                  type="text" 
                  placeholder="Ej: 20% descuento total"
                  className="w-full h-11 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
                  value={newCoupon.desc}
                  onChange={e => setNewCoupon({...newCoupon, desc: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</label>
                  <select 
                    className="w-full h-11 bg-slate-50 border border-slate-100 rounded-xl px-3 text-xs font-bold text-slate-800"
                    value={newCoupon.discountType}
                    onChange={e => setNewCoupon({...newCoupon, discountType: e.target.value as any})}
                  >
                    <option value="percent">Porcentaje (%)</option>
                    <option value="fixed">Monto Fijo ($)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor</label>
                  <input 
                    type="number" 
                    className="w-full h-11 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-slate-800"
                    value={newCoupon.discountValue}
                    onChange={e => setNewCoupon({...newCoupon, discountValue: Number(e.target.value)})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nivel Mínimo</label>
                  <select 
                    className="w-full h-11 bg-slate-50 border border-slate-100 rounded-xl px-3 text-xs font-bold text-slate-800"
                    value={newCoupon.minTier}
                    onChange={e => setNewCoupon({...newCoupon, minTier: e.target.value as any})}
                  >
                    <option value="BRONZE">Bronce</option>
                    <option value="SILVER">Plata</option>
                    <option value="GOLD">Oro</option>
                    <option value="PLATINUM">Platino</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Icono / Emoji</label>
                  <input 
                    type="text" 
                    className="w-full h-11 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-center text-slate-800"
                    value={newCoupon.img}
                    onChange={e => setNewCoupon({...newCoupon, img: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">Esquema de Color</label>
                <select 
                  className="w-full h-11 bg-slate-50 border border-slate-100 rounded-xl px-3 text-xs font-bold text-slate-800"
                  value={newCoupon.color}
                  onChange={e => setNewCoupon({...newCoupon, color: e.target.value})}
                >
                  <option value="bg-indigo-50 border-indigo-100 text-indigo-600">Indigo Soft</option>
                  <option value="bg-rose-50 border-rose-100 text-rose-600">Rose Soft (Verano)</option>
                  <option value="bg-emerald-50 border-emerald-100 text-emerald-600">Emerald Soft (Eco / Agro)</option>
                  <option value="bg-amber-50 border-amber-100 text-amber-600">Amber Soft (Panadería)</option>
                  <option value="bg-purple-50 border-purple-100 text-purple-600">Purple Soft (Vino/VIP)</option>
                </select>
              </div>

              {couponError && (
                <p className="text-xs font-bold text-rose-500">{couponError}</p>
              )}

              <button 
                type="button"
                onClick={handleCreateCoupon}
                className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center space-x-2 shadow-sm transition-colors"
              >
                <Plus size={16} />
                <span>Registrar Cupón</span>
              </button>
            </div>

            {/* Coupons List */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider mb-2">Cupones Registrados ({coupons.length})</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {coupons.map((coupon) => (
                  <div 
                    key={coupon.id} 
                    className={cn(
                      "p-4 rounded-2xl border flex items-center justify-between transition-all",
                      coupon.color || "bg-slate-50 border-slate-100 text-slate-600",
                      !coupon.active && "opacity-50 grayscale"
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{coupon.img || "🎟️"}</span>
                      <div>
                        <div className="flex items-center space-x-2">
                          <p className="font-extrabold text-sm">{coupon.code}</p>
                          <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-black/10">
                            {coupon.minTier}
                          </span>
                        </div>
                        <p className="text-xs font-bold opacity-90 mt-0.5 text-slate-800">{coupon.title}</p>
                        <p className="text-[10px] opacity-75">{coupon.desc}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button 
                        type="button"
                        onClick={() => handleToggleCoupon(coupon.id, !coupon.active)}
                        className={cn(
                          "px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider",
                          coupon.active ? "bg-emerald-500 text-white" : "bg-slate-300 text-slate-700"
                        )}
                      >
                        {coupon.active ? "Activo" : "Pausado"}
                      </button>

                      <button 
                        type="button"
                        onClick={() => handleDeleteCoupon(coupon.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {coupons.length === 0 && (
                  <p className="text-xs text-slate-400 font-bold italic col-span-2">No hay cupones configurados.</p>
                )}
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
