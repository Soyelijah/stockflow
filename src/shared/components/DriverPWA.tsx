import React, { useEffect, useState, useRef } from "react";
import { APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { collection, onSnapshot, query, doc, updateDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { cn } from "../../lib/utils";
import { 
  MapPin, Navigation, Truck, User, Phone, CheckCircle, Package, 
  Loader2, Sparkles, LogOut, ArrowRight, ShieldCheck, QrCode, ClipboardList, Award, Home
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { BarcodeScanner } from "./ui/BarcodeScanner";
import { toDate, formatCurrency } from "../../lib/utils";

const WAREHOUSE_COORDS = { lat: -33.4449, lng: -70.6562 };

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  "";

// Polyline render component
function DriverPolyline({ origin, destination }: { origin: { lat: number; lng: number }; destination: { lat: number; lng: number } }) {
  const map = useMap();
  const routesLib = useMapsLibrary("routes");
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!routesLib || !map || !origin || !destination) return;

    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    routesLib.Route.computeRoutes({
      origin: origin,
      destination: destination,
      travelMode: "DRIVING",
      fields: ["path", "viewport"],
    })
      .then(({ routes }) => {
        if (routes?.[0]) {
          const newPolylines = routes[0].createPolylines();
          newPolylines.forEach((p) => {
            p.setOptions({
              strokeColor: "#ff4757",
              strokeWeight: 6,
              strokeOpacity: 0.9,
            });
            p.setMap(map);
          });
          polylinesRef.current = newPolylines;
          if (routes[0].viewport) {
            map.fitBounds(routes[0].viewport);
          }
        }
      })
      .catch((err) => {
        console.error("[Driver Map Route Error]:", err);
      });

    return () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
    };
  }, [routesLib, map, origin, destination]);

  return null;
}

export function DriverPWA() {
  const { logout, profile } = useAuth();
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentStop, setCurrentStop] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [transitInterval, setTransitInterval] = useState<NodeJS.Timeout | null>(null);

  // Load shipments real-time
  useEffect(() => {
    const q = query(collection(db, "shipments"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allShipments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      
      // Sort shipments by routeIndex or orderId to enforce sequential transit
      const sorted = allShipments.sort((a, b) => {
        const idxA = a.routeIndex !== undefined ? a.routeIndex : 999;
        const idxB = b.routeIndex !== undefined ? b.routeIndex : 999;
        return idxA - idxB;
      });
      
      setShipments(sorted);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Compute pending sequence & active sequential next stop
  const pendingStops = shipments.filter(s => s.status !== "delivered");
  const completedStopsCount = shipments.filter(s => s.status === "delivered").length;
  const activeNextStop = pendingStops[0] || null;

  // Track coordinates transit simulation (autonomous step-by-step slide towards dest)
  useEffect(() => {
    if (activeNextStop && activeNextStop.status === "in_route") {
      // Start real-time Firestore coordinates updates simulation to feedback client map
      const startLat = activeNextStop.currentLat || WAREHOUSE_COORDS.lat;
      const startLng = activeNextStop.currentLng || WAREHOUSE_COORDS.lng;
      const destLat = activeNextStop.lat;
      const destLng = activeNextStop.lng;
      
      let step = 0;
      const totalSteps = 10;
      let isUpdating = false;
      
      const interval = setInterval(async () => {
        if (isUpdating) return;
        isUpdating = true;
        try {
          step += 1;
          const currentLat = startLat + (destLat - startLat) * (step / totalSteps);
          const currentLng = startLng + (destLng - startLng) * (step / totalSteps);
          
          const docRef = doc(db, "shipments", activeNextStop.id);
          await updateDoc(docRef, {
            currentLat,
            currentLng,
            lastLocationUpdate: serverTimestamp()
          });
          
          if (step >= totalSteps) {
            clearInterval(interval);
          }
        } catch (e) {
          console.error("Error updating coordinates in transit:", e);
        } finally {
          isUpdating = false;
        }
      }, 4000); // Shift truck every 4 seconds to target customer coordinates

      return () => clearInterval(interval);
    }
  }, [activeNextStop?.id, activeNextStop?.status]);

  // Handle tactical Begin Transit trigger
  const handleStartTransit = async (stopId: string) => {
    try {
      const docRef = doc(db, "shipments", stopId);
      await updateDoc(docRef, {
        status: "in_route",
        currentLat: WAREHOUSE_COORDS.lat,
        currentLng: WAREHOUSE_COORDS.lng,
        startedTransitAt: serverTimestamp()
      });
      showSuccessBanner("🚚 Tránsito Iniciado. Siga la ruta del mapa.");
    } catch (err: any) {
      console.error(err);
    }
  };

  // Handle sequential tactical Deliver completion
  const handleDeliverStop = async (stopId: string) => {
    try {
      const docRef = doc(db, "shipments", stopId);
      await updateDoc(docRef, {
        status: "delivered",
        deliveredAt: serverTimestamp(),
        currentLat: null, // Clear live truck indicator
        currentLng: null
      });
      showSuccessBanner("✅ ¡Entrega confirmada con éxito!");
    } catch (err: any) {
      console.error(err);
    }
  };

  // Barcode Scanner handler
  const handleBarcodeScan = async (code: string) => {
    setIsScanning(false);
    if (!activeNextStop) return;

    // Standard checking format: if orderId is inside the scanned buffer
    const cleanScanned = code.trim().toLowerCase();
    const cleanOrderId = activeNextStop.orderId.trim().toLowerCase();

    if (cleanScanned.includes(cleanOrderId) || cleanOrderId.includes(cleanScanned) || cleanScanned.length > 5) {
      await handleDeliverStop(activeNextStop.id);
    } else {
      setScannerError(`Código incorrecto. Escaneó: "${code}". Se esperaba comprobante de Orden #${activeNextStop.orderId}`);
      setTimeout(() => setScannerError(null), 6000);
    }
  };

  const showSuccessBanner = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-50 font-sans gap-4">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Cargando Hoja de Ruta...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans max-w-md mx-auto relative overflow-x-hidden pb-12">
      {/* Mobile Top App Bar */}
      <header className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-2xl flex items-center justify-center">
            <Truck size={20} />
          </div>
          <div>
            <h1 className="text-xs font-black uppercase tracking-widest text-[#10b981]">Ruta de Transportista</h1>
            <p className="text-[10px] text-white/50 font-bold truncate max-w-[180px]">
              {profile?.userName || "Transportista Asignado"}
            </p>
          </div>
        </div>
        <button 
          onClick={() => logout()}
          className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full transition-colors font-bold text-white/80 active:scale-95 flex items-center"
          title="Cerrar Sesión"
        >
          <LogOut size={16} />
        </button>
      </header>

      {/* Floating alert/success notification */}
      {successMessage && (
        <div className="fixed top-20 left-4 right-4 z-50 bg-emerald-500 text-white p-4 rounded-2xl shadow-2xl font-black text-xs text-center uppercase tracking-wider flex items-center justify-center gap-2 animate-bounce">
          <CheckCircle size={16} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Statistics and streak summary cards */}
      <section className="p-4 grid grid-cols-3 gap-3">
        <div className="bg-slate-900 text-white p-3 rounded-2.5xl text-center border border-slate-800">
          <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Total Paradas</p>
          <p className="text-lg font-black mt-1 font-mono">{shipments.length}</p>
        </div>
        <div className="bg-white p-3 rounded-2.5xl text-center border border-slate-100 shadow-sm">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Entregadas</p>
          <p className="text-lg font-black mt-1 font-mono text-emerald-600">{completedStopsCount}</p>
        </div>
        <div className="bg-white p-3 rounded-2.5xl text-center border border-slate-100 shadow-sm">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Pendientes</p>
          <p className="text-lg font-black mt-1 font-mono text-amber-500">{pendingStops.length}</p>
        </div>
      </section>

      {/* MAP VIEWPORT CARD */}
      <section className="px-4 pb-4">
        <div className="w-full h-[240px] bg-slate-200 rounded-[2.5rem] overflow-hidden border border-slate-200/60 shadow-md relative">
          <APIProvider apiKey={API_KEY} version="weekly">
            <Map
              defaultCenter={activeNextStop ? { lat: activeNextStop.lat, lng: activeNextStop.lng } : WAREHOUSE_COORDS}
              defaultZoom={13}
              mapId="DRIVER_PWA_MAP_ID"
              internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
              style={{ width: "100%", height: "100%" }}
            >
              <AdvancedMarker position={WAREHOUSE_COORDS}>
                <Pin background="#4f46e5" scale={1.0}>
                  <div className="text-[10px]">🏢</div>
                </Pin>
              </AdvancedMarker>

              {activeNextStop && activeNextStop.lat && (
                <>
                  <AdvancedMarker position={{ lat: activeNextStop.lat, lng: activeNextStop.lng }}>
                    <Pin background="#ff4757" scale={1.2}>
                      <div className="text-[11px] font-bold text-white">📍</div>
                    </Pin>
                  </AdvancedMarker>

                  <DriverPolyline 
                    origin={WAREHOUSE_COORDS}
                    destination={{ lat: activeNextStop.lat, lng: activeNextStop.lng }}
                  />
                  
                  {activeNextStop.status === "in_route" && activeNextStop.currentLat && (
                    <AdvancedMarker position={{ lat: activeNextStop.currentLat, lng: activeNextStop.currentLng }}>
                      <div className="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
                        <span className="absolute inline-flex h-7 w-7 rounded-full bg-red-400 opacity-40 animate-ping" />
                        <div className="w-8 h-8 bg-slate-950 border-2 border-white rounded-full flex items-center justify-center shadow-lg text-xs relative z-10">
                          🚚
                        </div>
                      </div>
                    </AdvancedMarker>
                  )}
                </>
              )}
            </Map>
          </APIProvider>
        </div>
      </section>

      {/* CORE SEQUENTIAL TRANSIT PANEL */}
      <main className="px-4 space-y-4">
        {activeNextStop ? (
          <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-xl space-y-5 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 bg-rose-50 rounded-xl flex items-center justify-center text-rose-500 font-bold font-mono text-sm shadow-sm">
                  {completedStopsCount + 1}
                </div>
                <div>
                  <h4 className="text-xs font-black text-rose-500 uppercase tracking-widest">Siguiente Súper Parada</h4>
                  <p className="text-xs font-bold text-slate-800 truncate max-w-[140px] mt-0.5" title={activeNextStop.customerName}>
                    {activeNextStop.customerName}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className={cn(
                  "px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-full",
                  activeNextStop.status === "in_route" ? "bg-red-100 text-red-650" : "bg-amber-100 text-amber-600"
                )}>
                  {activeNextStop.status === "in_route" ? "En Camino 🚩" : "Preparado"}
                </span>
              </div>
            </div>

            {/* Address & package items detailed checklist card */}
            <div className="space-y-3 p-4 bg-slate-50 rounded-2.5xl border border-slate-100">
              <div className="space-y-1">
                <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Dirección</span>
                <p className="text-[11px] font-extrabold text-slate-700 font-sans leading-snug">
                  {activeNextStop.address}
                </p>
              </div>
              <div className="h-px bg-slate-200/50" />
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Orden</span>
                  <p className="font-mono font-bold text-slate-600">#{activeNextStop.orderId.substring(0, 10).toUpperCase()}</p>
                </div>
                <div>
                  <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Teléfono</span>
                  <p className="font-semibold text-slate-600 flex items-center gap-1">
                    <Phone size={10} /> {activeNextStop.customerPhone || "Sin fono"}
                  </p>
                </div>
              </div>
              <div className="h-px bg-slate-200/50" />
              <div className="space-y-1.5">
                <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Productos del Despacho</span>
                <div className="max-h-[80px] overflow-y-auto space-y-1">
                  {activeNextStop.items?.map((item: string, idx: number) => (
                    <div key={idx} className="flex items-center space-x-1.5 text-[10.5px] font-bold text-slate-600">
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full shrink-0" />
                      <p className="truncate">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ERROR BANNER FOR CODE VERIFICATION */}
            {scannerError && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-2xl text-[10px] font-bold font-sans">
                ⚠️ {scannerError}
              </div>
            )}

            {/* Tactical Control Actions buttons */}
            <div className="flex flex-col gap-3 pt-1">
              {activeNextStop.status !== "in_route" ? (
                <button
                  onClick={() => handleStartTransit(activeNextStop.id)}
                  className="w-full py-4 bg-red-500 hover:bg-red-600 active:scale-[0.99] text-white transition-all rounded-2.5xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-lg shadow-red-200"
                >
                  <Navigation size={14} className="animate-pulse" />
                  Comenzar viaje hacia la parada
                </button>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={() => setIsScanning(true)}
                    className="w-full py-4 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white transition-all rounded-2.5xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-xl"
                  >
                    <QrCode size={14} />
                    Escanear Comprobante / QR
                  </button>

                  <div className="flex items-center justify-center py-1">
                    <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest">O de forma manual táctil:</span>
                  </div>

                  <button
                    onClick={() => handleDeliverStop(activeNextStop.id)}
                    className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-white transition-all rounded-2.5xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-lg shadow-emerald-200"
                  >
                    <CheckCircle size={14} />
                    Confirmar Entrega Tactil
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-indigo-900 to-slate-950 text-white rounded-[2.5rem] p-8 shadow-2xl text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner">
              <Award size={40} className="animate-wiggle" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-black tracking-tight font-sans uppercase">¡Ruta Completada!</h3>
              <p className="text-xs text-indigo-200/70 font-bold max-w-xs mx-auto leading-relaxed">
                Excelente labor. Ha despachado secuencialmente todas sus entregas correspondientes a la hoja de ruta de hoy. Retorne seguro a la bodega principal.
              </p>
            </div>

            <div className="py-2.5 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-center text-xs font-black uppercase tracking-wider gap-2">
              🏢 Bodega Principal Destino Activo
            </div>
          </div>
        )}

        {/* SEQUENCE STOPS ACCORDION LIST */}
        <div className="space-y-2 text-left">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Secuencia completa de paradas ({shipments.length})</p>
          
          <div className="space-y-2 bg-white rounded-[2rem] p-4 border border-slate-100 shadow-sm max-h-[220px] overflow-y-auto">
            {shipments.map((stop, idx) => {
              const isCurrent = activeNextStop?.id === stop.id;
              const isDelivered = stop.status === "delivered";
              
              return (
                <div 
                  key={stop.id} 
                  className={cn(
                    "p-3 rounded-2xl flex items-center justify-between text-xs transition-colors border",
                    isCurrent 
                      ? "bg-rose-50/50 border-rose-100 text-rose-950" 
                      : isDelivered 
                      ? "bg-slate-50/40 border-slate-100 text-slate-450 opacity-60" 
                      : "bg-white border-slate-100 text-slate-700"
                  )}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <span className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] font-mono shrink-0",
                      isCurrent 
                        ? "bg-rose-500 text-white" 
                        : isDelivered 
                        ? "bg-emerald-100 text-emerald-600" 
                        : "bg-slate-100 text-slate-500"
                    )}>
                      {idx + 1}
                    </span>
                    <div className="truncate min-w-0">
                      <p className="font-extrabold truncate">{stop.customerName}</p>
                      <p className="text-[9px] text-slate-400 font-semibold truncate mt-0.5">{stop.address}</p>
                    </div>
                  </div>
                  <span className={cn(
                    "text-[8px] font-black uppercase shrink-0 px-2 py-0.5 rounded-full border",
                    isCurrent 
                      ? "bg-rose-100 text-rose-600 border-rose-200/30" 
                      : isDelivered 
                      ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                      : "bg-amber-50 text-amber-500 border-amber-100"
                  )}>
                    {isDelivered ? "Entregada ✔" : isCurrent ? "Siguiente stop" : "Esperando"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* RENDER QR BARCODE SCANNER OVERLAY IF TOGGLED */}
      <AnimatePresence>
        {isScanning && (
          <BarcodeScanner 
            onScan={handleBarcodeScan}
            onClose={() => setIsScanning(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
