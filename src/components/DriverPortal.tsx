import React, { useState, useEffect, useRef } from "react";
import { collection, onSnapshot, query, doc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { cn, formatCurrency } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { 
  Truck, 
  MapPin, 
  Phone, 
  CheckCircle2, 
  Map, 
  User, 
  Navigation, 
  AlertCircle, 
  RefreshCw, 
  ArrowLeft, 
  Calendar, 
  ExternalLink, 
  Flame, 
  FileText, 
  ChevronRight, 
  Search, 
  Sparkles,
  Award,
  LogOut,
  Sliders,
  Check
} from "lucide-react";
import { APIProvider, Map as GoogleMap, AdvancedMarker, Pin, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import confetti from "canvas-confetti";

const WAREHOUSE_COORDS = { lat: -33.4449, lng: -70.6562 };

const GOOGLE_MAPS_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  "";

const hasValidKey = Boolean(GOOGLE_MAPS_KEY) && GOOGLE_MAPS_KEY !== "YOUR_API_KEY" && GOOGLE_MAPS_KEY.trim().length > 10;

// Internal Map route line renderer
function RoutePolyline({ origin, destination }: { origin: { lat: number; lng: number }; destination: { lat: number; lng: number } }) {
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
      fields: ["path", "distanceMeters", "durationMillis", "viewport"],
    })
      .then(({ routes }) => {
        if (routes?.[0]) {
          const newPolylines = routes[0].createPolylines();
          newPolylines.forEach((p) => {
            p.setOptions({
              strokeColor: "#4f46e5",
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
        console.error("Error drawing routes in Driver App:", err);
      });

    return () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
    };
  }, [routesLib, map, origin, destination]);

  return null;
}

export function DriverPortal({ onBackToDashboard }: { onBackToDashboard?: () => void }) {
  const { profile, logout } = useAuth();
  const { settings } = useSettings();
  const [shipments, setShipments] = useState<any[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "prepared" | "in_route" | "delivered">("all");
  const [loading, setLoading] = useState(true);
  const [showDriverSettings, setShowDriverSettings] = useState(false);
  const [showFullMap, setShowFullMap] = useState(false);
  
  // Confetti triggering on successful slide-to-confirm
  const playConfetti = () => {
    confetti({
      particleCount: 140,
      spread: 70,
      origin: { y: 0.7 }
    });
  };

  useEffect(() => {
    const q = query(collection(db, "shipments"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort by status: prepared first, then in_route, then delivered
      const statusOrder = { "in_route": 0, "prepared": 1, "delivered": 2 };
      const sorted = data.sort((a: any, b: any) => {
        const orderA = statusOrder[a.status as keyof typeof statusOrder] ?? 99;
        const orderB = statusOrder[b.status as keyof typeof statusOrder] ?? 99;
        return orderA - orderB;
      });
      setShipments(sorted);
      setLoading(false);
      
      // Auto-select first in_route shipment or prepared shipment if nothing selected
      if (sorted.length > 0 && !selectedShipment) {
        const priority = sorted.find((s: any) => s.status === "in_route") || sorted.find((s: any) => s.status === "prepared") || sorted[0];
        setSelectedShipment(priority);
      }
    }, (err) => {
      console.error("Error loading drivers shipments:", err);
      setLoading(false);
    });

    return unsub;
  }, []);

  const handleUpdateStatus = async (shipmentId: string, status: "prepared" | "in_route" | "delivered") => {
    try {
      await updateDoc(doc(db, "shipments", shipmentId), { status });
      
      // Send notification message to client portal
      const notifId = `NOTIF_${Date.now()}`;
      let msg = `Su pedido #${selectedShipment?.orderId || shipmentId} `;
      if (status === "prepared") msg += "ha sido retractado a bodega y se encuentra listo.";
      if (status === "in_route") msg += `va de camino con el transportista ${profile?.name || "Asignado"}.`;
      if (status === "delivered") msg += "¡ha sido entregado en la dirección indicada!";

      await setDoc(doc(db, "client_notifications", notifId), {
        id: notifId,
        title: status === "delivered" ? "✅ Pedido Entregado" : status === "in_route" ? "🚚 Repartidor en Ruta" : "📦 Pedido Listo",
        message: msg,
        read: false,
        timestamp: serverTimestamp(),
        type: "logistic",
        userId: selectedShipment?.customerId || "all"
      });

      if (status === "delivered") {
        playConfetti();
      }

      // Update local state smoothly
      setSelectedShipment((prev: any) => prev && prev.id === shipmentId ? { ...prev, status } : prev);
    } catch (err) {
      console.error("Error updating tracking status in Driver App:", err);
    }
  };

  const filteredShipments = shipments.filter(s => {
    const matchesSearch = s.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.orderId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.address?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = activeFilter === "all" || s.status === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "delivered":
        return (
          <span className="text-[9px] font-black tracking-widest bg-emerald-500/15 text-emerald-600 px-2.5 py-1 rounded-full uppercase">
            Entregado
          </span>
        );
      case "in_route":
        return (
          <span className="text-[9px] font-black tracking-widest bg-indigo-500/15 text-indigo-600 px-2.5 py-1 rounded-full uppercase animate-pulse">
            En Ruta
          </span>
        );
      default:
        return (
          <span className="text-[9px] font-black tracking-widest bg-amber-500/15 text-amber-600 px-2.5 py-1 rounded-full uppercase">
            Preparado
          </span>
        );
    }
  };

  // Counting segments
  const countPrepared = shipments.filter(s => s.status === "prepared").length;
  const countInRoute = shipments.filter(s => s.status === "in_route").length;
  const countDelivered = shipments.filter(s => s.status === "delivered").length;

  // Simulate slide-to-confirm touch variables
  const [slideX, setSlideX] = useState(0);
  const [isSliding, setIsSliding] = useState(false);
  const slideContainerRef = useRef<HTMLDivElement>(null);

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!slideContainerRef.current || selectedShipment.status === "delivered") return;
    const containerWidth = slideContainerRef.current.clientWidth;
    const handleWidth = 56;
    const maxSlide = containerWidth - handleWidth - 16; // 8px padding on each side
    const touch = e.touches[0];
    const rect = slideContainerRef.current.getBoundingClientRect();
    const currentX = touch.clientX - rect.left - 28; // Center target pointer
    const clampedX = Math.max(0, Math.min(maxSlide, currentX));
    setSlideX(clampedX);
    setIsSliding(true);

    if (clampedX >= maxSlide - 5) {
      // Trigger checkout/status change!
      triggerSlideAction();
    }
  };

  const handleTouchEnd = () => {
    setIsSliding(false);
    if (selectedShipment?.status === "delivered") return;
    // Reset back to start smoothly unless confirmed
    setSlideX(0);
  };

  const triggerSlideAction = () => {
    setSlideX(0);
    setIsSliding(false);
    if (!selectedShipment) return;
    if (selectedShipment.status === "prepared") {
      handleUpdateStatus(selectedShipment.id, "in_route");
    } else if (selectedShipment.status === "in_route") {
      handleUpdateStatus(selectedShipment.id, "delivered");
    }
  };

  // Mouse drag support for web/testing desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    if (selectedShipment?.status === "delivered") return;
    const startX = e.clientX;
    const handleMouseMove = (mvEvent: MouseEvent) => {
      if (!slideContainerRef.current) return;
      const containerWidth = slideContainerRef.current.clientWidth;
      const maxSlide = containerWidth - 56 - 16;
      const deltaX = mvEvent.clientX - startX;
      const clampedX = Math.max(0, Math.min(maxSlide, deltaX));
      setSlideX(clampedX);
      if (clampedX >= maxSlide - 5) {
        triggerSlideAction();
        cleanup();
      }
    };
    const handleMouseUp = () => {
      setSlideX(0);
      cleanup();
    };
    const cleanup = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const isEmbedded = Boolean(onBackToDashboard);

  return (
    <div className={cn(
      "w-full text-white flex flex-col font-sans select-none overflow-hidden items-center justify-center relative",
      isEmbedded ? "h-[calc(100vh-140px)] min-h-[500px]" : "h-screen md:min-h-screen md:bg-slate-900 md:py-6 md:px-4"
    )}>
      {/* Background ambient mesh gradient on desktop */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-950 to-slate-950 pointer-events-none z-0 hidden md:block" />
      
      {/* Device frame wrapper for Desktop display */}
      <div className={cn(
        "w-full h-full bg-slate-950 flex flex-col relative overflow-hidden z-10 shrink-0",
        isEmbedded 
          ? "max-w-md rounded-2xl border border-slate-800 shadow-xl" 
          : "md:h-[min(840px,calc(100vh-50px))] md:max-w-md md:rounded-[3rem] md:border-[10px] md:border-slate-800 md:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)]"
      )}>
        
        {/* Dynamic notch bar mockup */}
        {!isEmbedded && (
          <div className="hidden md:flex absolute top-0 left-1/2 -translate-x-1/2 w-40 h-6 bg-slate-800 rounded-b-2xl z-50 items-center justify-center">
            <div className="w-3 h-3 bg-black rounded-full mr-2" />
            <div className="w-16 h-1.5 bg-slate-900 rounded-full" />
          </div>
        )}

        {/* App Internal Body wrapper */}
        <div className={cn(
          "flex-1 flex flex-col h-full overflow-hidden relative",
          isEmbedded ? "pt-0" : "pt-0 md:pt-10"
        )}>
          
          {/* Header */}
          <div className="px-6 py-4 flex items-center justify-between border-b border-white/5 bg-slate-950/80 backdrop-blur z-20">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                <Truck size={18} />
              </div>
              <div>
                <h1 className="text-sm font-black tracking-tight leading-none">Ruta Repartidor</h1>
                <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mt-1">
                  {profile?.name || "Logística"}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setShowDriverSettings(!showDriverSettings)}
                className="p-2.5 bg-white/5 rounded-xl text-white hover:bg-white/10 active:scale-95 transition-all"
                title="Configuración de conductor"
              >
                <Sliders size={14} />
              </button>
              {onBackToDashboard ? (
                <button 
                  onClick={onBackToDashboard}
                  className="px-3 py-1.5 bg-indigo-600 text-[9px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1 hover:bg-indigo-700 active:scale-95 transition-all"
                >
                  <ArrowLeft size={10} /> Volver
                </button>
              ) : (
                <button 
                  onClick={() => logout()}
                  className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl hover:bg-rose-500/20 active:scale-95 transition-all"
                >
                  <LogOut size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Settings Overlay panel */}
          <AnimatePresence>
            {showDriverSettings && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute inset-0 bg-slate-950/95 z-[100] p-6 flex flex-col pt-16 text-slate-100"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-base font-black tracking-tight flex items-center gap-2">
                    <Sliders size={18} className="text-indigo-400" /> Control del Conductor
                  </h3>
                  <button 
                    onClick={() => setShowDriverSettings(false)}
                    className="p-1.5 bg-white/5 rounded-lg text-slate-400 hover:text-white"
                  >
                    Cerrar
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="bg-slate-900 p-4 rounded-2xl border border-white/5 space-y-2">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Información de Unidad</p>
                    <p className="text-xs font-bold">Camión de Reparto: <span className="text-white">Kia Frontier (Patente AB-CD-12)</span></p>
                    <p className="text-xs font-bold text-slate-400">Comuna Central: <span className="text-white">Santiago Centro</span></p>
                  </div>

                  <div className="bg-slate-900 p-4 rounded-2xl border border-white/5 space-y-3">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Estado Georreferenciado</p>
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span>GPS Activo</span>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    </div>
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                      <span>Lat: {WAREHOUSE_COORDS.lat}</span>
                      <span>Lng: {WAREHOUSE_COORDS.lng}</span>
                    </div>
                  </div>

                  <div className="bg-indigo-650 p-4 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl">
                    <h4 className="text-xs font-black text-indigo-300">¿Cómo operar?</h4>
                    <p className="text-[10px] text-slate-300 mt-1 leading-relaxed font-semibold">
                      Cambie el estado de los pedidos asignados deslizando el gatillo inferior en la ficha detallada. Los clientes verán la actualización en tiempr real desde su portal con alertas push.
                    </p>
                  </div>
                </div>

                <div className="mt-auto">
                  <button 
                    onClick={() => { logout(); setShowDriverSettings(false); }}
                    className="w-full py-4 bg-rose-600/20 text-rose-400 border border-rose-500/30 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600/30 transition-all"
                  >
                    Cerrar Sesión Conductor
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-2 px-6 py-4 bg-slate-950/40 border-b border-white/5">
            <button 
              onClick={() => setActiveFilter("prepared")}
              className={cn(
                "p-3 rounded-2xl border transition-all text-center flex flex-col items-center",
                activeFilter === "prepared" ? "bg-amber-500/10 border-amber-500 text-amber-500" : "bg-white/5 border-white/5 hover:bg-white/10 text-slate-400"
              )}
            >
              <span className="text-lg font-black">{countPrepared}</span>
              <span className="text-[8px] font-black uppercase tracking-wider mt-1">Preparados</span>
            </button>
            <button 
              onClick={() => setActiveFilter("in_route")}
              className={cn(
                "p-3 rounded-2xl border transition-all text-center flex flex-col items-center",
                activeFilter === "in_route" ? "bg-indigo-500/10 border-indigo-500 text-indigo-500" : "bg-white/5 border-white/5 hover:bg-white/10 text-slate-400"
              )}
            >
              <span className="text-lg font-black">{countInRoute}</span>
              <span className="text-[8px] font-black uppercase tracking-wider mt-1">En Ruta</span>
            </button>
            <button 
              onClick={() => setActiveFilter("delivered")}
              className={cn(
                "p-3 rounded-2xl border transition-all text-center flex flex-col items-center",
                activeFilter === "delivered" ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" : "bg-white/5 border-white/5 hover:bg-white/10 text-slate-400"
              )}
            >
              <span className="text-lg font-black">{countDelivered}</span>
              <span className="text-[8px] font-black uppercase tracking-wider mt-1">Entregados</span>
            </button>
          </div>

          {/* Main List & Map Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 relative flex flex-col">
            
            {/* Real Search bar */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={14} />
              <input 
                type="text"
                placeholder="Buscar por cliente, id, dirección..."
                className="w-full h-11 bg-white/5 border border-white/5 rounded-2xl pl-11 pr-4 text-xs font-bold text-white placeholder:text-white/20 outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              {activeFilter !== "all" && (
                <button 
                  onClick={() => setActiveFilter("all")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] bg-indigo-600 px-1.5 py-0.5 rounded font-black uppercase text-white tracking-widest"
                >
                  Filtro: {activeFilter} ✕
                </button>
              )}
            </div>

            {/* If Shipment Selected - Show detailed mobile routing card at top */}
            <AnimatePresence mode="popLayout">
              {selectedShipment && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-950 p-5 rounded-[2rem] border border-white/5 space-y-4 shadow-xl relative overflow-hidden"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-[8.5px] font-black tracking-widest bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded uppercase">
                          PEDIDO #{selectedShipment.orderId}
                        </span>
                        {getStatusBadge(selectedShipment.status)}
                      </div>
                      <h3 className="text-sm font-black text-white">{selectedShipment.customerName}</h3>
                    </div>
                    
                    <button 
                      onClick={() => setShowFullMap(!showFullMap)}
                      className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-indigo-400 flex items-center space-x-1"
                      title="Ver mapa geolocalizado completo"
                    >
                      <Map size={14} />
                      <span className="text-[9px] font-black uppercase">GPS</span>
                    </button>
                  </div>

                  {/* Route map container inline or collapsed */}
                  <div className="h-32 rounded-2xl bg-slate-900 border border-white/5 relative overflow-hidden">
                    {hasValidKey ? (
                      <APIProvider apiKey={GOOGLE_MAPS_KEY} version="weekly">
                        <GoogleMap
                          defaultCenter={WAREHOUSE_COORDS}
                          defaultZoom={11}
                          gestureHandling="none"
                          disableDefaultUI
                          mapId="DRIVER_PORTAL_MINIMAP"
                          internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
                          style={{ width: "100%", height: "100%" }}
                        >
                          <AdvancedMarker position={WAREHOUSE_COORDS}>
                            <Pin background="#4f46e5" glyphColor="#fff" scale={0.8} />
                          </AdvancedMarker>
                          <AdvancedMarker position={{ lat: selectedShipment.lat || -33.45, lng: selectedShipment.lng || -70.66 }}>
                            <Pin background="#f59e0b" glyphColor="#fff" scale={0.8} />
                          </AdvancedMarker>
                          <RoutePolyline origin={WAREHOUSE_COORDS} destination={{ lat: selectedShipment.lat || -33.45, lng: selectedShipment.lng || -70.66 }} />
                        </GoogleMap>
                      </APIProvider>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center space-y-1">
                        <MapPin className="text-slate-500" size={20} />
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Santiago Oriente Ruta</p>
                        <p className="text-[8px] text-slate-600 font-semibold">{selectedShipment.address}</p>
                      </div>
                    )}
                    
                    {/* Dark gradient backdrop */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 to-transparent p-3 flex justify-between items-end">
                      <div className="text-[9px] text-white font-extrabold flex items-center gap-1 bg-slate-950/80 px-2 py-1 rounded">
                        <MapPin size={8} /> {selectedShipment.address}
                      </div>
                    </div>
                  </div>

                  {/* Delivery Info items */}
                  <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/5">
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Items del despacho</p>
                      <p className="text-[10px] text-slate-200 font-bold mt-1 truncate max-w-[200px]">
                        {selectedShipment.items?.join(", ") || "No especificados"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Total venta</p>
                      <p className="text-xs font-black text-white">{formatCurrency(selectedShipment.total || 0)}</p>
                    </div>
                  </div>

                  {/* Call, WhatsApp, Address navigation buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <a 
                      href={`tel:${selectedShipment.driverPhone || "+56987654321"}`}
                      className="h-10 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center text-xs font-extrabold gap-2 border border-white/5 transition-colors"
                    >
                      <Phone size={12} className="text-indigo-400" /> Llamar Cliente
                    </a>
                    <a 
                      href={`https://wa.me/${(selectedShipment.driverPhone || "+56987654321").replace(/\s/g, "").replace("+", "")}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="h-10 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center text-xs font-extrabold gap-2 border border-emerald-500/10 transition-colors"
                    >
                      <Navigation size={12} /> WhatsApp Chat
                    </a>
                  </div>

                  {/* Tactile slide to update route status bar */}
                  {selectedShipment.status !== "delivered" ? (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-slate-400">
                        <span>Deslice para avanzar despacho:</span>
                        <span className="text-indigo-400">
                          {selectedShipment.status === "prepared" ? "Siguiente: EN RUTA" : "Siguiente: ENTREGAR"}
                        </span>
                      </div>
                      <div 
                        ref={slideContainerRef}
                        className="h-16 bg-slate-900 border border-white/10 rounded-2xl relative p-2 flex items-center overflow-hidden cursor-pointer"
                        onMouseDown={handleMouseDown}
                      >
                        {/* Shimmer text indicator */}
                        <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-white/20 select-none animate-pulse">
                          {selectedShipment.status === "prepared" ? ">>> DESLICE PARA INICIAR RUTA >>>" : ">>> DESLICE PARA ENTREGAR >>>"}
                        </div>

                        {/* Slide handle tab trigger */}
                        <motion.div 
                          className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg cursor-grab active:cursor-grabbing absolute left-2 z-10"
                          style={{ x: slideX }}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={handleTouchEnd}
                        >
                          {selectedShipment.status === "prepared" ? <Truck size={18} /> : <Check size={18} />}
                        </motion.div>
                        
                        {/* Slide filled progress marker */}
                        <div 
                          className="absolute h-full left-0 bg-indigo-600/10 border-r border-indigo-500/20 rounded-l-2xl pointer-events-none transition-all duration-75"
                          style={{ width: `${slideX + 24}px` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-500/15 border border-emerald-500/30 p-4 rounded-2xl text-center text-emerald-400 flex items-center justify-center gap-2">
                      <CheckCircle2 size={16} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Pedido entregado con éxito</span>
                    </div>
                  )}

                </motion.div>
              )}
            </AnimatePresence>

            {/* List Header */}
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Hoja de Ruta ({filteredShipments.length} envíos)
              </p>
            </div>

            {/* Scrollable list of shipments */}
            <div className="space-y-3 pr-1">
              {filteredShipments.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedShipment(s)}
                  className={cn(
                    "w-full p-4 rounded-2xl border text-left flex items-start justify-between transition-all",
                    selectedShipment?.id === s.id 
                      ? "bg-indigo-600 border-transparent text-white shadow-lg" 
                      : s.status === "delivered" 
                        ? "bg-white/2 border-white/5 opacity-55 hover:opacity-80" 
                        : "bg-white/5 border-white/5 hover:bg-white/10"
                  )}
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className={cn(
                        "text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider",
                        selectedShipment?.id === s.id ? "bg-white/15 text-white" : "bg-white/5 text-slate-300"
                      )}>
                        #{s.orderId}
                      </span>
                      <span className="text-[9px] font-bold opacity-75">{s.customerName}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[9px] opacity-75">
                      <MapPin size={9} />
                      <span className="truncate max-w-[200px]">{s.address}</span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right space-y-1">
                    {s.status === "delivered" ? (
                      <span className="text-[7.5px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 uppercase">✓ OK</span>
                    ) : s.status === "in_route" ? (
                      <span className="text-[7.5px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 uppercase animate-pulse">Ruta</span>
                    ) : (
                      <span className="text-[7.5px] font-black px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 uppercase">Prep</span>
                    )}
                    <ChevronRight size={14} className="opacity-40 ml-auto" />
                  </div>
                </button>
              ))}

              {filteredShipments.length === 0 && (
                <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl bg-white/2">
                  <Truck size={24} className="mx-auto text-white/20 mb-2" />
                  <p className="text-xs text-white/40 font-bold italic">No hay envíos que coincidan</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded full screen Interactive Routing Map overlay */}
      <AnimatePresence>
        {showFullMap && selectedShipment && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-slate-950 flex flex-col"
          >
            {/* Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-white/5">
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => setShowFullMap(false)}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-xl"
                >
                  <ArrowLeft size={16} />
                </button>
                <div>
                  <h3 className="text-sm font-black">Navegación GPS</h3>
                  <p className="text-[10px] text-slate-400 font-bold">Pedido #{selectedShipment.orderId} con {selectedShipment.customerName}</p>
                </div>
              </div>
              
              <button 
                onClick={() => setShowFullMap(false)}
                className="px-4 py-2 bg-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest text-white"
              >
                Cerrar Mapa
              </button>
            </div>

            {/* Map Canvas */}
            <div className="flex-1 w-full relative">
              {hasValidKey ? (
                <APIProvider apiKey={GOOGLE_MAPS_KEY} version="weekly">
                  <GoogleMap
                    defaultCenter={WAREHOUSE_COORDS}
                    defaultZoom={13}
                    mapId="DRIVER_FULL_MAP"
                    internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
                    style={{ width: "100%", height: "100%" }}
                  >
                    <AdvancedMarker position={WAREHOUSE_COORDS}>
                      <Pin background="#4f46e5" glyphColor="#fff">
                        <div className="p-1">🏬</div>
                      </Pin>
                    </AdvancedMarker>
                    <AdvancedMarker position={{ lat: selectedShipment.lat || -2, lng: selectedShipment.lng || 2 }}>
                      <Pin background="#10b981" glyphColor="#fff">
                        <div className="p-1">📍</div>
                      </Pin>
                    </AdvancedMarker>
                    <RoutePolyline origin={WAREHOUSE_COORDS} destination={{ lat: selectedShipment.lat || -2, lng: selectedShipment.lng || 2 }} />
                  </GoogleMap>
                </APIProvider>
              ) : (
                <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center text-center p-8">
                  <Navigation size={48} className="text-indigo-400 mb-4 animate-bounce" />
                  <h4 className="text-sm font-black">Modo Simulación Geográfica</h4>
                  <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed">
                    Sin clave API registrada, mostramos simulación de ruta sobre Santiago de Chile. Dirección: {selectedShipment.address}
                  </p>
                </div>
              )}

              {/* Floating driver route card inside fullscreen map */}
              <div className="absolute bottom-6 inset-x-6 bg-slate-900 border border-white/10 p-5 rounded-3xl shadow-2xl flex items-center justify-between">
                <div>
                  <p className="text-[8px] font-black uppercase tracking-wider text-indigo-400">Instrucciones de entrega</p>
                  <p className="text-xs font-bold text-white mt-0.5">{selectedShipment.address}</p>
                  <p className="text-[10px] text-slate-400 mt-1">Paquetes: {selectedShipment.items?.join(", ")}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <a 
                    href={`https://maps.google.com/?q=${encodeURIComponent(selectedShipment.address)}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-3 bg-indigo-600 text-white rounded-2xl flex items-center gap-1 text-[10px] font-black uppercase tracking-wide hover:bg-indigo-700 transition"
                  >
                    <ExternalLink size={12} /> Abrir Waze/Google Maps
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
