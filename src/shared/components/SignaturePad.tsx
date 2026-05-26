import React, { useRef, useState, useEffect } from "react";
import { X, RotateCcw, CheckCircle, User, Award } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    signatureDataUrl: string,
    receivedByName: string,
    metadata: { signedAt: string; latitude: number | null; longitude: number | null }
  ) => void;
  defaultRecipientName: string;
  orderId: string;
}

export function SignatureModal({
  isOpen,
  onClose,
  onSave,
  defaultRecipientName,
  orderId
}: SignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [isCanvasEmpty, setIsCanvasEmpty] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number | null; longitude: number | null }>({
    latitude: null,
    longitude: null
  });

  // Query background GPS coordinates silently on open
  useEffect(() => {
    if (isOpen && typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGpsCoords({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          console.warn("⚠️ [Signature GPS] Geolocation unavailable:", error.message);
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }
  }, [isOpen]);

  // Initialize recipient name to default
  useEffect(() => {
    if (isOpen) {
      setRecipientName(defaultRecipientName || "");
      setIsCanvasEmpty(true);
    }
  }, [isOpen, defaultRecipientName]);

  // Setup Canvas properties on mount or when visibility changes
  useEffect(() => {
    if (!isOpen) return;

    // Timeout ensures the DOM container has completely rendered with active client sizes
    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      // Adjust dimensions for Retina/High-DPI support
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = "#1e1b4b"; // Deep Indigo ink color

        // Draw dotted guideline
        drawGuideline(ctx, rect.width, rect.height);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isOpen]);

  const drawGuideline = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "#cbd5e1"; // Light gray
    ctx.lineWidth = 1;
    ctx.moveTo(15, height - 40);
    ctx.lineTo(width - 15, height - 40);
    ctx.stroke();
    ctx.restore();
  };

  // Coordinates translation utils
  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ("touches" in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  // Drawing hooks
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    // Prevent mouse click from triggering scrolling on mobile
    if (e.cancelable) e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const coords = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);

    setIsDrawing(true);
    setIsCanvasEmpty(false);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    if (e.cancelable) e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const coords = getCanvasCoords(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsCanvasEmpty(true);

    const rect = canvas.getBoundingClientRect();
    drawGuideline(ctx, rect.width, rect.height);
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || isCanvasEmpty) return;

    // Convert drawn canvas to base64 image data URL
    const dataUrl = canvas.toDataURL("image/png");
    
    // Automatic high precision ISO timestamp
    const signedAt = new Date().toISOString();

    onSave(dataUrl, recipientName.trim() || defaultRecipientName || "Cliente Final", {
      signedAt,
      latitude: gpsCoords.latitude,
      longitude: gpsCoords.longitude
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] overflow-y-auto flex items-end sm:items-center justify-center p-4">
      {/* Dark backdrop overlay */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
        role="button"
        tabIndex={-1}
        aria-label="Cerrar firma"
        onClick={onClose}
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      />

      <motion.div
        initial={{ opacity: 0, y: 150, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 100, scale: 0.95 }}
        transition={{ type: "spring", damping: 25, stiffness: 350 }}
        className="relative bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden z-10 flex flex-col"
      >
        {/* Decorative ambient background accent */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#10b981] via-indigo-500 to-rose-500" />

        {/* Modal Header */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-x-2.5">
            <div className="w-8.5 h-8.5 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500 border border-emerald-100/40">
              <CheckCircle size={16} />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">Firma Multipunto</h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Orden #{orderId.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>
          <button type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Modal Form Content */}
        <div className="p-6 space-y-4">
          {/* Recipient Full Name */}
          <div className="space-y-1 text-left">
            <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <User size={10} className="text-slate-400" />
              Nombre de Quien Recibe:
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Ej. Pierre Solier"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="w-full h-11 pl-4 pr-4 bg-slate-50/50 border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs font-bold text-slate-800 rounded-2xl transition-all"
              />
            </div>

            {/* Mismatch Alert Box */}
            <AnimatePresence>
              {recipientName.trim() && defaultRecipientName && recipientName.trim().toLowerCase() !== defaultRecipientName.trim().toLowerCase() && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: "auto", marginTop: 8 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-left text-[9.5px] leading-relaxed text-amber-800 flex items-start gap-2 shadow-sm shadow-amber-500/5">
                    <span className="text-sm pt-0.5 leading-none">⚠️</span>
                    <div className="space-y-0.5">
                      <p className="font-extrabold uppercase tracking-wider text-amber-900 text-[8.5px]">⚠️ Alerta: Nombre no coincide</p>
                      <p className="font-bold text-amber-700/90">
                        El firmante ingresado no coincide exactamente con el cliente registrado en la orden (<span className="underline font-extrabold text-amber-900">{defaultRecipientName}</span>). Confirme el parentesco o identidad antes de continuar.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Canvas Wrapper */}
          <div className="space-y-1 text-left">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                Captura de Firma Digital:
              </label>
              {!isCanvasEmpty && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-[9px] font-black uppercase tracking-wider text-rose-500 hover:text-rose-650 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RotateCcw size={10} />
                  Limpiar Limpio
                </button>
              )}
            </div>

            <div className="relative w-full h-44 bg-slate-50 border border-slate-200/80 rounded-3xl overflow-hidden shadow-inner">
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
              />
              {isCanvasEmpty && (
                <div className="absolute inset-x-4 bottom-12 pointer-events-none text-center select-none">
                  <p className="text-[10px] text-indigo-900/45 font-black uppercase tracking-widest animate-pulse leading-snug">
                    Firme sobre la pantalla
                  </p>
                  <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    Utilice el dedo o lápiz capacitivo
                  </p>
                </div>
              )}
            </div>

            {/* Micro secure tracing active tags */}
            <div className="flex items-center justify-between px-1 text-[8px] text-slate-400 font-bold uppercase tracking-wider">
              <span className="flex items-center gap-1">
                🛡️ GPS: {gpsCoords.latitude && gpsCoords.longitude ? "Enlazado" : "Obteniendo ubicación…"}
              </span>
              <span>
                ⏱️ Marca de Tiempo Activa
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="px-6 pb-6 pt-2 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-12 w-full bg-slate-100 hover:bg-slate-250/60 active:scale-95 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[9px] transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isCanvasEmpty || !recipientName.trim()}
            className="h-12 w-full bg-[#10b981] hover:bg-[#059669] active:scale-95 disabled:opacity-50 text-white rounded-2xl font-black uppercase tracking-widest text-[9px] transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
          >
            Guardar Firma
          </button>
        </div>
      </motion.div>
    </div>
  );
}
