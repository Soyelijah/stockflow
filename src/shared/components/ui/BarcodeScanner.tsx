import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner as MLKit } from '@capacitor-mlkit/barcode-scanning';
import { X, Camera, Zap, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type ScannerAccent = "indigo" | "cyan";

// Shared scanner (staff + driver). Defaults keep the StockFlow indigo brand so the
// 4 staff consumers stay untouched; the Sf Driver app opts into cyan via props.
const SCANNER_ACCENTS: Record<ScannerAccent, {
  chip: string; text: string; line: string; corner: string; pill: string; spinner: string;
}> = {
  indigo: {
    chip: "bg-indigo-500 shadow-indigo-500/20",
    text: "text-indigo-400",
    line: "bg-indigo-400 shadow-[0_0_15px_rgba(129,140,248,0.8)]",
    corner: "border-indigo-400",
    pill: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400",
    spinner: "border-indigo-500/20 border-t-indigo-500",
  },
  cyan: {
    chip: "bg-cyan-500 shadow-cyan-500/20",
    text: "text-cyan-400",
    line: "bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.8)]",
    corner: "border-cyan-400",
    pill: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400",
    spinner: "border-cyan-500/20 border-t-cyan-500",
  },
};

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  accent?: ScannerAccent;
  title?: string;
  subtitle?: string;
}

// On a Capacitor native shell, MIUI/HyperOS force-closes any camera *preview* embedded
// in the WebView window ("close:3rdApp camera pipeline force=true") — this breaks BOTH
// html5-qrcode's <video> AND the plugin's embedded-preview mode. The MLKit `scan()` (Google Code Scanner)
// runs as a SEPARATE full-screen native Activity, which MIUI allows → rock solid. Web/PWA
// keeps html5-qrcode. Same component, same props, branding preserved outside the scan moment.
const NATIVE = Capacitor.isNativePlatform();

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onScan,
  onClose,
  accent = "indigo",
  title = "StockFlow Scanner",
  subtitle = "MODO INTELIGENTE ACTIVO",
}) => {
  const a = SCANNER_ACCENTS[accent];
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = "barcode-scanner-viewport";
  const scanHandled = useRef(false);

  // --- NATIVE path: Google Code Scanner (separate Activity, MIUI-safe) ---
  useEffect(() => {
    if (!NATIVE) return;
    let alive = true;

    const run = async () => {
      try {
        const perm = await MLKit.requestPermissions();
        if (perm.camera !== 'granted' && perm.camera !== 'limited') {
          if (alive) { setHasPermission(false); setIsInitializing(false); }
          return;
        }
        // The Google code-scanner module is distributed via Play Services and may need a
        // one-time on-demand install; surface a clear error state if it can't be obtained.
        const { available } = await MLKit.isGoogleBarcodeScannerModuleAvailable();
        if (!available) {
          await MLKit.installGoogleBarcodeScannerModule();
        }
        const { barcodes } = await MLKit.scan();
        if (!alive) return;
        const code = barcodes?.[0]?.rawValue;
        if (code && !scanHandled.current) {
          scanHandled.current = true;
          onScan(code);
        } else {
          onClose(); // user cancelled or no barcode read
        }
      } catch (err) {
        console.error("MLKit scan error:", err);
        if (alive) { setHasPermission(false); setIsInitializing(false); }
      }
    };

    run();
    return () => { alive = false; };
  }, [onScan, onClose]);

  // --- WEB path: html5-qrcode (desktop / PWA) ---
  useEffect(() => {
    if (NATIVE) return;
    const html5QrCode = new Html5Qrcode(containerId);
    scannerRef.current = html5QrCode;

    const onDecoded = (decodedText: string) => {
      if (scanHandled.current) return;
      scanHandled.current = true;

      if (html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
          onScan(decodedText);
        }).catch((err) => {
          console.error("Error stopping scanner inside scan callback:", err);
          onScan(decodedText);
        });
      } else {
        onScan(decodedText);
      }
    };

    const config = {
      fps: 10,
      qrbox: (viewWidth: number, viewHeight: number) => {
        const size = Math.min(viewWidth, viewHeight) * 0.7;
        return { width: size, height: size * 0.6 };
      },
    };

    const startWebScanner = async () => {
      try {
        await html5QrCode.start({ facingMode: "environment" }, config, onDecoded, () => {});
        setHasPermission(true);
        setIsInitializing(false);
      } catch (err) {
        console.warn("environment camera failed, retrying with explicit deviceId:", err);
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            const back = devices.find(d => d.label.toLowerCase().includes("back")) || devices[0];
            await html5QrCode.start(back.id, config, onDecoded, () => {});
            setHasPermission(true);
            setIsInitializing(false);
          } else {
            setHasPermission(false);
            setIsInitializing(false);
          }
        } catch (err2) {
          console.error("Scanner Error:", err2);
          setHasPermission(false);
          setIsInitializing(false);
        }
      }
    };

    startWebScanner();

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [onScan]);

  // ===== NATIVE render: the Google scanner Activity covers this; brand the brief
  //        loading moment + the error state. No WebView camera preview (MIUI-safe). =====
  if (NATIVE) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center"
      >
        <div className={`size-12 ${a.chip} rounded-2xl flex items-center justify-center text-white shadow-lg mb-5`}>
          <Zap size={24} />
        </div>
        <h3 className="text-white font-black uppercase tracking-widest text-xs">{title}</h3>
        <p className={`${a.text} text-[10px] font-black tracking-tighter mt-1`}>{subtitle}</p>

        {hasPermission === false ? (
          <div className="mt-9 flex flex-col items-center">
            <div className="size-20 bg-rose-500/10 text-rose-500 rounded-[2rem] flex items-center justify-center mb-6">
              <ShieldCheck size={40} />
            </div>
            <h4 className="text-white font-bold text-xl">No se pudo abrir el escáner</h4>
            <p className="text-slate-400 text-sm mt-3 leading-relaxed max-w-xs">
              Verifique el permiso de cámara y que Google Play Services esté disponible en el dispositivo.
            </p>
            <button type="button"
              onClick={onClose}
              className="mt-8 px-8 py-4 bg-white rounded-2xl text-slate-900 font-black uppercase tracking-widest text-[10px]"
            >
              Regresar
            </button>
          </div>
        ) : (
          <>
            <div className={`mt-10 size-16 border-4 ${a.spinner} rounded-full animate-spin`} />
            <p className="text-slate-400 text-sm mt-6">Abriendo escáner nativo…</p>
          </>
        )}
      </motion.div>
    );
  }

  // ===== WEB render: html5-qrcode viewport + cyan/indigo overlay frame =====
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-slate-900/95 flex flex-col items-center justify-center p-4 backdrop-blur-xl"
    >
      <div className="w-full max-w-lg relative flex flex-col items-center">
        {/* Header UI */}
        <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-x-3">
            <div className={`size-10 ${a.chip} rounded-2xl flex items-center justify-center text-white shadow-lg`}>
              <Zap size={20} />
            </div>
            <div>
              <h3 className="text-white font-black uppercase tracking-widest text-[10px]">{title}</h3>
              <p className={`${a.text} text-[9px] font-black tracking-tighter`}>{subtitle}</p>
            </div>
          </div>
          <button type="button"
            onClick={onClose}
            className="size-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-all active:scale-90"
            aria-label="Cerrar escáner"
          >
            <X size={20} />
          </button>
        </div>

        {/* Camera Viewport Container */}
        <div className="w-full aspect-square md:aspect-[4/3] bg-black rounded-[3rem] overflow-hidden border-4 border-white/10 relative shadow-2xl">
          <div id={containerId} className="w-full h-full object-cover" />

          {/* Overlay Scanner UI */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
            <motion.div
              animate={{ top: ["20%", "80%", "20%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className={`absolute left-[15%] right-[15%] h-0.5 ${a.line} z-10`}
            />

            <div className="absolute inset-0 border-[40px] border-black/40" />
            <div className="w-[70%] h-[42%] border-2 border-white/30 rounded-2xl relative">
               <div className={`absolute -top-1 -left-1 size-6 border-t-4 border-l-4 ${a.corner} rounded-tl-lg`} />
               <div className={`absolute -top-1 -right-1 size-6 border-t-4 border-r-4 ${a.corner} rounded-tr-lg`} />
               <div className={`absolute -bottom-1 -left-1 size-6 border-b-4 border-l-4 ${a.corner} rounded-bl-lg`} />
               <div className={`absolute -bottom-1 -right-1 size-6 border-b-4 border-r-4 ${a.corner} rounded-br-lg`} />
            </div>
          </div>

          {/* Loading/Error States */}
          <AnimatePresence>
            {isInitializing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center p-8 text-center"
              >
                <div className={`size-16 border-4 ${a.spinner} rounded-full animate-spin mb-6`} />
                <h4 className="text-white font-bold">Iniciando Cámara</h4>
                <p className="text-slate-400 text-xs mt-2">Por favor conceda permisos si se solicita</p>
              </motion.div>
            )}

            {hasPermission === false && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center p-12 text-center"
              >
                <div className="size-20 bg-rose-500/10 text-rose-500 rounded-[2rem] flex items-center justify-center mb-6">
                  <ShieldCheck size={40} />
                </div>
                <h4 className="text-white font-bold text-xl">Acceso Denegado</h4>
                <p className="text-slate-400 text-sm mt-3 leading-relaxed">
                  No pudimos acceder a la cámara. Verifique los permisos de su navegador o dispositivo.
                </p>
                <button type="button"
                   onClick={onClose}
                   className="mt-8 px-8 py-4 bg-white rounded-2xl text-slate-900 font-black uppercase tracking-widest text-[10px]"
                >
                  Regresar
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Instructions */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 text-center px-8"
        >
          <div className={`inline-flex items-center gap-x-2 ${a.pill} border px-4 py-2 rounded-full mb-4`}>
             <Camera size={14} className={a.text} />
             <span className={`${a.text} font-black uppercase tracking-[0.2em] text-[9px]`}>Lector de Alta Precisión</span>
          </div>
          <h4 className="text-white font-bold text-lg">Encuadre el Código</h4>
          <p className="text-slate-400 text-sm mt-2 font-medium">
            Asegúrese de tener buena iluminación y que el código esté dentro del recuadro.
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
};
