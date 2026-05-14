import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { LayoutDashboard, Lock, Mail, User, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

export function Login() {
  const { login, register, sendPasswordReset } = useAuth();
  const [mode, setMode] = useState<"login" | "register" | "recover">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (mode === "login") {
        await login(formData.email, formData.password);
      } else if (mode === "register") {
        await register(formData.email, formData.password, formData.name);
      } else {
        await sendPasswordReset(formData.email);
        setSuccess("Correo de recuperación enviado. Revisa tu bandeja de entrada.");
        setTimeout(() => setMode("login"), 5000);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
        setError("Credenciales inválidas o el usuario no existe.");
      } else if (err.code === "auth/wrong-password") {
        setError("Contraseña incorrecta.");
      } else if (err.code === "auth/email-already-in-use") {
        setError("Esta dirección de correo ya está registrada. Prueba iniciando sesión.");
      } else if (err.code === "auth/weak-password") {
        setError("La contraseña es muy débil (mínimo 6 caracteres).");
      } else if (err.message && err.message.includes("Email/Password")) {
        setError(err.message);
      } else {
        setError("Error en la autenticación. Revisa tu conexión.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center p-6 selection:bg-indigo-500/30">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-[420px] w-full relative z-10"
      >
        <div className="text-center mb-10">
          <motion.div 
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            className="inline-flex items-center justify-center p-3 rounded-2xl bg-indigo-600 shadow-[0_0_20px_rgba(79,70,229,0.4)] mb-6"
          >
            <LayoutDashboard className="text-white" size={32} />
          </motion.div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">StockFlow<span className="text-indigo-500">.</span></h1>
          <p className="text-gray-400 font-medium">
            {mode === "recover" ? "Recupera el acceso a tu cuenta." : "Gestión de inventario para la nueva era."}
          </p>
        </div>

        <div className="bg-[#111114]/80 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl overflow-hidden relative">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <AnimatePresence mode="wait">
              {mode === "register" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-1"
                >
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1 tracking-widest">Nombre Completo</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input 
                      required
                      type="text" 
                      placeholder="Ej. Juan Pérez"
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1 tracking-widest">Correo Electrónico</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input 
                  required
                  type="email" 
                  placeholder="nombre@empresa.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>
            </div>

            <AnimatePresence mode="wait">
              {mode !== "recover" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-1"
                >
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Contraseña</label>
                    {mode === "login" && (
                      <button 
                        type="button"
                        onClick={() => setMode("recover")}
                        className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-wider uppercase transition-colors"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input 
                      required
                      type="password" 
                      placeholder="••••••••"
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }} 
                animate={{ opacity: 1, x: 0 }}
                className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl font-medium"
              >
                {error}
              </motion.div>
            )}

            {success && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }} 
                animate={{ opacity: 1, x: 0 }}
                className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl font-medium"
              >
                {success}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.2)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center space-x-2"
              id="submit-auth-btn"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
              ) : (
                <>
                  <span>
                    {mode === "login" ? "Entrar al Sistema" : 
                     mode === "register" ? "Crear mi Cuenta" : 
                     "Enviar Instrucciones"}
                  </span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center flex flex-col space-y-4">
            {mode === "recover" ? (
              <button 
                onClick={() => setMode("login")}
                className="text-gray-400 hover:text-indigo-400 text-sm font-medium transition-colors"
              >
                Volver al inicio de sesión
              </button>
            ) : (
              <button 
                onClick={() => setMode(mode === "login" ? "register" : "login")}
                className="text-gray-400 hover:text-indigo-400 text-sm font-medium transition-colors"
                id="toggle-auth-mode"
              >
                {mode === "login" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
              </button>
            )}
          </div>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-3 text-gray-500">
            <ShieldCheck size={20} className="text-indigo-500/50" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Seguro y Encriptado</span>
          </div>
          <div className="flex items-center space-x-3 text-gray-500 justify-end">
            <Sparkles size={20} className="text-indigo-500/50" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Cloud Enabled</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
