import React, { useEffect, useState, useRef } from "react";
import { APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { collection, onSnapshot, query, doc, updateDoc, serverTimestamp, getDocs, where } from "firebase/firestore";
import { db, storage, handleFirestoreError, OperationType } from "../../lib/firebase";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useAuth } from "../../contexts/AuthContext";
import { cn } from "../../lib/utils";
import {
  MapPin, Navigation, Truck, User, Phone, CheckCircle, Package,
  Loader2, Sparkles, LogOut, ArrowRight, ShieldCheck, QrCode, ClipboardList, Award, Home, Bell,
  Camera, X, AlertTriangle, ShoppingCart, Settings,
  type LucideIcon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { BarcodeScanner } from "./ui/BarcodeScanner";
import { SignatureModal } from "./SignaturePad";
import { toDate, formatCurrency } from "../../lib/utils";
import { requestFCMToken, listenToForegroundMessages } from "../../lib/fcmClient";

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
  const [activeTab, setActiveTab] = useState<"home" | "stops" | "map" | "profile">("home");
  const [stopsFilter, setStopsFilter] = useState<"all" | "pending" | "delivered">("all");
  const [isSignatureOpen, setIsSignatureOpen] = useState(false);
  const [pendingDeliverStopId, setPendingDeliverStopId] = useState<string | null>(null);
  const [isFailedModalOpen, setIsFailedModalOpen] = useState(false);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [transitInterval, setTransitInterval] = useState<NodeJS.Timeout | null>(null);

  const [fcmRegistered, setFcmRegistered] = useState(false);
  const [fcmLoading, setFcmLoading] = useState(false);

  // Monitor notifications status and connect foreground handler
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        setFcmRegistered(true);
      }
    }

    if (profile?.uid) {
      const unsub = listenToForegroundMessages((payload) => {
        showSuccessBanner(`🔔 ${payload.notification?.title || "Aviso en Ruta"}: ${payload.notification?.body || "Novedades de despacho."}`);
      });
      return () => {
        if (unsub) unsub();
      };
    }
  }, [profile?.uid]);

  const handleActivateNotifications = async () => {
    if (!profile?.uid) return;
    setFcmLoading(true);
    try {
      const token = await requestFCMToken(profile.uid, "driver");
      if (token) {
        setFcmRegistered(true);
        showSuccessBanner("🔔 ¡Notificaciones de Ruta Activadas!");
      } else {
        setFcmRegistered(true);
        showSuccessBanner("🔔 Notificaciones listas para despachos.");
      }
    } catch (e) {
      console.error("FCM Activation Error:", e);
    } finally {
      setFcmLoading(false);
    }
  };

  // Load shipments real-time
  useEffect(() => {
    if (!profile?.uid) return;
    const q = query(
      collection(db, "shipments"),
      where("assignedDriverId", "==", profile.uid),
      where("status", "in", ["assigned", "in_route", "preparing"])
    );
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
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "shipments");
    });

    return () => unsubscribe();
  }, [profile?.uid]);

  // Compute pending sequence & active sequential next stop
  const pendingStops = shipments.filter(s => s.status !== "delivered");
  const completedStopsCount = shipments.filter(s => s.status === "delivered").length;
  const activeNextStop = pendingStops[0] || null;

  // Stops tab: keep true sequence index after filtering
  const filteredStops = shipments
    .map((stop, idx) => ({ stop, idx }))
    .filter(({ stop }) =>
      stopsFilter === "delivered"
        ? stop.status === "delivered"
        : stopsFilter === "pending"
        ? stop.status !== "delivered"
        : true
    );

  // Track coordinates via real browser Geolocation API
  useEffect(() => {
    if (activeNextStop && activeNextStop.status === "in_route") {
      if (!navigator.geolocation) {
        console.warn("Geolocation is not supported by this browser.");
        return;
      }

      let isUpdating = false;

      const watchId = navigator.geolocation.watchPosition(
        async (position) => {
          if (isUpdating) return;
          isUpdating = true;
          try {
            const { latitude, longitude } = position.coords;

            // Validate that the reported coordinates are within the real geographical limits of Chile:
            // -56 <= lat <= -17, -77 <= lng <= -67
            if (latitude >= -56 && latitude <= -17 && longitude >= -77 && longitude <= -67) {
              const docRef = doc(db, "shipments", activeNextStop.id);
              await updateDoc(docRef, {
                currentLat: latitude,
                currentLng: longitude,
                locationSource: "gps",
                lastLocationUpdate: serverTimestamp()
              });
            } else {
              console.warn(`[Anti-Spoofing] Geolocation rejected: coordinates (${latitude}, ${longitude}) are outside Chile bounds.`);
            }
          } catch (e) {
            console.error("Error updating coordinates from GPS watch:", e);
          } finally {
            isUpdating = false;
          }
        },
        (error) => {
          console.error("Error watching geolocation position:", error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 15000
        }
      );

      return () => navigator.geolocation.clearWatch(watchId);
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

  // Helper to resize image keeping aspect ratio
  const resizeImageToBlob = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const max = 800;
        if (width > max || height > max) {
          if (width > height) {
            height = Math.round((height * max) / width);
            width = max;
          } else {
            width = Math.round((width * max) / height);
            height = max;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("La conversión de imagen a Blob falló."));
            }
          }, "image/jpeg", 0.85);
        } else {
          reject(new Error("No se pudo obtener el contexto del canvas."));
        }
      };
      img.onerror = () => {
        reject(new Error("Error al procesar la imagen elegida."));
      };
    });
  };

  // Handle failed delivery with upload -> commit + rollback order (Note #7)
  const handleFailedDelivery = async (stopId: string, reasonCode: string, file: File) => {
    let fileRef: any = null;
    setIsUploadingEvidence(true);
    try {
      // 1. Upload photo first
      const compressedBlob = await resizeImageToBlob(file);
      const ts = Date.now();
      const path = `shipments/by-driver/${profile?.uid}/${stopId}/evidence_${ts}.jpg`;
      fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, compressedBlob);
      const downloadUrl = await getDownloadURL(fileRef);

      // 2. Commit Firestore
      const docRef = doc(db, "shipments", stopId);
      await updateDoc(docRef, {
        status: "failed",
        failedAt: serverTimestamp(),
        failedDeliveryReason: reasonCode,
        photoEvidenceUrl: downloadUrl,
        updatedAt: serverTimestamp()
        // currentLat/currentLng are preserved (not nullified) per Pierre's suggestion
      });

      showSuccessBanner("⚠️ Entrega registrada como fallida.");
      setIsFailedModalOpen(false);
    } catch (err: any) {
      console.error("Failed delivery process error:", err);
      // 3. Rollback Storage upload if Firestore failed
      if (fileRef) {
        try {
          await deleteObject(fileRef);
          console.log("Cleanup: Deleted orphaned photo evidence after Firestore failure.");
        } catch (cleanupErr) {
          console.error("Cleanup error (orphaned photo delete):", cleanupErr);
        }
      }
      alert("Error al reportar entrega fallida: " + (err.message || String(err)));
    } finally {
      setIsUploadingEvidence(false);
    }
  };

  // Handle sequential tactical Deliver completion
  const handleDeliverStop = async (
    stopId: string,
    signatureDataUrl?: string,
    receivedByName?: string,
    signatureMetadata?: { signedAt: string; latitude: number | null; longitude: number | null }
  ) => {
    try {
      const docRef = doc(db, "shipments", stopId);
      await updateDoc(docRef, {
        status: "delivered",
        deliveredAt: serverTimestamp(),
        currentLat: null, // Clear live truck indicator
        currentLng: null,
        ...(signatureDataUrl ? { customerSignature: signatureDataUrl } : {}),
        ...(receivedByName ? { customerSignedName: receivedByName } : {}),
        ...(signatureMetadata ? { signatureMetadata } : {})
      });
      showSuccessBanner("✅ ¡Entrega confirmada con firma digital!");
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

    if (cleanScanned === cleanOrderId) {
      setPendingDeliverStopId(activeNextStop.id);
      setIsSignatureOpen(true);
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
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Cargando Hoja de Ruta…</p>
      </div>
    );
  }

  const mapViewport = (
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
                      <span className="absolute inline-flex size-7 rounded-full bg-red-400 opacity-40 animate-ping" />
                      <div className="size-8 bg-slate-950 border-2 border-white rounded-full flex items-center justify-center shadow-lg text-xs relative z-10">
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
  );

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans max-w-md mx-auto relative overflow-x-hidden pb-28">
      {/* Slim top bar — non-home tabs only (home uses RouteHero) */}
      {activeTab !== "home" && (
      <header className="bg-slate-900 text-white px-5 pb-4 pt-[calc(1rem_+_env(safe-area-inset-top))] flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-x-3">
          <div className="size-10 bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-2xl flex items-center justify-center">
            <Truck size={20} />
          </div>
          <div>
            <h1 className="text-xs font-black uppercase tracking-widest text-[#10b981]">Ruta de Transportista</h1>
            <p className="text-[10px] text-white/50 font-bold truncate max-w-[180px]">
              {profile?.name || "Transportista Asignado"}
            </p>
          </div>
        </div>
        <button type="button"
          onClick={() => logout()}
          className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full transition-colors font-bold text-white/80 active:scale-95 flex items-center"
          title="Cerrar Sesión"
        >
          <LogOut size={16} />
        </button>
      </header>
      )}

      {/* Floating alert/success notification */}
      {successMessage && (
        <div className="fixed bottom-24 left-4 right-4 z-50 bg-emerald-500 text-white p-4 rounded-2xl shadow-2xl font-black text-xs text-center uppercase tracking-wider flex items-center justify-center gap-2 animate-soft-bounce">
          <CheckCircle size={16} />
          <span>{successMessage}</span>
        </div>
      )}

      {activeTab === "home" && (
        <>
      {/* Route hero — driver identity + route progress */}
      <RouteHero
        name={profile?.name || "Transportista"}
        total={shipments.length}
        delivered={completedStopsCount}
        pending={pendingStops.length}
        onLogout={logout}
      />

      {/* FCM Push Notification Banner */}
      <section className="px-4 pb-4">
        <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white p-4 rounded-3xl border border-indigo-500/20 shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-x-3">
            <div className={`size-9 rounded-xl flex items-center justify-center border transition-colors ${fcmRegistered ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"}`}>
              <Bell size={16} className={fcmLoading ? "animate-pulse" : ""} />
            </div>
            <div>
              <p className="text-[9px] font-extrabold text-[#10b981] uppercase tracking-widest">Alertas de Hoja de Ruta</p>
              <p className="text-[11px] text-white/70 mt-0.5 font-medium leading-none">
                {fcmRegistered ? "Notificaciones Push Activas" : "Activa alertas de viaje en tiempo real"}
              </p>
            </div>
          </div>
          {!fcmRegistered ? (
            <button type="button"
              onClick={handleActivateNotifications}
              disabled={fcmLoading}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer active:scale-95 text-white"
            >
              {fcmLoading ? "Inicializando…" : "Activar"}
            </button>
          ) : (
            <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-wider rounded-xl border border-emerald-500/30">
              ✓ Listo
            </span>
          )}
        </div>
      </section>

      {/* MAP VIEWPORT CARD */}
      {mapViewport}

      {/* CORE SEQUENTIAL TRANSIT PANEL */}
      <main className="px-4 space-y-4">
        {activeNextStop ? (
          <div className="bg-white border border-rose-100 rounded-[2.5rem] overflow-hidden shadow-xl shadow-rose-100/40 ring-1 ring-rose-500/5 text-left">
            {/* PREMIUM ROSE HEADER BAND */}
            <div className="relative overflow-hidden bg-gradient-to-br from-rose-600 to-rose-500 px-5 pt-5 pb-6">
              <div className="absolute -right-6 -top-6 size-28 rounded-full bg-white/10 blur-xl" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-12 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white font-black font-mono text-lg shadow-inner shrink-0">
                    {completedStopsCount + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-black text-rose-100 uppercase tracking-[0.18em]">
                      {activeNextStop.status === "in_route" ? "En camino a" : "Siguiente parada"}
                    </p>
                    <h4 className="text-base font-black text-white truncate max-w-[160px] mt-0.5" title={activeNextStop.customerName}>
                      {activeNextStop.customerName}
                    </h4>
                  </div>
                </div>
                <span className="shrink-0 px-2.5 py-1 text-[8px] font-black uppercase tracking-wider rounded-full bg-white/15 text-white border border-white/20">
                  {activeNextStop.status === "in_route" ? "En Ruta" : "Preparado"}
                </span>
              </div>
            </div>

            {/* BODY */}
            <div className="p-5 space-y-4">
              {/* Address + quick actions */}
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="size-8 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin size={15} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Dirección</span>
                    <p className="text-[12px] font-extrabold text-slate-700 leading-snug">{activeNextStop.address}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <a
                    href={activeNextStop.customerPhone ? `tel:${activeNextStop.customerPhone}` : undefined}
                    aria-disabled={!activeNextStop.customerPhone}
                    aria-label="Llamar al cliente"
                    className={cn(
                      "flex-1 h-11 rounded-2xl flex items-center justify-center gap-2 font-black uppercase tracking-wider text-[10px] transition-all",
                      activeNextStop.customerPhone
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:scale-[0.98]"
                        : "bg-slate-100 text-slate-300 pointer-events-none"
                    )}
                  >
                    <Phone size={14} /> Llamar
                  </a>
                  <a
                    href={
                      (activeNextStop.lat && activeNextStop.lng)
                        ? `https://www.google.com/maps/dir/?api=1&destination=${activeNextStop.lat},${activeNextStop.lng}`
                        : activeNextStop.address
                          ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activeNextStop.address)}`
                          : undefined
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-disabled={!((activeNextStop.lat && activeNextStop.lng) || activeNextStop.address)}
                    aria-label="Navegar a la parada"
                    className={cn(
                      "flex-1 h-11 rounded-2xl flex items-center justify-center gap-2 font-black uppercase tracking-wider text-[10px] transition-all",
                      ((activeNextStop.lat && activeNextStop.lng) || activeNextStop.address)
                        ? "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 active:scale-[0.98]"
                        : "bg-slate-100 text-slate-300 pointer-events-none"
                    )}
                  >
                    <Navigation size={14} /> Navegar
                  </a>
                </div>
              </div>

              {/* Meta chips: Orden + Bultos */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 border border-slate-100 rounded-2xl px-3 py-2.5">
                  <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Orden</span>
                  <p className="font-mono font-bold text-[11px] text-slate-700 truncate">#{activeNextStop.orderId.substring(0, 10).toUpperCase()}</p>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl px-3 py-2.5">
                  <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Bultos</span>
                  <p className="font-bold text-[11px] text-slate-700 flex items-center gap-1"><Package size={11} /> {activeNextStop.items?.length || 0} ítems</p>
                </div>
              </div>

              {/* Product pills */}
              {activeNextStop.items?.length ? (
                <div className="space-y-1.5">
                  <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Productos del despacho</span>
                  <div className="flex flex-wrap gap-1.5 max-h-[88px] overflow-y-auto">
                    {activeNextStop.items.map((item: string, idx: number) => (
                      <span key={`${idx}-${item}`} className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-full pl-2 pr-2.5 py-1 text-[10px] font-bold text-slate-600 max-w-full">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full shrink-0" />
                        <span className="truncate">{item}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* ERROR BANNER FOR CODE VERIFICATION */}
              {scannerError && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-2xl text-[10px] font-bold font-sans">
                  ⚠️ {scannerError}
                </div>
              )}

              {/* Tactical Control Actions buttons */}
              <div className="flex flex-col gap-3 pt-1">
                {activeNextStop.status !== "in_route" ? (
                  <button type="button"
                    onClick={() => handleStartTransit(activeNextStop.id)}
                    className="w-full py-4 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 active:scale-[0.99] text-white transition-all rounded-2.5xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-lg shadow-rose-200"
                  >
                    <Navigation size={14} className="animate-pulse" />
                    Comenzar viaje hacia la parada
                  </button>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    <button type="button"
                      onClick={() => setIsScanning(true)}
                      className="w-full py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 active:scale-[0.99] text-white transition-all rounded-2.5xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-lg shadow-cyan-200"
                    >
                      <QrCode size={14} />
                      Escanear Comprobante / QR
                    </button>

                    <div className="flex items-center justify-center py-1">
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest">O de forma manual táctil:</span>
                    </div>

                    <button type="button"
                      onClick={() => {
                        setPendingDeliverStopId(activeNextStop.id);
                        setIsSignatureOpen(true);
                      }}
                      className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-white transition-all rounded-2.5xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-lg shadow-emerald-200"
                    >
                      <CheckCircle size={14} />
                      Confirmar Entrega Tactil
                    </button>

                    <button type="button"
                      onClick={() => {
                        setIsFailedModalOpen(true);
                      }}
                      className="w-full py-3.5 bg-white border border-rose-200 hover:bg-rose-50/30 text-rose-600 active:scale-[0.99] transition-all rounded-2.5xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-sm"
                    >
                      <AlertTriangle size={14} />
                      Reportar Entrega Fallida
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 text-white rounded-[2.5rem] p-8 shadow-2xl text-center space-y-6">
            <div className="size-20 bg-white/10 text-white border border-white/20 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner">
              <Award size={40} className="animate-wiggle" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-black tracking-tight font-sans uppercase">¡Ruta Completada!</h3>
              <p className="text-xs text-emerald-100/80 font-bold max-w-xs mx-auto leading-relaxed">
                Excelente labor. Ha despachado secuencialmente todas sus entregas correspondientes a la hoja de ruta de hoy. Retorne seguro a la bodega principal.
              </p>
            </div>

            <div className="py-2.5 bg-white/10 border border-white/10 rounded-2xl flex items-center justify-center text-xs font-black uppercase tracking-wider gap-2">
              🏢 Bodega Principal Destino Activo
            </div>
          </div>
        )}
        </main>
        </>
      )}

      {activeTab === "stops" && (
        <main className="px-4 pt-4 space-y-4 text-left">
          {/* STATS STRIP */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white border border-slate-100 rounded-2xl px-2 py-3 text-center shadow-sm">
              <p className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">Entregadas</p>
              <p className="text-lg font-black text-emerald-600 mt-1.5 tabular-nums">{completedStopsCount}</p>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl px-2 py-3 text-center shadow-sm">
              <p className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">Pendientes</p>
              <p className="text-lg font-black text-amber-500 mt-1.5 tabular-nums">{pendingStops.length}</p>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl px-2 py-3 text-center shadow-sm">
              <p className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">Total</p>
              <p className="text-lg font-black text-indigo-600 mt-1.5 tabular-nums">{shipments.length}</p>
            </div>
          </div>

          {/* SEGMENTED FILTER */}
          <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-2xl">
            {([["all", "Todas"], ["pending", "Pendientes"], ["delivered", "Entregadas"]] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStopsFilter(key)}
                aria-pressed={stopsFilter === key}
                className={cn(
                  "py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                  stopsFilter === key
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* SEQUENCE STOPS LIST */}
          <div className="space-y-2">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
              Secuencia de paradas · {filteredStops.length}
            </p>

            {filteredStops.length === 0 ? (
              <div className="bg-white border border-slate-100 rounded-3xl p-8 text-center shadow-sm">
                <div className="size-12 mx-auto rounded-2xl bg-slate-50 text-slate-300 flex items-center justify-center">
                  <ClipboardList size={22} />
                </div>
                <p className="text-[11px] font-bold text-slate-400 mt-3">
                  {stopsFilter === "delivered"
                    ? "Sin entregas registradas aún"
                    : stopsFilter === "pending"
                    ? "No quedan paradas pendientes"
                    : "No hay paradas asignadas"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredStops.map(({ stop, idx }) => {
                  const isCurrent = activeNextStop?.id === stop.id;
                  const isDelivered = stop.status === "delivered";

                  return (
                    <button
                      key={stop.id}
                      type="button"
                      onClick={() => setActiveTab("home")}
                      aria-label={`Parada ${idx + 1}: ${stop.customerName} — ver en Ruta`}
                      className={cn(
                        "w-full p-3 rounded-2xl flex items-center justify-between gap-2 text-xs transition-all border active:scale-[0.99] text-left",
                        isCurrent
                          ? "bg-rose-50 border-rose-100 hover:bg-rose-50/80"
                          : isDelivered
                          ? "bg-slate-50/60 border-slate-100 opacity-70 hover:opacity-100"
                          : "bg-white border-slate-100 hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-center gap-x-2.5 min-w-0">
                        <span className={cn(
                          "size-7 rounded-full flex items-center justify-center font-bold text-[10px] font-mono shrink-0",
                          isCurrent
                            ? "bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-sm shadow-rose-200"
                            : isDelivered
                            ? "bg-emerald-100 text-emerald-600"
                            : "bg-slate-100 text-slate-500"
                        )}>
                          {idx + 1}
                        </span>
                        <div className="truncate min-w-0">
                          <p className="font-extrabold text-slate-800 truncate">{stop.customerName}</p>
                          <p className="text-[9px] text-slate-400 font-semibold truncate mt-0.5">{stop.address}</p>
                        </div>
                      </div>
                      <span className={cn(
                        "text-[8px] font-black uppercase shrink-0 px-2 py-0.5 rounded-full border",
                        isCurrent
                          ? "bg-rose-100 text-rose-600 border-rose-200/40"
                          : isDelivered
                          ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                          : "bg-amber-50 text-amber-600 border-amber-100"
                      )}>
                        {isDelivered ? "Entregada ✔" : isCurrent ? "Siguiente" : "Esperando"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      )}

      {/* TAB: MAPA */}
      {activeTab === "map" && (
        <section className="pt-4 pb-4 space-y-4 text-left">
          {/* MAP + LIVE OVERLAYS (map tab only — mapViewport untouched) */}
          <div className="relative">
            {mapViewport}

            {/* GPS status chip */}
            <div className="absolute top-3 right-7 z-10">
              {activeNextStop?.status === "in_route" && activeNextStop?.currentLat ? (
                <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-sm border border-white/10 rounded-full pl-2 pr-2.5 py-1 shadow-lg">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                    <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                  </span>
                  <span className="text-[8px] font-black uppercase tracking-wider text-white">GPS Live</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-sm border border-white/10 rounded-full pl-2 pr-2.5 py-1 shadow-lg">
                  <span className="size-2 rounded-full bg-amber-400" />
                  <span className="text-[8px] font-black uppercase tracking-wider text-white/90">GPS en espera</span>
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="absolute bottom-7 left-7 z-10 flex gap-1.5">
              {([
                { c: "bg-indigo-500", t: "Bodega" },
                { c: "bg-rose-500", t: "Destino" },
                { c: "bg-slate-800", t: "Tú" },
              ]).map((l) => (
                <div key={l.t} className="flex items-center gap-1 bg-slate-900/75 backdrop-blur-sm border border-white/10 rounded-full px-2 py-1 shadow">
                  <span className={cn("size-1.5 rounded-full", l.c)} />
                  <span className="text-[7px] font-black uppercase tracking-wider text-white/90">{l.t}</span>
                </div>
              ))}
            </div>
          </div>

          {/* INDICACIONES PANEL — real destination only */}
          <div className="px-4">
            {activeNextStop ? (
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Indicaciones</p>
                  <span className={cn(
                    "text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                    activeNextStop.status === "in_route"
                      ? "bg-rose-50 text-rose-600 border-rose-100"
                      : "bg-amber-50 text-amber-600 border-amber-100"
                  )}>
                    {activeNextStop.status === "in_route" ? "En tránsito" : "Preparando"}
                  </span>
                </div>

                {/* Origin → destination */}
                <div>
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <Truck size={15} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Origen</span>
                      <p className="text-[12px] font-extrabold text-slate-700 leading-snug">Bodega Principal</p>
                    </div>
                  </div>
                  <div className="ml-4 h-5 border-l-2 border-dashed border-slate-200" />
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
                      <MapPin size={15} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Destino actual</span>
                      <p className="text-[12px] font-extrabold text-slate-800 leading-snug truncate">{activeNextStop.customerName}</p>
                      <p className="text-[10px] font-semibold text-slate-400 leading-snug truncate">{activeNextStop.address}</p>
                    </div>
                  </div>
                </div>

                {/* Navegar */}
                <a
                  href={
                    (activeNextStop.lat && activeNextStop.lng)
                      ? `https://www.google.com/maps/dir/?api=1&destination=${activeNextStop.lat},${activeNextStop.lng}`
                      : activeNextStop.address
                        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activeNextStop.address)}`
                        : undefined
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={!((activeNextStop.lat && activeNextStop.lng) || activeNextStop.address)}
                  aria-label="Navegar al destino actual"
                  className={cn(
                    "w-full h-12 rounded-2xl flex items-center justify-center gap-2 font-black uppercase tracking-wider text-[11px] transition-all",
                    ((activeNextStop.lat && activeNextStop.lng) || activeNextStop.address)
                      ? "bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white shadow-lg shadow-cyan-200 active:scale-[0.99]"
                      : "bg-slate-100 text-slate-300 pointer-events-none"
                  )}
                >
                  <Navigation size={15} /> Navegar al destino
                </a>
              </div>
            ) : (
              <div className="bg-white border border-slate-100 rounded-3xl p-8 text-center shadow-sm space-y-3">
                <div className="size-12 mx-auto rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center">
                  <CheckCircle size={22} />
                </div>
                <div>
                  <p className="text-[12px] font-black text-slate-700 uppercase tracking-wide">Sin destino activo</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1">Ruta completada. Retorna seguro a la bodega principal.</p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* TAB: PERFIL */}
      {activeTab === "profile" && (
        <section className="p-4 space-y-4">
          <div className="rounded-[1.75rem] p-6 text-white bg-gradient-to-br from-cyan-700 via-cyan-800 to-slate-900 border border-white/10 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="size-16 rounded-2xl bg-white/10 border border-white/20 ring-1 ring-white/20 flex items-center justify-center text-2xl font-black shrink-0">
                {(profile?.name || "T").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-lg font-black tracking-tight truncate">{profile?.name || "Transportista"}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="px-2 py-0.5 bg-white/10 border border-white/15 rounded-full text-[9px] font-black uppercase tracking-wider">
                    Transportista
                  </span>
                </div>
                {profile?.email && (
                  <p className="text-[11px] text-white/60 font-mono mt-1.5 truncate">{profile.email}</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-sm grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Paradas</p>
              <p className="text-lg font-black text-slate-800 font-mono mt-1">{shipments.length}</p>
            </div>
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Entregadas</p>
              <p className="text-lg font-black text-emerald-600 font-mono mt-1">{completedStopsCount}</p>
            </div>
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Pendientes</p>
              <p className="text-lg font-black text-amber-500 font-mono mt-1">{pendingStops.length}</p>
            </div>
          </div>

          {/* Notificaciones push — refleja estado real de FCM */}
          <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn(
                "size-10 rounded-2xl flex items-center justify-center border shrink-0",
                fcmRegistered ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-500 border-amber-100"
              )}>
                <Bell size={18} className={fcmLoading ? "animate-pulse" : ""} />
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-black text-slate-800">Notificaciones push</p>
                <p className="text-[10px] font-bold text-slate-400 leading-snug">
                  {fcmRegistered ? "Alertas de ruta activas" : "Activa alertas de viaje en tiempo real"}
                </p>
              </div>
            </div>
            {fcmRegistered ? (
              <span className="shrink-0 px-2.5 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 text-[9px] font-black uppercase tracking-wider rounded-full">
                ✓ Activas
              </span>
            ) : (
              <button
                type="button"
                onClick={handleActivateNotifications}
                disabled={fcmLoading}
                aria-label="Activar notificaciones push"
                className="shrink-0 px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-95"
              >
                {fcmLoading ? "..." : "Activar"}
              </button>
            )}
          </div>

          {/* Mis permisos — verídico según el rol driver (no inventado) */}
          <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Mis permisos</p>
            <div className="space-y-1">
              {([
                { icon: Truck, label: "Recibir hoja de ruta", allowed: true },
                { icon: Navigation, label: "Iniciar y completar entregas", allowed: true },
                { icon: QrCode, label: "Escanear comprobantes", allowed: true },
                { icon: MapPin, label: "Reportar incidencias de ruta", allowed: true },
                { icon: ShoppingCart, label: "Procesar ventas", allowed: false },
                { icon: Settings, label: "Configurar el sistema", allowed: false },
              ] as const).map(({ icon: PermIcon, label, allowed }) => (
                <div key={label} className="flex items-center gap-3 py-1.5">
                  <div className={cn(
                    "size-8 rounded-xl flex items-center justify-center shrink-0",
                    allowed ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                  )}>
                    <PermIcon size={14} />
                  </div>
                  <span className={cn(
                    "flex-1 text-[12px] font-bold",
                    allowed ? "text-slate-700" : "text-slate-400"
                  )}>
                    {label}
                  </span>
                  {allowed
                    ? <CheckCircle size={15} className="text-emerald-500 shrink-0" />
                    : <X size={15} className="text-slate-300 shrink-0" />}
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => logout()}
            className="w-full h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <LogOut size={14} /> Cerrar turno
          </button>
        </section>
      )}

      {/* BOTTOM NAV */}
      <nav
        aria-label="Navegación de transportista"
        className="fixed inset-x-0 bottom-0 z-40 pointer-events-none"
      >
        <div className="max-w-md mx-auto px-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))] pointer-events-auto">
          <div className="h-16 bg-white/95 backdrop-blur border border-slate-200/70 rounded-3xl shadow-[0_8px_32px_-8px_rgba(15,23,42,0.25)] px-2 flex items-center justify-around">
            <DriverNavItem icon={Truck} label="Ruta" active={activeTab === "home"} onClick={() => setActiveTab("home")} />
            <DriverNavItem icon={ClipboardList} label="Paradas" active={activeTab === "stops"} onClick={() => setActiveTab("stops")} badge={pendingStops.length} />
            <button
              type="button"
              onClick={() => setIsScanning(true)}
              aria-label="Escanear comprobante QR"
              className="size-14 -translate-y-5 shrink-0 rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-600 text-white flex items-center justify-center shadow-[0_14px_28px_-6px_rgba(8,145,178,0.55)] active:scale-95 transition-transform"
            >
              <QrCode size={24} />
            </button>
            <DriverNavItem icon={MapPin} label="Mapa" active={activeTab === "map"} onClick={() => setActiveTab("map")} />
            <DriverNavItem icon={User} label="Perfil" active={activeTab === "profile"} onClick={() => setActiveTab("profile")} />
          </div>
        </div>
      </nav>

      {/* RENDER QR BARCODE SCANNER OVERLAY IF TOGGLED */}
      <AnimatePresence>
        {isScanning && (
          <BarcodeScanner
            onScan={handleBarcodeScan}
            onClose={() => setIsScanning(false)}
          />
        )}
      </AnimatePresence>

      {/* SIGNATURE CAPTURE DIALOG */}
      <AnimatePresence>
        {isSignatureOpen && pendingDeliverStopId && (
          <SignatureModal
            isOpen={isSignatureOpen}
            onClose={() => {
              setIsSignatureOpen(false);
              setPendingDeliverStopId(null);
            }}
            defaultRecipientName={activeNextStop?.customerName || ""}
            orderId={activeNextStop?.orderId || ""}
            onSave={async (signatureDataUrl, receivedByName, metadata) => {
              setIsSignatureOpen(false);
              if (pendingDeliverStopId) {
                await handleDeliverStop(pendingDeliverStopId, signatureDataUrl, receivedByName, metadata);
              }
              setPendingDeliverStopId(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* FAILED DELIVERY DIALOG */}
      <AnimatePresence>
        {isFailedModalOpen && activeNextStop && (
          <FailedDeliveryModal
            isOpen={isFailedModalOpen}
            onClose={() => setIsFailedModalOpen(false)}
            orderId={activeNextStop.orderId}
            isSaving={isUploadingEvidence}
            onConfirm={async (reasonCode, file) => {
              await handleFailedDelivery(activeNextStop.id, reasonCode, file);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface RouteHeroProps {
  name: string;
  total: number;
  delivered: number;
  pending: number;
  onLogout: () => void;
}

function RouteHero({ name, total, delivered, pending, onLogout }: RouteHeroProps) {
  const pct = total > 0 ? Math.round((delivered / total) * 100) : 0;
  return (
    <header className="relative overflow-hidden bg-gradient-to-br from-cyan-950 via-cyan-900 to-slate-900 text-white px-5 pt-[calc(1rem_+_env(safe-area-inset-top))] pb-5 border-b border-white/5">
      {/* ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_90%_at_90%_0%,rgba(6,182,212,0.30),transparent_60%)]"
      />
      <div className="relative">
        {/* identity + logout */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-11 shrink-0 rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center shadow-[0_10px_20px_-6px_rgba(8,145,178,0.65)]">
              <Truck size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-cyan-300">En turno</p>
              <p className="text-[15px] font-black tracking-tight text-white mt-1 truncate max-w-[180px]">{name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            className="size-10 shrink-0 rounded-xl bg-rose-500/15 text-rose-300 border border-rose-500/20 flex items-center justify-center active:scale-95 transition-transform"
          >
            <LogOut size={14} />
          </button>
        </div>

        {/* route progress numbers */}
        <div className="mt-4">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/60">Progreso de ruta</p>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-[38px] leading-none font-black tracking-tighter font-mono">{delivered}</span>
            <span className="text-lg font-black text-white/45 font-mono">/ {total}</span>
            <span className="text-[11px] font-extrabold text-cyan-300 ml-1">paradas</span>
          </div>
        </div>

        {/* progress bar */}
        <div className="mt-3.5">
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-cyan-500 rounded-full shadow-[0_0_12px_rgba(34,211,238,0.7)] transition-[width] duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[9px] font-black uppercase tracking-[0.14em] text-white/50">{pct}% completado</span>
            <span className="text-[9px] font-black uppercase tracking-[0.14em] text-cyan-300">{pending} restantes</span>
          </div>
        </div>
      </div>
    </header>
  );
}

interface DriverNavItemProps {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}

function DriverNavItem({ icon: Icon, label, active, onClick, badge }: DriverNavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors active:scale-95",
        active ? "text-cyan-600" : "text-slate-400 hover:text-slate-600"
      )}
    >
      <span className="relative">
        <Icon size={20} className={active ? "stroke-[2.5]" : ""} />
        {badge ? (
          <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 bg-gradient-to-br from-rose-500 to-rose-600 text-white text-[9px] font-black leading-4 text-center rounded-full border-2 border-white">
            {badge}
          </span>
        ) : null}
      </span>
      <span className="text-[9px] font-black uppercase tracking-wider">{label}</span>
    </button>
  );
}

interface FailedDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reasonCode: string, file: File) => Promise<void>;
  orderId: string;
  isSaving: boolean;
}

function FailedDeliveryModal({ isOpen, onClose, onConfirm, orderId, isSaving }: FailedDeliveryModalProps) {
  const lang = "es";
  const [reason, setReason] = useState("");
  const [otherDetails, setOtherDetails] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const reasons = [
    { code: "address_not_found", label: "Dirección no encontrada" },
    { code: "recipient_not_available", label: "Cliente ausente / no disponible" },
    { code: "recipient_rejected", label: "Cliente rechazó el pedido" },
    { code: "force_majeure", label: "Problema de fuerza mayor (accidente/atasco vial)" },
    { code: "closed_or_no_access",  label: "Local cerrado / sin acceso al edificio" },
    { code: "wrong_address_data",   label: "Dirección incorrecta en el sistema" },
    { code: "other", label: "Otro motivo (especificar)" }
  ];

  // Enmienda #1: Retorno de foco al cerrar el modal
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement;
    }
    return () => {
      if (!isOpen && triggerRef.current) {
        triggerRef.current.focus();
      }
    };
  }, [isOpen]);

  // Tecla Escape + Focus Trap + Auto-focus al abrir
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const allFocusable = Array.from(
          modalRef.current.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
          )
        ) as HTMLElement[];
        const focusableElements = allFocusable.filter(el => {
          // Excluir elementos invisibles/ocultos (como el input de archivos oculto)
          return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
        });

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      const timer = setTimeout(() => {
        selectRef.current?.focus();
      }, 50);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        clearTimeout(timer);
      };
    }
  }, [isOpen, onClose]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleConfirmClick = () => {
    if (!reason || !photo) return;
    const finalReason = reason === "other" ? `other: ${otherDetails.trim()}` : reason;
    onConfirm(finalReason, photo);
  };

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="failed-delivery-title"
      className="fixed inset-0 z-[150] overflow-y-auto flex items-end sm:items-center justify-center p-4"
    >
      <div
        role="button"
        tabIndex={-1}
        aria-label="Cerrar modal"
        className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClose(); } }}
      />

      <motion.div
        initial={{ opacity: 0, y: 100, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 100, scale: 0.98 }}
        className="relative bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden z-10 flex flex-col"
      >
        <div className="absolute top-0 inset-x-0 h-1.5 bg-rose-500" />

        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-x-2.5">
            <div className="w-8.5 h-8.5 bg-rose-50 rounded-xl flex items-center justify-center text-rose-500 border border-rose-100/40">
              <AlertTriangle size={16} />
            </div>
            <div>
              <h3 id="failed-delivery-title" className="text-xs font-black uppercase tracking-widest text-slate-800">Reportar Falla</h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Orden #{orderId.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-left">
          {/* Reason Select */}
          <div className="space-y-1">
            <label htmlFor="failureReason" className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Motivo del Fallo:</label>
            <select
              id="failureReason"
              ref={selectRef}
              aria-required="true"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full h-11 px-3 bg-slate-50/50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 rounded-2xl transition-all"
            >
              <option value="">Seleccione un motivo...</option>
              {reasons.map((r) => (
                <option key={r.code} value={r.code}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* If "other", show input */}
          {reason === "other" && (
            <div className="space-y-1">
              <label htmlFor="otherReasonDetails" className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Especificar:</label>
              <input
                id="otherReasonDetails"
                type="text"
                value={otherDetails}
                onChange={(e) => setOtherDetails(e.target.value)}
                placeholder="Detalle el motivo aquí..."
                className="w-full h-11 px-4 bg-slate-50/50 border border-slate-200 text-xs font-bold text-slate-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all"
              />
            </div>
          )}

          {/* Camera upload */}
          <div className="space-y-1.5">
            <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Foto-Evidencia Obligatoria:</span>

            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={fileInputRef}
              onChange={handleFileChange}
              aria-label="Subir foto de evidencia"
              className="hidden"
            />

            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl min-h-[140px] relative overflow-hidden">
              {photoPreview ? (
                <div className="absolute inset-0 w-full h-full flex items-center justify-center">
                  <img src={photoPreview} alt={lang === "es" ? "Vista previa de la foto" : "Photo preview"} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                    className="absolute top-2 right-2 p-1.5 bg-slate-900/60 hover:bg-slate-900/80 text-white rounded-full transition-colors cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 text-slate-455 hover:text-rose-500 transition-colors cursor-pointer"
                >
                  <Camera size={32} className="stroke-[1.5]" />
                  <span className="text-[10px] font-black uppercase tracking-wider">Tomar Foto / Cargar Imagen</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 pt-2 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="h-12 w-full bg-slate-100 hover:bg-slate-200/60 active:scale-95 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[9px] transition-all cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={isSaving || !reason || !photo || (reason === "other" && !otherDetails.trim())}
            aria-disabled={isSaving || !reason || !photo || (reason === "other" && !otherDetails.trim())}
            className="h-12 w-full bg-rose-500 hover:bg-rose-650 active:scale-95 text-white rounded-2xl font-black uppercase tracking-widest text-[9px] transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-rose-200"
          >
            {isSaving ? "Guardando..." : "Reportar Falla"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
