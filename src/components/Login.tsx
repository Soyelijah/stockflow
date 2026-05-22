import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { 
  Lock, 
  Mail, 
  ArrowRight, 
  ShieldCheck, 
  Shield, 
  Layers, 
  ShoppingCart, 
  Truck, 
  Laptop,
  Info
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../lib/utils";

type AppRole = "admin" | "manager" | "seller" | "logistics";

export function Login() {
  const { login, register, sendPasswordReset } = useAuth();
  
  const [mode, setMode] = useState<"login" | "recover">("login");
  const [selectedRole, setSelectedRole] = useState<AppRole>("admin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });

  const roles = [
    {
      id: "admin" as AppRole,
      title: "Administrador / CEO",
      subtitle: "Panel de Jefatura y Configuración",
      icon: Shield,
      accentColor: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
      accentHex: "#6366f1",
      defaultEmail: "admin@stockflow.com",
      defaultPass: "admin_stockflow_2026"
    },
    {
      id: "manager" as AppRole,
      title: "Jefe de Operaciones",
      subtitle: "Gestión de Local, Gastos & Proveedores",
      icon: Layers,
      accentColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      accentHex: "#10b981",
      defaultEmail: "manager@stockflow.com",
      defaultPass: "manager_stockflow_2026"
    },
    {
      id: "seller" as AppRole,
      title: "Vendedor / Cajero",
      subtitle: "Terminal POS y Estación de Venta",
      icon: ShoppingCart,
      accentColor: "text-sky-400 bg-sky-500/10 border-sky-500/20",
      accentHex: "#0ea5e9",
      defaultEmail: "seller@stockflow.com",
      defaultPass: "seller_stockflow_2026"
    },
    {
      id: "logistics" as AppRole,
      title: "Personal de Logística",
      subtitle: "Control de Inventario, Bodega & Kardex",
      icon: Truck,
      accentColor: "text-amber-400 bg-amber-500/10 border-amber-500/10",
      accentHex: "#f59e0b",
      defaultEmail: "logistics@stockflow.com",
      defaultPass: "logistics_stockflow_2026"
    }
  ];

  const currentRoleInfo = roles.find(r => r.id === selectedRole) || roles[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const emailToUse = formData.email.trim();
    const passwordToUse = formData.password;

    try {
      if (mode === "login") {
        try {
          // 1. Try real direct email/password login in Firebase Authentication
          await login(emailToUse, passwordToUse);
        } catch (authError: any) {
          // 2. Clear real sandbox auto-provisioning check:
          // If the official tester account doesn't exist yet in this firebase deployment, 
          // we register it dynamically under-the-hood, turning it into a real live account instantly!
          const matchedRole = roles.find(r => r.defaultEmail === emailToUse);
          if (
            (authError.code === "auth/user-not-found" || authError.code === "auth/invalid-credential") &&
            matchedRole && 
            passwordToUse === matchedRole.defaultPass
          ) {
            console.log(`Auto-provisioning real firebase auth account for ${emailToUse}...`);
            await register(emailToUse, passwordToUse, `Operador ${matchedRole.title}`, matchedRole.id);
            // Real login retry
            await login(emailToUse, passwordToUse);
            setSuccess("Cuenta corporativa real provisionada con éxito en Firebase.");
          } else {
            throw authError;
          }
        }
      } else {
        await sendPasswordReset(emailToUse);
        setSuccess("Se ha enviado un correo real de restablecimiento de contraseña.");
        setTimeout(() => setMode("login"), 4000);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
        setError("Las credenciales ingresadas son incorrectas o la cuenta no está registrada.");
      } else if (err.code === "auth/wrong-password") {
        setError("Contraseña incorrecta.");
      } else {
        setError(err.message || "Error al autenticar. Por favor verifica tu conexión externa.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSandboxAccess = async (roleId: AppRole) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    const matched = roles.find(r => r.id === roleId);
    if (!matched) return;

    // Fill inputs visually for user clarity
    setFormData({
      email: matched.defaultEmail,
      password: matched.defaultPass
    });
    setSelectedRole(roleId);

    try {
      try {
        await login(matched.defaultEmail, matched.defaultPass);
      } catch (authError: any) {
        if (authError.code === "auth/user-not-found" || authError.code === "auth/invalid-credential") {
          console.log(`Sandbox mode: Auto-registering real firebase auth user: ${matched.defaultEmail}`);
          await register(matched.defaultEmail, matched.defaultPass, `${matched.title} (Oficial)`, matched.id);
          await login(matched.defaultEmail, matched.defaultPass);
        } else {
          throw authError;
        }
      }
    } catch (err: any) {
      setError("Error en autoprovisionamiento: " + (err.message || err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060608] flex items-center justify-center p-4 sm:p-6 lg:p-8 selection:bg-indigo-500/30 overflow-x-hidden font-sans relative">
      
      {/* Dynamic ambient color glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div 
          className="absolute top-[35%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] blur-[140px] rounded-full transition-all duration-700 opacity-20"
          style={{ backgroundColor: currentRoleInfo.accentHex }}
        />
      </div>

      <div className="max-w-[460px] w-full relative z-10 space-y-6">
        
        {/* Central Logo Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="p-3 bg-slate-900 border border-white/5 rounded-2xl shadow-xl flex items-center justify-center">
            <Laptop className="text-indigo-400" size={26} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">StockFlow <span className="text-indigo-500 font-medium text-xs font-mono">v2.1</span></h1>
            <p className="text-[10px] text-zinc-500 tracking-widest uppercase font-extrabold mt-1">
              Plataforma Corporativa de Inventario y Bodega
            </p>
          </div>
        </div>

        {/* Corporate login portal panel */}
        <div className="bg-[#0b0b0e]/95 border border-white/5 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
          
          <div 
            className="absolute top-0 inset-x-0 h-[2px] transition-all duration-500 rounded-t-3xl" 
            style={{ backgroundColor: currentRoleInfo.accentHex }}
          />

          <div className="mb-6 text-center">
            <h2 className="text-base font-black text-white">Acceso de Trabajadores</h2>
            <p className="text-[10px] text-zinc-500 font-medium mt-0.5">El registro de empleados se realiza a través de Gestión Humana.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Email Address */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" size={15} />
                <input 
                  required
                  type="email" 
                  placeholder="ej. admin@stockflow.com"
                  className="w-full bg-black/40 border border-white/5 hover:border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-zinc-700 focus:outline-none transition-all text-xs"
                  value={formData.email}
                  disabled={loading}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>
            </div>

            {/* Password */}
            {mode === "login" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                    Contraseña
                  </label>
                  <button 
                    type="button"
                    onClick={() => setMode("recover")}
                    className="text-[9px] font-extrabold text-zinc-500 hover:text-indigo-400 transition-colors"
                  >
                    ¿Olvidaste tu clave?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" size={15} />
                  <input 
                    required
                    type="password" 
                    placeholder="••••••••"
                    className="w-full bg-black/40 border border-white/5 hover:border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-zinc-700 focus:outline-none transition-all text-xs"
                    value={formData.password}
                    disabled={loading}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                  />
                </div>
              </div>
            )}

            {/* Feedback Messages */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] rounded-xl font-medium text-left">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] rounded-xl font-medium text-left">
                {success}
              </div>
            )}

            {/* Submit Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/15 text-white font-black py-3 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center space-x-2 text-xs uppercase tracking-widest"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
              ) : (
                <>
                  <span>{mode === "login" ? "Ingresar al Workspace" : "Recuperar Acceso"}</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Cancel recovery link */}
          {mode === "recover" && (
            <div className="mt-4 text-center">
              <button 
                type="button" 
                onClick={() => setMode("login")}
                className="text-xs text-zinc-500 hover:text-white transition-colors"
              >
                Volver al login
              </button>
            </div>
          )}

        </div>

        {/* SANDBOX EXPLICIT ACCOUNTS PROVISION MODULE (Chief Requested / Real accounts) */}
        <div className="bg-[#0b0b0e]/50 border border-white/5 rounded-3xl p-5 space-y-4">
          <div className="flex items-start gap-2.5">
            <div className="p-1 rounded-lg bg-indigo-500/10 text-indigo-400 mt-0.5">
              <Info size={13} />
            </div>
            <div className="text-left">
              <h3 className="text-[11px] font-black text-slate-300 uppercase tracking-wider">Acceso Rápido Sandbox de Prueba</h3>
              <p className="text-[10px] text-zinc-500 font-medium">Cuentas reales autoprovisionadas al instante en Firebase.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {roles.map((r) => {
              const Icon = r.icon;
              return (
                <button
                  key={r.id}
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickSandboxAccess(r.id)}
                  className="p-3 text-left rounded-xl bg-black/40 border border-white/5 hover:border-white/10 hover:bg-black/60 transition-all flex flex-col justify-between group active:scale-[0.97]"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest leading-none">
                      {r.id}
                    </span>
                    <div className={cn("p-1 rounded-md border text-xs", r.accentColor)}>
                      <Icon size={12} />
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="text-[10px] font-black text-white group-hover:text-indigo-400 transition-colors leading-tight">
                      {r.title.split(" / ")[0]}
                    </p>
                    <p className="text-[8px] text-zinc-600 font-medium tracking-tight mt-0.5 truncate max-w-[150px]">
                      {r.defaultEmail}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Portal de Cliente Link */}
        <div className="text-center pt-2">
          <p className="text-[11px] text-zinc-600 font-medium">
            ¿Eres cliente? Haz tus consultas en el{" "}
            <a 
              href="/cliente" 
              className="text-indigo-400 font-bold hover:underline"
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState({}, '', '/cliente');
                window.location.reload();
              }}
            >
              Portal Auto-servicio (/cliente)
            </a>.
          </p>
        </div>

      </div>

      {/* Embedded footer status badge */}
      <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none z-0 hidden sm:block">
        <div className="max-w-4xl mx-auto flex items-center justify-center space-x-8 text-zinc-800 font-bold tracking-widest text-[8px] uppercase">
          <div className="flex items-center space-x-1.5">
            <ShieldCheck size={13} className="text-emerald-500" />
            <span>Servidor Central Activo</span>
          </div>
        </div>
      </div>

    </div>
  );
}
