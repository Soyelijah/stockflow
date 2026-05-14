import React, { useState } from "react";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "../lib/firebase";
import { LayoutDashboard, Lock, Star } from "lucide-react";
import { motion } from "motion/react";

export function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error(err);
      setError("Error al iniciar sesión con Google. Por favor intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 space-y-8"
      >
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg mb-4">
            <LayoutDashboard className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">StockFlow</h1>
          <p className="mt-2 text-gray-600">Gestión Inteligente de Inventarios</p>
        </div>

        <div className="space-y-6">
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <ul className="space-y-3">
              <li className="flex items-start space-x-3 text-sm text-blue-800">
                <Star className="text-blue-500 mt-0.5 shrink-0" size={16} />
                <span>Control de entradas y salidas en tiempo real.</span>
              </li>
              <li className="flex items-start space-x-3 text-sm text-blue-800">
                <Lock className="text-blue-500 mt-0.5 shrink-0" size={16} />
                <span>Roles específicos para evitar modificaciones no autorizadas.</span>
              </li>
            </ul>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center space-x-3 bg-white border border-gray-300 py-3 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:active:scale-100"
            id="google-login-btn"
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"></div>
            ) : (
              <>
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                <span>Continuar con Google</span>
              </>
            )}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400">
          Al continuar, aceptas nuestros términos y condiciones de uso.
        </p>
      </motion.div>
    </div>
  );
}
