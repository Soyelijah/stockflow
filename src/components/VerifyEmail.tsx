import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Mail, RefreshCw, LogOut, CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";

export function VerifyEmail() {
  const { user, sendVerification, refreshUser, logout } = useAuth();
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: "success" | "error" } | null>(null);

  const handleResend = async () => {
    setSending(true);
    setMessage(null);
    try {
      await sendVerification();
      setMessage({ text: "Correo de verificación enviado. Revisa tu bandeja de entrada.", type: "success" });
    } catch (err) {
      setMessage({ text: "Error al enviar el correo. Intenta de nuevo más tarde.", type: "error" });
    } finally {
      setSending(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshUser();
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center p-6 selection:bg-indigo-500/30">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-[420px] w-full relative z-10"
      >
        <div className="bg-[#111114]/80 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-10 shadow-2xl overflow-hidden text-center relative">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
          
          <div className="w-20 h-20 bg-indigo-600/20 rounded-3xl flex items-center justify-center mx-auto mb-8 text-indigo-500">
            <Mail size={40} />
          </div>

          <h2 className="text-2xl font-black text-white tracking-tight mb-4">Verifica tu Correo</h2>
          <p className="text-gray-400 text-sm font-medium mb-8 leading-relaxed">
            Hemos enviado un enlace de confirmación a <span className="text-indigo-400">{user?.email}</span>. 
            Por favor, confírmalo para acceder al sistema.
          </p>

          <div className="space-y-4">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-full bg-white text-slate-900 font-black py-4 rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {refreshing ? (
                <RefreshCw size={20} className="animate-spin text-slate-500" />
              ) : (
                <>
                  <CheckCircle2 size={20} className="text-emerald-500" />
                  <span className="uppercase tracking-widest text-xs">Ya lo he verificado</span>
                </>
              )}
            </button>

            <button
              onClick={handleResend}
              disabled={sending}
              className="w-full bg-white/5 border border-white/10 text-white font-bold py-4 rounded-2xl transition-all hover:bg-white/10 flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {sending ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
              ) : (
                <span className="uppercase tracking-widest text-xs">Reenviar correo</span>
              )}
            </button>
          </div>

          {message && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-6 p-4 rounded-2xl text-xs font-medium ${
                message.type === "success" 
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" 
                  : "bg-red-500/10 border border-red-500/20 text-red-400"
              }`}
            >
              {message.text}
            </motion.div>
          )}

          <div className="mt-10 pt-8 border-t border-white/5">
            <button 
              onClick={() => logout()}
              className="inline-flex items-center space-x-2 text-gray-500 hover:text-white transition-colors uppercase tracking-widest text-[10px] font-black"
            >
              <LogOut size={14} />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
