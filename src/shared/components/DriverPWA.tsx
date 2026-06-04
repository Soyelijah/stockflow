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
  Camera, X, AlertTriangle
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

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans max-w-md mx-auto relative overflow-x-hidden pb-12">
      {/* Mobile Top App Bar */}
      <header className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-x-3">
          <div className="size-10 bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-2xl flex items-center justify-center">
            <Truck size={20} />
          </div>
          <div>
            <h1 className="text-xs font-black uppercase tracking-widest text-[#10b981]">Ruta de Transportista</h1>
            <p className="text-[10px] text-white/50 font-bold truncate max-w-[180px]">
              {profile?.userName || "Transportista Asignado"}
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

      {/* Floating alert/success notification */}
      {successMessage && (
        <div className="fixed top-20 left-4 right-4 z-50 bg-emerald-500 text-white p-4 rounded-2xl shadow-2xl font-black text-xs text-center uppercase tracking-wider flex items-center justify-center gap-2 animate-soft-bounce">
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

      {/* CORE SEQUENTIAL TRANSIT PANEL */}
      <main className="px-4 space-y-4">
        {activeNextStop ? (
          <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-xl space-y-5 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-x-2.5">
                <div className="size-9 bg-rose-50 rounded-xl flex items-center justify-center text-rose-500 font-bold font-mono text-sm shadow-sm">
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
                    <div key={`${idx}-${item}`} className="flex items-center gap-x-1.5 text-[10.5px] font-bold text-slate-600">
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
                <button type="button"
                  onClick={() => handleStartTransit(activeNextStop.id)}
                  className="w-full py-4 bg-red-500 hover:bg-red-600 active:scale-[0.99] text-white transition-all rounded-2.5xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-lg shadow-red-200"
                >
                  <Navigation size={14} className="animate-pulse" />
                  Comenzar viaje hacia la parada
                </button>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <button type="button"
                    onClick={() => setIsScanning(true)}
                    className="w-full py-4 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white transition-all rounded-2.5xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-xl"
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
        ) : (
          <div className="bg-gradient-to-br from-indigo-900 to-slate-950 text-white rounded-[2.5rem] p-8 shadow-2xl text-center space-y-6">
            <div className="size-20 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner">
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
                  <div className="flex items-center gap-x-2.5 min-w-0">
                    <span className={cn(
                      "size-6 rounded-full flex items-center justify-center font-bold text-[10px] font-mono shrink-0",
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
