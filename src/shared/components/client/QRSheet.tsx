import React from "react";
import { X, Clock, Wallet, Crown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn, formatCurrency } from "../../../lib/utils";
import { QRCodeCanvas } from "qrcode.react";

export interface QRSheetProps {
  isOpen: boolean;
  onClose: () => void;
  secureToken: string;
  customerTaxId: string;
  customerEmail: string;
  customerName: string;
  customerPoints: number;
  customerBalance: number;
  timeLeft: number;
  securePin: string;
  onRecharge: (amount: number) => Promise<void>;
  lang: "es" | "en";
  t: any;
  key?: React.Key;
}

export function QRSheet({
  isOpen,
  onClose,
  secureToken,
  customerTaxId,
  customerEmail,
  customerName,
  customerPoints,
  customerBalance,
  timeLeft,
  securePin,
  onRecharge,
  lang,
  t
}: QRSheetProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-end sm:items-center justify-center p-4"
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 flex flex-col max-h-[95vh] relative overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h3 className="text-lg font-black text-slate-800 tracking-tight leading-none">
                {lang === "es" ? "Mi código de socio" : "My Member Code"}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-slate-50 rounded-xl text-slate-450 cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <p className="text-[11px] font-bold text-slate-500 max-w-[240px] mx-auto leading-relaxed shrink-0">
              {lang === "es"
                ? "Muéstralo en caja para sumar puntos e identificarte"
                : "Show it at checkout to earn points and identify yourself"}
            </p>

            <div className="my-6 p-6 bg-white rounded-3xl border border-slate-100 shadow-lg max-w-[220px] mx-auto shrink-0 select-none">
              <QRCodeCanvas
                value={secureToken || customerTaxId || customerEmail}
                size={170}
                level="H"
                includeMargin={false}
                className="w-full h-auto"
              />
            </div>

            {/* Countdown timer */}
            <div className="space-y-1.5 mb-5 px-4 text-left shrink-0 select-none">
              <div className="flex justify-between items-center text-[9px] font-black tracking-wider text-slate-455">
                <span className="flex items-center gap-1">
                  <Clock size={10} className="text-indigo-500 animate-spin [animation-duration:8s]" />
                  {lang === "es" ? "CÓDIGO DINÁMICO SEGURO" : "SECURE DYNAMIC CODE"}
                </span>
                <span className="text-indigo-600 font-extrabold">
                  {lang === "es" ? `Se actualiza en ${timeLeft}s` : `Updates in ${timeLeft}s`}
                </span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${(timeLeft / 30) * 100}%` }}
                />
              </div>
            </div>

            {/* Numeric OTP pin fallback */}
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-center space-y-1 shadow-inner font-sans shrink-0">
              <p className="text-[9px] font-black tracking-widest text-slate-450 uppercase">
                {lang === "es" ? "Token Numérico de Entrada" : "Numeric Input Token"}
              </p>
              <p className="font-mono text-2xl font-black text-indigo-600 tracking-[0.2em] select-all">
                {securePin.slice(0, 3)} {securePin.slice(3)}
              </p>
              <p className="text-[8px] font-bold text-slate-400 leading-normal">
                {lang === "es"
                  ? "Ingreso manual en caja si el lector óptico está apagado"
                  : "Manual entry if optical scanner is off"}
              </p>
            </div>

            {/* Verified member pill */}
            <div className="mt-4 flex items-center justify-center gap-1.5 py-2 px-4 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-wider border border-indigo-100/50 shrink-0 select-none">
              <Crown size={12} fill="indigo" className="text-indigo-700" strokeWidth={0} />
              <span>
                {customerName} · {customerPoints} pts
              </span>
            </div>

            {/* Prepaid digital wallet - simulated recharges */}
            <div className="mt-5 bg-white p-5 rounded-[2rem] border border-slate-150 shadow-sm text-left space-y-3 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[8.5px] font-black tracking-wider text-slate-400 uppercase">
                    {lang === "es" ? "Billetera Digital Prepago" : "Prepaid Digital Wallet"}
                  </p>
                  <h4 className="text-lg font-black text-slate-900 mt-1 select-all font-mono">
                    {formatCurrency(customerBalance)}
                  </h4>
                </div>
                <div className="size-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Wallet size={16} />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onRecharge(10000)}
                  className="sf-tap flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 transition-colors rounded-xl font-bold text-[9px] text-center cursor-pointer"
                >
                  + $10k CLP
                </button>
                <button
                  type="button"
                  onClick={() => onRecharge(50000)}
                  className="sf-tap flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white transition-colors rounded-xl font-bold text-[9px] text-center cursor-pointer"
                >
                  + $50k CLP
                </button>
              </div>
              <p className="text-[8px] font-bold text-slate-400 text-center leading-normal">
                {t[lang].simulationNotice}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
