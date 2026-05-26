import React, { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  orderBy,
  limit,
  getDocs
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { useBranch } from "../../contexts/BranchContext";
import { resolveBranchIdForStockOp } from "../../lib/productStock";
import { motion, AnimatePresence } from "motion/react";
import { 
  Banknote, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  X, 
  Calculator,
  Lock,
  Unlock,
  TrendingUp,
  CreditCard,
  Smartphone
} from "lucide-react";
import { cn, formatCurrency } from "../../lib/utils";
import { ModernAlert } from "./ui/ModernAlert";

interface CashRegisterProps {
  onStatusChange: (isOpen: boolean, session: any) => void;
}

export function CashRegisterManagement({ onStatusChange }: CashRegisterProps) {
  const { profile } = useAuth();
  const { selectedBranchId } = useBranch();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [initialAmount, setInitialAmount] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const [finalCash, setFinalCash] = useState("");
  const [sessionStats, setSessionStats] = useState({
    cash: 0,
    card: 0,
    digital: 0,
    total: 0
  });

  // Alert Modal State
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "warning" | "delete" | "info";
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info"
  });

  useEffect(() => {
    if (!profile?.uid) return;

    const q = query(
      collection(db, "cashRegisters"),
      where("openedBy", "==", profile.uid),
      where("status", "==", "open"),
      limit(1)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
        setSession(docData);
        onStatusChange(true, docData);
        fetchSessionStats(docData);
        setIsMinimized(false);
      } else {
        setSession(null);
        onStatusChange(false, null);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "cashRegisters");
      setLoading(false);
    });

    return unsub;
  }, [profile?.uid]);

  const fetchSessionStats = async (currentSession: any) => {
    if (!currentSession) return;
    
    // Fetch transactions since openedAt
    const q = query(
      collection(db, "transactions"),
      where("userId", "==", profile?.uid),
      where("timestamp", ">=", currentSession.openedAt),
      orderBy("timestamp", "asc")
    );

    const snapshot = await getDocs(q);
    let cash = 0;
    let card = 0;
    let digital = 0;

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.type === 'sale' && data.paymentBreakdown) {
        cash += Number(data.paymentBreakdown.efectivo) || 0;
        card += Number(data.paymentBreakdown.tarjeta) || 0;
        digital += Number(data.paymentBreakdown.digital) || 0;
      }
    });

    setSessionStats({
      cash,
      card,
      digital,
      total: cash + card + digital
    });
  };

  const handleOpenRegister = async () => {
    const amount = parseFloat(initialAmount);
    if (isNaN(amount) || amount < 0) {
      setAlertConfig({
        isOpen: true,
        type: "warning",
        title: "Monto Inválido",
        message: "Por favor ingrese un monto inicial válido para la apertura de caja."
      });
      return;
    }

    try {
      setLoading(true);
      await addDoc(collection(db, "cashRegisters"), {
        openedBy: profile?.uid,
        openedAt: serverTimestamp(),
        initialAmount: amount,
        status: "open",
        userName: profile?.name,
        branchId: resolveBranchIdForStockOp(selectedBranchId),
      });
      setInitialAmount("");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "cashRegisters");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseRegister = async () => {
    const cash = parseFloat(finalCash);
    if (isNaN(cash) || cash < 0) {
      setAlertConfig({
        isOpen: true,
        type: "warning",
        title: "Monto Faltante",
        message: "Por favor ingrese el efectivo contado final para realizar el arqueo."
      });
      return;
    }

    try {
      setLoading(true);
      const expectedCash = (session.initialAmount || 0) + (sessionStats.cash || 0);
      const difference = cash - expectedCash;

      const summaryData = {
        openedAt: session.openedAt,
        closedAt: new Date(),
        openedBy: profile?.name,
        initialAmount: session.initialAmount,
        expectedAmount: expectedCash,
        actualAmount: cash,
        difference: difference,
        stats: sessionStats
      };

      await updateDoc(doc(db, "cashRegisters", session.id), {
        closedAt: serverTimestamp(),
        closedBy: profile?.uid,
        status: "closed",
        expectedAmount: expectedCash,
        finalAmount: cash,
        difference: difference,
        summary: sessionStats
      });

      setAlertConfig({
        isOpen: true,
        type: "success",
        title: "Caja Cerrada",
        message: `El arqueo se ha completado. Diferencia: ${formatCurrency(difference)}. ¿Desea imprimir el Reporte Z?`,
        onConfirm: () => printZReport(summaryData)
      });

      setIsClosing(false);
      setFinalCash("");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, "cashRegisters");
    } finally {
      setLoading(false);
    }
  };

  const printZReport = (summary: any) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const reportHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            @page { size: 58mm auto; margin: 0; }
            body { 
              font-family: 'Inter', -apple-system, sans-serif; 
              font-size: 11px; 
              width: 48mm; 
              margin: 0; 
              padding: 10px; 
              line-height: 1.4; 
              color: #000;
            }
            .header { text-align: center; font-weight: 800; text-transform: uppercase; margin-bottom: 5px; font-size: 13px; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            .row { display: flex; justify-content: space-between; margin: 3px 0; }
            .total-row { font-weight: 800; font-size: 12px; margin: 8px 0; border-top: 1px solid #eee; padding-top: 4px; }
            .footer { text-align: center; margin-top: 25px; font-size: 9px; color: #666; font-weight: 500; }
            .business-name { font-weight: 900; font-size: 14px; text-align: center; margin-bottom: 2px; }
          </style>
        </head>
        <body>
          <div class="header">CIERRE DE CAJA</div>
          <div class="header" style="font-size: 10px;">REPORTE Z</div>
          <div style="text-align: center; font-size: 8px; color: #666; margin-top: 5px;">${new Date().toLocaleString('es-CL')}</div>
          
          <div class="divider"></div>
          <div class="row"><span>OPERADOR:</span> <span>${summary.openedBy?.toUpperCase()}</span></div>
          <div class="row"><span>APERTURA:</span> <span>${new Date(summary.openedAt?.toDate?.() || summary.openedAt).toLocaleTimeString('es-CL')}</span></div>
          <div class="row"><span>CIERRE:</span> <span>${new Date().toLocaleTimeString('es-CL')}</span></div>
          
          <div class="divider"></div>
          
          <div class="row"><span>SALDO INICIAL:</span> <span>${formatCurrency(summary.initialAmount)}</span></div>
          <div class="row"><span>(+) EFECTIVO VENTAS:</span> <span>${formatCurrency(summary.stats.cash)}</span></div>
          
          <div class="total-row row">
            <span>EFECTIVO ESPERADO:</span> 
            <span>${formatCurrency(summary.expectedAmount)}</span>
          </div>
          
          <div class="row" style="margin-top: 4px;">
            <span>EFECTIVO CONTADO:</span> 
            <span>${formatCurrency(summary.actualAmount)}</span>
          </div>

          <div class="row" style="color: ${summary.difference < 0 ? '#ef4444' : '#10b981'}; font-weight: 800; border-top: 1px solid #eee; padding-top: 4px; margin-top: 4px;">
            <span>DIFERENCIA:</span> 
            <span>${summary.difference > 0 ? '+' : ''}${formatCurrency(summary.difference)}</span>
          </div>

          <div class="divider"></div>
          <div class="header" style="font-size: 9px; margin-bottom: 8px;">RESUMEN DE OPERACIONES</div>
          
          <div class="row"><span>VENTAS TARJETA:</span> <span>${formatCurrency(summary.stats.card)}</span></div>
          <div class="row"><span>VENTAS DIGITAL:</span> <span>${formatCurrency(summary.stats.digital)}</span></div>
          <div class="divider"></div>
          <div class="row" style="font-weight: 900; font-size: 12px;">
            <span>TOTAL VENTAS:</span> 
            <span>${formatCurrency(summary.stats.total)}</span>
          </div>

          <div class="footer">
            SISTEMA STOCKFLOW PRO<br/>
            COMPROBANTE NO VÁLIDO COMO FACTURA
          </div>
          <script>
            window.onload = () => { 
              window.print(); 
              setTimeout(() => { window.close(); }, 500); 
            };
          </script>
        </body>
      </html>
    `;

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(reportHtml);
      doc.close();
      setTimeout(() => {
        if (iframe.contentWindow) {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          setTimeout(() => document.body.removeChild(iframe), 1000);
        }
      }, 500);
    }
  };

  if (loading && !session) return null;

  return (
    <>
      <AnimatePresence>
        {!session && !isMinimized && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white max-w-sm sm:max-w-md w-full rounded-3xl sm:rounded-[2.5rem] shadow-2xl p-6 sm:p-10 text-center relative max-h-[92vh] overflow-y-auto mx-4"
            >
              <button type="button" 
                aria-label="Minimizar caja"
                onClick={() => setIsMinimized(true)}
                className="absolute top-5 right-5 sm:top-8 sm:right-8 text-slate-300 hover:text-slate-600 transition-colors"
                title="Explorar sistema (solo lectura)"
              >
                <X size={20} />
              </button>

              <div className="size-14 sm:w-20 sm:h-20 bg-rose-50 text-rose-500 rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto mb-4 sm:mb-8 shadow-inner">
                <Lock className="sm:hidden" size={28} />
                <Lock className="hidden sm:block" size={40} />
              </div>
              <h2 className="text-xl sm:text-3xl font-black text-slate-800 mb-1 sm:mb-2 tracking-tight">Caja Cerrada</h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mb-4 sm:mb-8">Debes iniciar una nueva sesión para comenzar a vender.</p>
              
              <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl mb-4 sm:mb-8 space-y-4">
                <div className="text-left">
                  <label htmlFor="initialAmount" className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Monto Inicial (Efectivo)</label>
                  <div className="relative mt-1">
                    <Banknote className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      id="initialAmount"
                      type="number" 
                      placeholder="0"
                      className="w-full bg-white border-none rounded-xl sm:rounded-2xl py-3 sm:py-4 pl-10 sm:pl-12 pr-4 text-base sm:text-xl font-black text-slate-800 shadow-sm focus:ring-4 focus:ring-indigo-500/10 transition-all"
                      value={initialAmount}
                      onChange={(e) => setInitialAmount(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <button type="button" 
                  onClick={handleOpenRegister}
                  disabled={!initialAmount || loading}
                  className="w-full h-12 sm:h-16 bg-slate-900 text-white rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-xs sm:text-sm hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-x-2 disabled:opacity-30"
                >
                  <Unlock size={16} />
                  <span>Abrir Caja y Comenzar</span>
                </button>

                <button type="button" 
                  onClick={() => setIsMinimized(true)}
                  className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors block mx-auto py-1"
                >
                  O quizás más tarde, solo quiero revisar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!session && isMinimized && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="fixed bottom-4 sm:bottom-10 left-1/2 -translate-x-1/2 z-50 animate-bounce-slow w-full max-w-[90vw] sm:w-auto px-4 sm:px-0 flex justify-center"
          >
            <button type="button" 
              onClick={() => setIsMinimized(false)}
              className="bg-rose-600 text-white px-5 py-3 sm:px-8 sm:py-4 rounded-xl sm:rounded-full font-black uppercase tracking-widest text-[9px] sm:text-[10px] shadow-2xl shadow-rose-200 flex items-center gap-x-2 sm:gap-x-3 group justify-center text-center"
            >
              <div className="size-6 sm:w-8 sm:h-8 bg-white/20 rounded-full flex items-center justify-center group-hover:rotate-12 transition-transform shrink-0">
                <Lock size={12} className="sm:w-[14px] sm:h-[14px]" />
              </div>
              <span className="hidden sm:inline">Modo Lectura - Haz clic para Abrir Caja</span>
              <span className="inline sm:hidden">Modo Lectura - Abrir Caja</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Close Button in POS */}
      {session && (
        <div className="fixed bottom-4 right-4 sm:bottom-10 sm:right-10 z-30">
          <button type="button" 
            onClick={() => {
              fetchSessionStats(session);
              setIsClosing(true);
            }}
            className="flex items-center gap-x-1.5 sm:gap-x-2 bg-rose-600 text-white px-4 py-3 sm:px-6 sm:py-4 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-[9px] sm:text-[10px] shadow-2xl shadow-rose-200 hover:scale-105 active:scale-95 transition-all"
          >
            <Lock size={14} className="sm:w-[16px] sm:h-[16px]" />
            <span>Cerrar Turno</span>
          </button>
        </div>
      )}

      {/* Closing Modal */}
      <AnimatePresence>
        {isClosing && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white max-w-2xl w-full rounded-[2.5rem] md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]"
            >
              <div className="p-6 md:p-8 bg-rose-600 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-x-4">
                  <div className="p-2 bg-white/10 rounded-xl">
                    <Calculator size={20} md:size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg md:text-2xl font-black tracking-tight">Arqueo de Caja</h2>
                    <p className="text-[9px] md:text-xs font-black text-rose-200 uppercase tracking-widest mt-0.5">Finalización de Turno</p>
                  </div>
                </div>
                <button type="button" aria-label="Cancelar cierre" onClick={() => setIsClosing(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                  <X size={20} md:size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-6 md:space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                  <div className="bg-slate-50 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Efectivo Inicial</p>
                    <p className="text-lg md:text-xl font-black text-slate-800">{formatCurrency(session?.initialAmount)}</p>
                  </div>
                  <div className="bg-emerald-50 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-emerald-100">
                    <p className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest mb-1">Ventas Efectivo</p>
                    <p className="text-lg md:text-xl font-black text-emerald-700">{formatCurrency(sessionStats.cash)}</p>
                  </div>
                </div>

                <div className="bg-slate-900 text-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 size-32 bg-indigo-500/10 blur-3xl rounded-full" />
                  <p className="text-[10px] text-white/40 font-black uppercase tracking-widest mb-2">Efectivo que DEBERÍA haber</p>
                  <p className="text-2xl md:text-4xl font-black">{formatCurrency(session?.initialAmount + sessionStats.cash)}</p>
                </div>

                <div className="space-y-3">
                  <label htmlFor="finalCash" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Declaración de Efectivo Contado</label>
                  <div className="relative">
                    <Banknote className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} md:size={24} />
                    <input 
                      id="finalCash"
                      type="number" 
                      placeholder="Ingrese monto contado…"
                      className="w-full bg-slate-50 border-2 border-transparent rounded-2xl md:rounded-[2rem] py-4 md:py-6 pl-12 md:pl-16 pr-6 md:pr-8 text-lg md:text-2xl font-black text-slate-800 focus:ring-0 focus:border-rose-500/30 transition-all shadow-inner"
                      value={finalCash}
                      onChange={(e) => setFinalCash(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                  <div className="p-3 md:p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-x-3">
                    <CreditCard size={18} className="text-indigo-500" />
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase">Tarjeta</p>
                      <p className="text-xs font-black">{formatCurrency(sessionStats.card)}</p>
                    </div>
                  </div>
                  <div className="p-3 md:p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-x-3">
                    <Smartphone size={18} className="text-purple-500" />
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase">Digital</p>
                      <p className="text-xs font-black">{formatCurrency(sessionStats.digital)}</p>
                    </div>
                  </div>
                  <div className="p-3 md:p-4 bg-indigo-600 rounded-2xl text-white flex items-center gap-x-3">
                    <TrendingUp size={18} />
                    <div>
                      <p className="text-[9px] font-black text-indigo-200 uppercase">Total Turno</p>
                      <p className="text-xs font-black">{formatCurrency(sessionStats.total)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 md:p-8 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-3 md:gap-4 shrink-0">
                <button type="button" 
                  onClick={() => setIsClosing(false)}
                  className="w-full sm:flex-1 py-4 md:py-5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-100 transition-all"
                >
                  Cancelar
                </button>
                <button type="button" 
                  onClick={handleCloseRegister}
                  disabled={!finalCash || loading}
                  className="w-full sm:flex-[2] py-4 md:py-5 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-rose-700 transition-all shadow-xl shadow-rose-100 disabled:opacity-30"
                >
                  Finalizar Turno y Cerrar Caja
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ModernAlert 
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={alertConfig.onConfirm}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        confirmText={alertConfig.onConfirm ? "Imprimir" : "Aceptar"}
      />
    </>
  );
}
