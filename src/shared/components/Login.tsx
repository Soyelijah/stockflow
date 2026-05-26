import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Laptop,
  UserCircle2
} from "lucide-react";

export function Login() {
  const { login, sendPasswordReset } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"login" | "recover">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const emailToUse = formData.email.trim().toLowerCase();
    const passwordToUse = formData.password;

    try {
      if (mode === "login") {
        await login(emailToUse, passwordToUse);
      } else {
        await sendPasswordReset(emailToUse);
        setSuccess("Se ha enviado un correo de restablecimiento de contraseña.");
        setTimeout(() => setMode("login"), 4000);
      }
    } catch (err: any) {
      if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        setError("Las credenciales son incorrectas o la cuenta no está registrada.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Demasiados intentos. Por favor espera unos minutos y vuelve a intentar.");
      } else if (err.code === "auth/network-request-failed") {
        setError("Sin conexión a internet. Verifica tu red e intenta nuevamente.");
      } else {
        setError("Error al autenticar. Verifica tu conexión e intenta nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060608] flex items-center justify-center p-4 sm:p-6 lg:p-8 selection:bg-indigo-500/30 overflow-x-hidden font-sans relative">

      {/* Ambient color glow (static indigo) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[35%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] blur-[140px] rounded-full opacity-20 bg-indigo-500" />
      </div>

      <div className="max-w-[460px] w-full relative z-10 space-y-6">

        {/* Central Logo Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="p-3 bg-slate-900 border border-white/5 rounded-2xl shadow-xl flex items-center justify-center">
            <Laptop className="text-indigo-400" size={26} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              StockFlow <span className="text-indigo-500 font-medium text-xs font-mono">v2.1</span>
            </h1>
            <p className="text-[10px] text-zinc-500 tracking-widest uppercase font-extrabold mt-1">
              Plataforma Corporativa de Inventario y Bodega
            </p>
          </div>
        </div>

        {/* Login panel */}
        <div className="bg-[#0b0b0e]/95 border border-white/5 rounded-3xl p-6 sm:p-8 shadow-2xl relative">

          <div className="absolute top-0 inset-x-0 h-[2px] rounded-t-3xl bg-indigo-500" />

          <div className="mb-6 text-center">
            <h2 className="text-base font-black text-white">Acceso de Trabajadores</h2>
            <p className="text-[10px] text-zinc-500 font-medium mt-0.5">
              El registro de empleados lo realiza el administrador desde Configuración.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" aria-label="Formulario de inicio de sesión">

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" size={15} aria-hidden="true" />
                <input
                  id="email"
                  required
                  type="email"
                  autoComplete="email"
                  placeholder="tu@correo.cl"
                  className="w-full bg-black/40 border border-white/5 hover:border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-zinc-700 focus:outline-none transition-all text-xs"
                  value={formData.email}
                  disabled={loading}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  aria-label="Correo electrónico"
                />
              </div>
            </div>

            {/* Password */}
            {mode === "login" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between ml-1">
                  <label htmlFor="password" className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                    Contraseña
                  </label>
                  <button
                    type="button"
                    onClick={() => setMode("recover")}
                    className="text-[9px] font-extrabold text-zinc-500 hover:text-indigo-400 transition-colors"
                    aria-label="Recuperar contraseña olvidada"
                  >
                    ¿Olvidaste tu clave?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" size={15} aria-hidden="true" />
                  <input
                    id="password"
                    required
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full bg-black/40 border border-white/5 hover:border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-zinc-700 focus:outline-none transition-all text-xs"
                    value={formData.password}
                    disabled={loading}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    aria-label="Contraseña"
                  />
                </div>
              </div>
            )}

            {/* Feedback */}
            {error && (
              <div role="alert" className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] rounded-xl font-medium text-left">
                {error}
              </div>
            )}

            {success && (
              <div role="status" className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] rounded-xl font-medium text-left">
                {success}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/15 text-white font-black py-3 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-x-2 text-xs uppercase tracking-widest"
              aria-label={mode === "login" ? "Ingresar al workspace" : "Enviar correo de recuperación"}
            >
              {loading ? (
                <div className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true"></div>
              ) : (
                <>
                  <span>{mode === "login" ? "Ingresar al Workspace" : "Recuperar Acceso"}</span>
                  <ArrowRight size={15} aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          {/* Cancel recovery */}
          {mode === "recover" && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-xs text-zinc-500 hover:text-white transition-colors"
                aria-label="Volver al formulario de inicio de sesión"
              >
                Volver al login
              </button>
            </div>
          )}

        </div>

        {/* Customer Portal entrypoint — prominent button, React Router navigation */}
        <button
          type="button"
          onClick={() => navigate("/cliente")}
          className="w-full bg-[#0b0b0e]/50 hover:bg-[#0b0b0e]/80 border border-white/5 hover:border-indigo-500/30 rounded-2xl p-4 transition-all flex items-center justify-center gap-x-2 group active:scale-[0.99]"
          aria-label="Ir al portal de auto-servicio para clientes"
        >
          <UserCircle2 size={16} className="text-zinc-500 group-hover:text-indigo-400 transition-colors" aria-hidden="true" />
          <span className="text-xs font-bold text-zinc-400 group-hover:text-white transition-colors">
            ¿Eres cliente? Ingresa al portal
          </span>
        </button>

      </div>

      {/* Footer status */}
      <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none z-0 hidden sm:block">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-x-8 text-zinc-800 font-bold tracking-widest text-[8px] uppercase">
          <div className="flex items-center gap-x-1.5">
            <ShieldCheck size={13} className="text-emerald-500" aria-hidden="true" />
            <span>Servidor Central Activo</span>
          </div>
        </div>
      </div>

    </div>
  );
}
