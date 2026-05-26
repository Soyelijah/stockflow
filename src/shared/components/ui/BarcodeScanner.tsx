import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, Zap, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose }) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = "barcode-scanner-viewport";
  const scanHandled = useRef(false);

  useEffect(() => {
    const html5QrCode = new Html5Qrcode(containerId);
    scannerRef.current = html5QrCode;

    const startScanner = async () => {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setHasPermission(true);
          // Prefer back camera
          const backCamera = devices.find(d => d.label.toLowerCase().includes('back')) || devices[0];
          
          await html5QrCode.start(
            backCamera.id,
            {
              fps: 20,
              qrbox: (viewWidth, viewHeight) => {
                const size = Math.min(viewWidth, viewHeight) * 0.7;
                return { width: size, height: size * 0.6 };
              },
              aspectRatio: 1.0
            },
            (decodedText) => {
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
            },
            () => { /* silent frame error */ }
          );
          setIsInitializing(false);
        } else {
          setHasPermission(false);
          setIsInitializing(false);
        }
      } catch (err) {
        console.error("Scanner Error:", err);
        setHasPermission(false);
        setIsInitializing(false);
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [onScan]);

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
            <div className="size-10 bg-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Zap size={20} />
            </div>
            <div>
              <h3 className="text-white font-black uppercase tracking-widest text-[10px]">StockFlow Scanner</h3>
              <p className="text-indigo-400 text-[9px] font-black tracking-tighter">MODO INTELIGENTE ACTIVO</p>
            </div>
          </div>
          <button type="button" 
            onClick={onClose}
            className="size-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-all active:scale-90"
          >
            <X size={20} />
          </button>
        </div>

        {/* Camera Viewport Container */}
        <div className="w-full aspect-square md:aspect-[4/3] bg-black rounded-[3rem] overflow-hidden border-4 border-white/10 relative shadow-2xl">
          <div id={containerId} className="w-full h-full object-cover" />
          
          {/* Overlay Scanner UI */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
            {/* Animated Scanning Line */}
            <motion.div 
              animate={{ top: ["20%", "80%", "20%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="absolute left-[15%] right-[15%] h-0.5 bg-indigo-400 shadow-[0_0_15px_rgba(129,140,248,0.8)] z-10"
            />
            
            {/* Focus Corners */}
            <div className="absolute inset-0 border-[40px] border-black/40" />
            <div className="w-[70%] h-[42%] border-2 border-white/30 rounded-2xl relative">
               <div className="absolute -top-1 -left-1 size-6 border-t-4 border-l-4 border-indigo-400 rounded-tl-lg" />
               <div className="absolute -top-1 -right-1 size-6 border-t-4 border-r-4 border-indigo-400 rounded-tr-lg" />
               <div className="absolute -bottom-1 -left-1 size-6 border-b-4 border-l-4 border-indigo-400 rounded-bl-lg" />
               <div className="absolute -bottom-1 -right-1 size-6 border-b-4 border-r-4 border-indigo-400 rounded-br-lg" />
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
                <div className="size-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-6" />
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
          <div className="inline-flex items-center gap-x-2 bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 rounded-full mb-4">
             <Camera size={14} className="text-indigo-400" />
             <span className="text-indigo-400 font-black uppercase tracking-[0.2em] text-[9px]">Lector de Alta Precisión</span>
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
