import React from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { motion } from "motion/react";

export function Forbidden() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-4 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md rounded-2xl border border-red-500/20 bg-white/80 p-8 shadow-xl backdrop-blur-md dark:border-red-500/30 dark:bg-slate-900/80"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/50">
          <ShieldAlert className="h-10 w-10 text-red-600 dark:text-red-400" />
        </div>

        <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Acceso Denegado
        </h1>

        <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Tu cuenta no tiene los privilegios necesarios para acceder a esta sección.
          Por favor, contacta al administrador del sistema si crees que esto es un error.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-indigo-700 hover:shadow-indigo-600/10 active:scale-[0.98]"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al Panel Principal
          </button>
        </div>
      </motion.div>
    </div>
  );
}
