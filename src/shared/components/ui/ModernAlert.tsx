import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertCircle, CheckCircle2, Info, X, Trash2, AlertTriangle } from "lucide-react";
import { cn } from "../../../lib/utils";

interface ModernAlertProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  message: string;
  type?: "success" | "error" | "warning" | "delete" | "info";
  confirmText?: string;
  cancelText?: string;
}

export function ModernAlert({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = "info",
  confirmText = "Entendido",
  cancelText = "Cancelar"
}: ModernAlertProps) {
  
  const getIcon = () => {
    switch (type) {
      case "success": return <CheckCircle2 className="text-emerald-500" size={32} />;
      case "error": return <AlertCircle className="text-rose-500" size={32} />;
      case "warning": return <AlertTriangle className="text-amber-500" size={32} />;
      case "delete": return <Trash2 className="text-rose-600" size={32} />;
      default: return <Info className="text-indigo-500" size={32} />;
    }
  };

  const getTypeStyles = () => {
    switch (type) {
      case "success": return "bg-emerald-50 border-emerald-100";
      case "error": return "bg-rose-50 border-rose-100";
      case "warning": return "bg-amber-50 border-amber-100";
      case "delete": return "bg-rose-50 border-rose-100";
      default: return "bg-indigo-50 border-indigo-100";
    }
  };

  const getButtonStyles = () => {
    switch (type) {
      case "success": return "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100";
      case "error": return "bg-rose-600 hover:bg-rose-700 shadow-rose-100";
      case "warning": return "bg-amber-600 hover:bg-amber-700 shadow-amber-100";
      case "delete": return "bg-rose-600 hover:bg-rose-700 shadow-rose-100";
      default: return "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100";
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]"
          />
          
          {/* Modal Container */}
          <div className="fixed inset-0 flex items-center justify-center z-[101] p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden pointer-events-auto border border-slate-100"
            >
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <motion.div 
                    initial={{ rotate: -10, scale: 0.9 }}
                    animate={{ rotate: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 15 }}
                    className={cn("p-4 rounded-3xl border", getTypeStyles())}
                  >
                    {getIcon()}
                  </motion.div>
                  <button type="button" 
                    onClick={onClose}
                    className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">
                  {title}
                </h3>
                <p className="text-slate-500 font-medium leading-relaxed">
                  {message}
                </p>

                <div className="flex flex-col sm:flex-row gap-3 mt-10 w-full">
                  {onConfirm && (
                    <button type="button"
                      onClick={() => {
                        onConfirm();
                        onClose();
                      }}
                      className={cn(
                        "w-full sm:flex-1 min-h-[3.25rem] md:min-h-[3.5rem] py-3.5 px-6 rounded-2xl text-white text-sm font-bold uppercase tracking-wider transition-all shadow-lg order-1 sm:order-2 flex items-center justify-center cursor-pointer",
                        getButtonStyles()
                      )}
                    >
                      {confirmText}
                    </button>
                  )}
                  <button type="button"
                    onClick={onClose}
                    className={cn(
                      "w-full sm:flex-1 min-h-[3.25rem] md:min-h-[3.5rem] py-3.5 px-6 rounded-2xl text-slate-500 text-sm font-bold uppercase tracking-wider hover:bg-slate-100 transition-all order-2 sm:order-1 flex items-center justify-center cursor-pointer",
                      !onConfirm && "bg-slate-900 text-white hover:bg-slate-800"
                    )}
                  >
                    {onConfirm ? cancelText : "Entendido"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
