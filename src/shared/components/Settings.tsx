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
  Truck
} from "lucide-react";
import { collection, getDoc, getDocs, doc, setDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot, where, limit, addDoc, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, handleFirestoreError, OperationType, functions } from "../../lib/firebase";
import { cn, formatChileanPhone } from "../../lib/utils";
import { motion } from "motion/react";

import { useAuth } from "../../contexts/AuthContext";

export function Settings() {
  const { profile, user } = useAuth();
  const [activeTab, setActiveTab] = useState<"general" | "users" | "audit">("general");
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [searchEmail, setSearchEmail] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<any[] | null>(null);

  // System Audit State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditPageSize, setAuditPageSize] = useState(25);

  // New Audit Filtering and Emergency Actions State
  const [operatorEmailFilter, setOperatorEmailFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [emergencyCloseLoading, setEmergencyCloseLoading] = useState(false);
  const [emergencyCloseSuccess, setEmergencyCloseSuccess] = useState<string | null>(null);

  const filteredAuditLogs = React.useMemo(() => {
    return auditLogs.filter(log => {
      const matchesEmail = !operatorEmailFilter || (log.operatorEmail || "").toLowerCase().includes(operatorEmailFilter.toLowerCase());
      const matchesAction = !actionFilter || (log.action || "").toLowerCase().includes(actionFilter.toLowerCase()) || (log.actionType || "").toLowerCase().includes(actionFilter.toLowerCase());
      
      let matchesDate = true;
      if (log.timestamp) {
        const logTime = new Date(log.timestamp).getTime();
        if (startDateFilter) {
          const startTime = new Date(startDateFilter).getTime();
          if (logTime < startTime) matchesDate = false;
        }
        if (endDateFilter) {
          const endTime = new Date(endDateFilter).getTime() + 24 * 60 * 60 * 1000 - 1;
          if (logTime > endTime) matchesDate = false;
        }
      }
      return matchesEmail && matchesAction && matchesDate;
    });
  }, [auditLogs, operatorEmailFilter, actionFilter, startDateFilter, endDateFilter]);

  const handleRemoteEmergencyCloseCajas = async () => {
    if (!window.confirm("¿Está seguro de que desea CERRAR REMOTAMENTE todas las cajas abiertas del sistema? Esta acción restaurará la seguridad de los terminales POS inmediatamente.")) {
      return;
    }
    setEmergencyCloseLoading(true);
    setEmergencyCloseSuccess(null);
    try {
      const q = query(collection(db, "cashRegisters"), where("status", "==", "open"));
      const snap = await getDocs(q);
      if (snap.empty) {
        setEmergencyCloseSuccess("No hay cajas activas abiertas en este momento.");
        setEmergencyCloseLoading(false);
        return;
      }
      
      let closedCount = 0;
      for (const d of snap.docs) {
        await updateDoc(doc(db, "cashRegisters", d.id), {
          status: "closed",
          closedAt: serverTimestamp(),
          closedBy: profile?.uid || "EMERGENCY_REMOTELY_CLOSED"
        });
        closedCount++;
      }
      
      // Log this emergency event in role_audit
      const auditRef = collection(db, "role_audit");
      await addDoc(auditRef, {
        action: "EMERGENCY_BOX_CLOSE",
        operatorEmail: profile?.email || "admin@stockflow.cl",
        timestamp: serverTimestamp(),
        details: `Cierre remoto de emergencia de ${closedCount} caja(s) de venta.`
      });

      setEmergencyCloseSuccess(`Se cerraron con éxito ${closedCount} caja(s) abiertas.`);
      fetchAuditLogs();
    } catch (err: any) {
      console.error("Emergency registers close error:", err);
      alert("Error al cerrar cajas remotamente: " + err.message);
    } finally {
      setEmergencyCloseLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    setIsAuditLoading(true);
    setAuditError(null);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/audit/logs?limit=${auditPageSize}`, {
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.success) {
        setAuditLogs(data.logs || []);
      } else {
        throw new Error(data.error || "Fallo inesperado");
      }
    } catch (err: any) {
      console.warn("Fallo al cargar registros en el backend, intentando snapshot directo...", err);
      try {
        const auditCol = collection(db, "role_audit");
        const qDocs = query(auditCol, orderBy("timestamp", "desc"), limit(auditPageSize));
        const snap = await getDocs(qDocs);
        const fbLogs = snap.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            ...d,
            timestamp: d.timestamp?.toDate ? d.timestamp.toDate().toISOString() : d.timestamp
          };
        });
        setAuditLogs(fbLogs);
      } catch (innerErr: any) {
        console.error("Direct Firestore read fallback failed as well:", innerErr);
        setAuditError(innerErr.message || String(innerErr));
      }
    } finally {
      setIsAuditLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "audit") {
      fetchAuditLogs();
    }
  }, [activeTab, auditPageSize]);

  // API Gateway Monitoring State
  const [gatewayStatus, setGatewayStatus] = useState<any>(null);
  const [isGatewayLoading, setIsGatewayLoading] = useState(false);
  const [gatewayError, setGatewayError] = useState<string | null>(null);
  const [latencyHistory, setLatencyHistory] = useState<number[]>([]);

  // Function to query local API Gateway health endpoint with exact ms tracking
  const checkGatewayHealth = async () => {
    setIsGatewayLoading(true);
    setGatewayError(null);
    const startTime = performance.now();
    try {
      const res = await fetch("/api/health");
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      setGatewayStatus({
        ...data,
        responseTime: duration
      });
      setLatencyHistory(prev => {
        const updated = [...prev, duration];
        if (updated.length > 5) updated.shift();
        return updated;
      });
    } catch (err: any) {
      console.warn("Error pinging API Gateway:", err);
      setGatewayError(err.message || String(err));
      setGatewayStatus((prev: any) => ({
        ...(prev || {}),
        status: "offline",
        responseTime: 0
      }));
    } finally {
      setIsGatewayLoading(false);
    }
  };

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
        // High-performance query leveraging the users collection index sorting by creation time
        const q = query(collection(db, "users"), orderBy("createdAt", "desc"), limit(50));
        const snap = await getDocs(q);
        setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
      } catch (err) {
        console.warn("Index-sorted user fetch warm-up failed, falling back to unordered list:", err);
        try {
          const qSimple = query(collection(db, "users"));
          const snapSimple = await getDocs(qSimple);
          setUsers(snapSimple.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
        } catch (innerErr) {
          console.error("Error fetching all users fallback:", innerErr);
        }
      }
    };
    fetchUsers();
  }, [profile?.role]);

  useEffect(() => {
    if (activeTab === "general") {
      checkGatewayHealth();
      const interval = setInterval(checkGatewayHealth, 10000); // 10 seconds interval
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const handleSearchUser = async () => {
    const term = searchEmail.trim();
    if (!term) {
      setSearchResult(null);
      return;
    }
    setIsSearching(true);
    try {
      const termLower = term.toLowerCase();
      // Optimized starts-with range query leveraging the users collection indexes
      const qEmail = query(
        collection(db, "users"),
        where("email", ">=", termLower),
        where("email", "<=", termLower + "\uf8ff")
      );
      const snapEmail = await getDocs(qEmail);
      let results = snapEmail.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

      if (results.length === 0) {
        const qName = query(
          collection(db, "users"),
          where("name", ">=", term),
          where("name", "<=", term + "\uf8ff")
        );
        const snapName = await getDocs(qName);
        const nameResults = snapName.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        results = [...results, ...nameResults];
      }

      const uniqueResults = Array.from(new Map(results.map(item => [item.id, item])).values());
      setSearchResult(uniqueResults);
    } catch (err) {
      console.warn("Index-based search failed or missing, compiling fallback scan client-side:", err);
      try {
        const snap = await getDocs(collection(db, "users"));
        const allUsers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        const matches = allUsers.filter((u: any) => 
          (u.email && u.email.toLowerCase().includes(term.toLowerCase())) ||
          (u.name && u.name.toLowerCase().includes(term.toLowerCase()))
        );
        setSearchResult(matches);
      } catch (innerErr) {
        console.error("Scanning users collection failed:", innerErr);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    setIsSaving(true);
    try {
      const setUserRoleCall = httpsCallable(functions, "setUserRole");
      const res: any = await setUserRoleCall({ userId, role: newRole });
      
      if (res.data?.success) {
        const previousRole = users.find(u => u.id === userId)?.role || "unknown";
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
        if (searchResult) {
          setSearchResult(prev => prev ? prev.map(u => u.id === userId ? { ...u, role: newRole } : u) : null);
        }
        
        // Asynchronously post to our new secure centralized audit log
        user?.getIdToken().then(token => {
          fetch("/api/audit/log", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              ...(token ? { "Authorization": `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
              operatorEmail: profile?.email || "admin@stockflow.com",
              operatorUid: profile?.uid || "sys",
              action: "ROLE_CHANGE",
              targetId: userId,
              details: { previousRole, newRole }
            })
          }).catch(err => console.error("Failed to post audit log:", err));
        });

        alert(`Rol actualizado correctamente a ${newRole} mediante Cloud Function`);
      } else {
        alert("Error: " + (res.data?.message || "No se pudo actualizar el rol"));
      }
    } catch (err: any) {
      console.error("Error al actualizar rol:", err);
      alert("Error al actualizar rol: " + (err.message || err));
    } finally {
      setIsSaving(false);
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

      {/* Sub-tabs Navigation */}
      <div className={cn("flex space-x-1 p-1 bg-slate-100 rounded-2xl", profile?.role === "admin" ? "max-w-xl" : "max-w-md")}>
        <button
          type="button"
          onClick={() => {
            setActiveTab("general");
            setSearchResult(null);
            setSearchEmail("");
          }}
          className={cn(
            "flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center space-x-2 border-none cursor-pointer outline-none",
            activeTab === "general" 
              ? "bg-white text-slate-800 shadow-sm" 
              : "text-slate-500 hover:text-slate-800 bg-transparent"
          )}
        >
          <SettingsIcon size={16} />
          <span>General</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={cn(
            "flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center space-x-2 border-none cursor-pointer outline-none",
            activeTab === "users" 
              ? "bg-white text-slate-800 shadow-sm" 
              : "text-slate-500 hover:text-slate-800 bg-transparent"
          )}
        >
          <Users size={16} />
          <span>Gestión de Usuarios</span>
        </button>
        {profile?.role === "admin" && (
          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={cn(
              "flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center space-x-2 border-none cursor-pointer outline-none",
              activeTab === "audit" 
                ? "bg-white text-slate-800 shadow-sm" 
                : "text-slate-500 hover:text-slate-800 bg-transparent"
            )}
          >
            <ShieldCheck size={16} />
            <span>Auditoría</span>
          </button>
        )}
      </div>

      {activeTab === "general" && (
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

          {/* API Gateway Health Monitor Card */}
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 space-y-6 md:col-span-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-slate-100 text-slate-700 rounded-2xl flex items-center justify-center">
                  <Globe size={24} className={cn(isGatewayLoading ? "animate-spin text-indigo-600" : "text-slate-600")} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800 tracking-tight">API Gateway Health</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">Estado y Latencia de Servicios Independientes</p>
                </div>
              </div>

              <button
                type="button"
                disabled={isGatewayLoading}
                onClick={(e) => {
                  e.preventDefault();
                  checkGatewayHealth();
                }}
                className="h-9 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center space-x-1 transition-colors outline-none cursor-pointer border-none"
              >
                <RefreshCw size={12} className={cn(isGatewayLoading && "animate-spin")} />
                <span>{isGatewayLoading ? "Ping..." : "Probar Conexión"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100">
              {/* Overall Status */}
              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gateway Status</span>
                <div className="flex items-center space-x-2">
                  <span className={cn(
                    "w-3 h-3 rounded-full animate-pulse",
                    gatewayStatus?.status === "online" ? "bg-emerald-500" : gatewayStatus?.status === "degraded" ? "bg-amber-500" : "bg-rose-500"
                  )} />
                  <span className="text-sm font-extrabold uppercase tracking-wider text-slate-800">
                    {gatewayStatus?.status === "online" ? "Operativo" : gatewayStatus?.status === "degraded" ? "Degradado" : gatewayStatus?.status === "offline" ? "Sin Conexión" : "Verificando..."}
                  </span>
                </div>
              </div>

              {/* Real-time Response Time */}
              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tiempo de Respuesta</span>
                <p className="text-sm font-extrabold text-slate-800">
                  {gatewayStatus?.status === "offline" ? (
                    <span className="text-rose-500">Error / Timeout</span>
                  ) : gatewayStatus?.responseTime ? (
                    <span className={cn(
                      gatewayStatus.responseTime < 150 ? "text-emerald-500" : gatewayStatus.responseTime < 350 ? "text-amber-500" : "text-rose-500"
                    )}>
                      {gatewayStatus.responseTime} <span className="text-xs text-slate-400 font-bold">ms</span>
                    </span>
                  ) : (
                    <span className="text-slate-400">Calculando...</span>
                  )}
                </p>
              </div>

              {/* Version & Arch details */}
              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Versión de API</span>
                <p className="text-xs font-black text-slate-700">
                  v{gatewayStatus?.apiVersion || "2.0.0"} <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight bg-slate-200/50 px-1.5 py-0.5 rounded ml-1">{gatewayStatus?.architecture || "hybrid-modular"}</span>
                </p>
              </div>
            </div>

            {/* Micro Latency History Line */}
            {latencyHistory.length > 0 && gatewayStatus?.status !== "offline" && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Historial de Ráfagas (ms)</span>
                <div className="flex items-center space-x-3">
                  {latencyHistory.map((pt, i) => (
                    <div key={i} className="flex flex-col items-center">
                      <span className={cn("text-[8px] font-mono font-bold", pt < 150 ? "text-emerald-500" : pt < 350 ? "text-amber-500" : "text-rose-500")}>
                        {pt}ms
                      </span>
                      <div className="w-8 bg-slate-200 rounded-full h-1 mt-0.5 overflow-hidden">
                        <div 
                          className={cn("h-full rounded-full", pt < 150 ? "bg-emerald-500" : pt < 350 ? "bg-amber-500" : "bg-rose-500")}
                          style={{ width: `${Math.min(100, Math.max(15, (pt / 500) * 100))}%` }} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error Message if offline */}
            {gatewayError && (
              <div className="flex items-start space-x-2.5 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <div className="text-xs">
                  <p className="font-extrabold">Fallo en Conexión: {gatewayError}</p>
                  <p className="text-[10px] font-medium leading-relaxed opacity-90 mt-0.5">El servidor de desarrollo no responde en `/api/health`. Certifique que el backend esté montado y escuchando peticiones en el puerto 3000.</p>
                </div>
              </div>
            )}

            {/* Individual Modular Diagnostics */}
            {gatewayStatus?.modules && (
              <div className="space-y-3.5">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Diagnóstico por Módulo</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {Object.entries(gatewayStatus.modules).map(([name, mod]: [string, any]) => (
                    <div key={name} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col justify-between hover:bg-white hover:border-slate-200 transition-all">
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{name === "barcode" ? "Código Barras" : name === "payments" ? "Pasarela Pago" : name === "comms" ? "Alertas/Comms" : name.toUpperCase()}</span>
                        <p className="text-[10px] font-bold text-slate-700 leading-normal mt-0.5">{mod.message || mod.statusText || "Servicio en línea"}</p>
                      </div>
                      <div className="flex items-center space-x-1.5 mt-2 pt-2 border-t border-slate-200/50">
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          mod.status === "online" ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                        )} />
                        <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">
                          {mod.status === "online" ? "OK" : "Error"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* User Management removed from general tab */}

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
      )}

      {activeTab === "users" && (
        <div className="space-y-8 pb-20">
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-white rounded-2xl shadow-sm text-indigo-600">
                  <Users size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 tracking-tight">Gestión de Usuarios</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Control de accesos y asignación de roles</p>
                </div>
              </div>

              {/* Buscar usuario por email */}
              <div className="flex items-center space-x-2">
                <input 
                  type="text"
                  placeholder="Buscar por email o nombre..."
                  value={searchEmail}
                  onChange={(e) => {
                    setSearchEmail(e.target.value);
                    if (!e.target.value.trim()) setSearchResult(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSearchUser();
                    }
                  }}
                  className="w-64 h-11 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  type="button"
                  onClick={handleSearchUser}
                  disabled={isSearching}
                  className="h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-4 text-xs font-black uppercase tracking-wider flex items-center justify-center transition-colors disabled:opacity-50"
                >
                  {isSearching ? "Buscando..." : "Buscar"}
                </button>
              </div>
            </div>
            
            <div className="p-8 space-y-4">
              <div className="grid grid-cols-1 gap-4">
                {(searchResult !== null ? searchResult : users).map((u) => (
                  <div key={u.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:bg-white hover:border-indigo-100 transition-all">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-slate-400 font-black text-lg shadow-sm border border-slate-50 uppercase">
                        {u.name?.charAt(0) || u.email?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{u.name || "Usuario Sin Nombre"}</p>
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
                        <option value="driver">Transportista / Driver</option>
                      </select>
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        u.role === "admin" ? "bg-indigo-600" : u.role === "manager" ? "bg-emerald-500" : u.role === "logistics" ? "bg-amber-500" : "bg-slate-300"
                      )} title={u.role} />
                    </div>
                  </div>
                ))}

                {(searchResult !== null ? searchResult : users).length === 0 && (
                  <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-sm font-bold text-slate-400">No se encontraron usuarios.</p>
                  </div>
                )}
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
        </div>
      )}

      {activeTab === "audit" && (
        <div className="space-y-6">
          {/* emergency button panel (Botonera de Emergencia) */}
          <div className="bg-rose-50 border border-rose-200 p-8 rounded-[3rem] shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center space-x-6">
              <div className="w-16 h-16 bg-white rounded-[1.5rem] flex items-center justify-center text-rose-600 shadow-sm border border-rose-100">
                <AlertCircle size={32} />
              </div>
              <div>
                <h2 className="text-xl font-black text-rose-950 tracking-tight">Botonera de Emergencia Corporativa</h2>
                <p className="text-sm font-medium text-rose-800 max-w-md">
                  En caso de discrepancias detectadas o alertas de seguridad, use este botón para forzar el cierre remoto inmediato de todas las cajas registradoras abiertas en cualquier terminal.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-3 w-full md:w-auto">
              <button 
                type="button"
                onClick={handleRemoteEmergencyCloseCajas}
                disabled={emergencyCloseLoading}
                className="w-full md:w-auto bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white font-black px-8 py-4 rounded-2xl shadow-xl shadow-rose-100 transition-all flex items-center justify-center space-x-2 text-xs uppercase tracking-widest cursor-pointer border-none outline-none"
              >
                <RefreshCw size={16} className={cn(emergencyCloseLoading && "animate-spin")} />
                <span>{emergencyCloseLoading ? "Cerrando Cajas..." : "Forzar Cierre de Cajas Abiertas"}</span>
              </button>
              {emergencyCloseSuccess && (
                <p className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">
                  {emergencyCloseSuccess}
                </p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-white rounded-2xl shadow-sm text-indigo-600">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 tracking-tight">Historial de Auditoría de Seguridad</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Registros de mutación de privilegios y gastos</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <select
                  value={auditPageSize}
                  onChange={(e) => setAuditPageSize(Number(e.target.value))}
                  className="bg-slate-50 border border-slate-100 text-xs font-bold rounded-xl px-3 py-2 text-slate-700 cursor-pointer"
                >
                  <option value={10}>10 registros</option>
                  <option value={25}>25 registros</option>
                  <option value={50}>50 registros</option>
                  <option value={100}>100 registros</option>
                </select>
                <button
                  type="button"
                  onClick={fetchAuditLogs}
                  disabled={isAuditLoading}
                  className="p-3 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-all cursor-pointer border-none flex items-center justify-center outline-none"
                >
                  <RefreshCw size={16} className={cn(isAuditLoading && "animate-spin")} />
                </button>
              </div>
            </div>

            {/* Audit Log Filters Panel */}
            <div className="p-6 bg-slate-50/30 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Email del Operador</label>
                <input
                  type="text"
                  placeholder="Filtrar por email..."
                  value={operatorEmailFilter}
                  onChange={(e) => setOperatorEmailFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Acción / Evento</label>
                <input
                  type="text"
                  placeholder="Ej: ROLE_CHANGE, EXP_DELETED..."
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Desde Fecha</label>
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => setStartDateFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Hasta Fecha</label>
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={(e) => setEndDateFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="p-6">
              {isAuditLoading && auditLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-bold flex flex-col items-center justify-center space-y-2">
                  <RefreshCw className="animate-spin text-slate-300" size={32} />
                  <span>Cargando registros de auditoría...</span>
                </div>
              ) : auditError ? (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-center text-rose-600 text-xs font-bold">
                  {auditError}
                </div>
              ) : filteredAuditLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-bold">
                  No se encontraron registros de auditoría para los criterios ingresados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="pb-4 pl-4">Fecha / Hora</th>
                        <th className="pb-4">Operador (Email)</th>
                        <th className="pb-4">Acción</th>
                        <th className="pb-4">Target / ID</th>
                        <th className="pb-4 pr-4">Detalles del Cambio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredAuditLogs.map((log: any) => {
                        const dateStr = log.timestamp 
                          ? new Date(log.timestamp).toLocaleString("es-CL") 
                          : "Reciente";
                        
                        let badgeColor = "bg-slate-100 text-slate-700";
                        if (log.action === "ROLE_CHANGE" || log.action?.includes("MUTATION") || log.action === "EMERGENCY_BOX_CLOSE") {
                          badgeColor = "bg-amber-50 border border-amber-100 text-amber-700";
                        } else if (log.action?.includes("DELETED")) {
                          badgeColor = "bg-rose-50 border border-rose-100 text-rose-700";
                        } else if (log.action?.includes("CREATED")) {
                          badgeColor = "bg-green-50 border border-green-100 text-green-700";
                        }

                        return (
                          <tr key={log.id} className="text-xs text-slate-600 hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 pl-4 font-mono font-medium whitespace-nowrap text-slate-500">{dateStr}</td>
                            <td className="py-4 font-bold text-slate-700 truncate max-w-[180px]">{log.operatorEmail || "sistema@stockflow.com"}</td>
                            <td className="py-4">
                              <span className={cn("px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider", badgeColor)}>
                                {log.action || "SYSTEM_EVENT"}
                              </span>
                            </td>
                            <td className="py-4 font-mono text-[10px] text-slate-400 truncate max-w-[120px]">{log.targetId || "N/A"}</td>
                            <td className="py-4 pr-4">
                              <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 max-w-sm overflow-hidden text-[10px] font-mono text-slate-500 whitespace-pre-wrap max-h-24 overflow-y-auto">
                                {typeof log.details === "object" 
                                  ? JSON.stringify(log.details, null, 2) 
                                  : log.details || "Sin detalles adicionales"}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
