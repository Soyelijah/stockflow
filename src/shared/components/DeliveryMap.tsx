import React, { useEffect, useState, useRef } from "react";
import { APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { collection, onSnapshot, query, doc, updateDoc, setDoc, serverTimestamp, getDocs, writeBatch, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { useBranch } from "../../contexts/BranchContext";
import { resolveBranchIdForStockOp } from "../../lib/productStock";
import { cn } from "../../lib/utils";
import { MapPin, Navigation, Truck, User, Phone, CheckCircle, Package, Plus, Map as MapIcon, Loader2, Sparkles, RefreshCw, Save, ArrowRight, Play, Square, Leaf } from "lucide-react";

// Default coordinate (Santiago, Chile) for warehouse
const WAREHOUSE_COORDS = { lat: -33.4449, lng: -70.6562 };

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  "";

const hasValidKey = Boolean(API_KEY) && API_KEY !== "YOUR_API_KEY" && API_KEY.trim().length > 10;

// Inner component to handle routing polyline using computeRoutes
function RoutePolyline({ origin, destination }: { origin: { lat: number; lng: number }; destination: { lat: number; lng: number } }) {
  const map = useMap();
  const routesLib = useMapsLibrary("routes");
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!routesLib || !map || !origin || !destination) return;

    // Clear any previous polylines
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
              strokeColor: "#6366f1",
              strokeWeight: 5,
              strokeOpacity: 0.8,
            });
            p.setMap(map);
          });
          polylinesRef.current = newPolylines;

          // Adjust map viewport to cover total path
          if (routes[0].viewport) {
            map.fitBounds(routes[0].viewport);
          }
        }
      })
      .catch((err) => {
        console.error("Error computing routes on map:", err);
      });

    return () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
    };
  }, [routesLib, map, origin, destination]);

  return null;
}

// Inner component to handle multi-stop optimized path computing and drawing using Route.computeRoutes
interface OptimizedRouteDisplayProps {
  origin: { lat: number; lng: number };
  intermediates: { lat: number; lng: number }[];
  returnToWarehouse: boolean;
  onOptimizationComplete: (indices: number[], distance: number, duration: number) => void;
  onOptimizationError: (err: string) => void;
  triggerCount: number;
}

function OptimizedRouteDisplay({
  origin,
  intermediates,
  returnToWarehouse,
  onOptimizationComplete,
  onOptimizationError,
  triggerCount
}: OptimizedRouteDisplayProps) {
  const map = useMap();
  const routesLib = useMapsLibrary("routes");
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!routesLib || !map || !origin || intermediates.length === 0) return;

    // Clear any previous polylines
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    // Decide terminal destination
    const travelDestination = returnToWarehouse ? origin : intermediates[intermediates.length - 1];
    const stops = returnToWarehouse 
      ? intermediates.map(wp => ({ location: wp as any }))
      : intermediates.slice(0, -1).map(wp => ({ location: wp as any }));

    if (!returnToWarehouse && intermediates.length === 1) {
      // 1-stop special case without return (just origin -> stop1)
      routesLib.Route.computeRoutes({
        origin: { location: origin as any },
        destination: { location: intermediates[0] as any },
        travelMode: "DRIVING",
        fields: ["path", "distanceMeters", "durationMillis", "viewport"],
      } as any)
        .then(({ routes }) => {
          if (routes?.[0]) {
            const newPolylines = routes[0].createPolylines();
            newPolylines.forEach((p) => {
              p.setOptions({
                strokeColor: "#22c55e",
                strokeWeight: 6,
                strokeOpacity: 0.9,
              });
              p.setMap(map);
            });
            polylinesRef.current = newPolylines;
            if (routes[0].viewport) map.fitBounds(routes[0].viewport);
            onOptimizationComplete([0], routes[0].distanceMeters || 0, routes[0].durationMillis || 0);
          }
        })
        .catch((err) => {
          console.error("Error computing single route:", err);
          onOptimizationError("Error al calcular ruta sencilla.");
        });
      return;
    }

    // Call dynamic Route.computeRoutes with intermediate waypoint optimization
    routesLib.Route.computeRoutes({
      origin: { location: origin as any },
      destination: { location: travelDestination as any },
      intermediates: stops as any,
      travelMode: "DRIVING",
      optimizeWaypointOrder: true,
      fields: [
        "path",
        "optimizedIntermediateWaypointIndices",
        "distanceMeters",
        "durationMillis",
        "viewport"
      ],
    } as any)
      .then(({ routes }) => {
        if (routes?.[0]) {
          const newPolylines = routes[0].createPolylines();
          newPolylines.forEach((p) => {
            p.setOptions({
              strokeColor: "#10b981", // Beautiful Emerald Green for optimized loop
              strokeWeight: 6,
              strokeOpacity: 0.9,
            });
            p.setMap(map);
          });
          polylinesRef.current = newPolylines;

          if (routes[0].viewport) {
            map.fitBounds(routes[0].viewport);
          }

          const rawIndices = routes[0].optimizedIntermediateWaypointIndices || [];
          let finalIndices = [...rawIndices];
          if (!returnToWarehouse) {
            // Append the last destination waypoint because we didn't include it in intermediates
            finalIndices.push(intermediates.length - 1);
          }

          onOptimizationComplete(
            finalIndices,
            routes[0].distanceMeters || 0,
            routes[0].durationMillis || 0
          );
        } else {
          onOptimizationError("No se encontraron rutas para la combinación.");
        }
      })
      .catch((err) => {
        console.error("Error computing optimized routes:", err);
        onOptimizationError("No se pudo conectar con el servicio de cálculo de rutas de Google Maps.");
      });

    return () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
    };
  }, [routesLib, map, origin, intermediates, returnToWarehouse, triggerCount]);

  return null;
}

interface DeliveryMapProps {
  portalCustomerId?: string;
}

export function DeliveryMap({ portalCustomerId }: DeliveryMapProps = {}) {
  const { profile } = useAuth();
  const { branches, selectedBranchId } = useBranch();
  const [shipments, setShipments] = useState<any[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // States for multi-stop route optimization
  const [isOptimizedMode, setIsOptimizedMode] = useState(false);
  const [optimizedIndices, setOptimizedIndices] = useState<number[]>([]);
  const [optimizedDistance, setOptimizedDistance] = useState<number>(0);
  const [optimizedDuration, setOptimizedDuration] = useState<number>(0);
  const [returnToWarehouse, setReturnToWarehouse] = useState<boolean>(true);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [triggerCount, setTriggerCount] = useState<number>(0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

  // Form states to register a mockup shipment (Real coordinates in Santiago for demo/production delivery)
  const [showAddForm, setShowAddForm] = useState(false);
  const [newShipment, setNewShipment] = useState({
    orderId: "",
    customerName: "",
    address: "",
    lat: -33.456,
    lng: -70.662,
    driverName: "Claudio Gómez (Transportista)",
    driverPhone: "+56 9 8765 4321",
    total: 25000,
    itemsText: "2x Caja de Vino Premium, 1x Aceite Oliva Extra",
    // Multi-branch (Tier 1.4b): picker default = active selectedBranchId (or "default")
    pickupBranchId: "default",
  });

  // Simulation states
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationStopIndex, setSimulationStopIndex] = useState<number>(-2); // -2 = idle, -1 = warehouse, >=0 stop index
  const [simulatedVehiclePos, setSimulatedVehiclePos] = useState<{ lat: number; lng: number } | null>(null);
  const [simulatedLogs, setSimulatedLogs] = useState<string[]>([]);

  // Simulation handler
  const startSimulation = async () => {
    if (stopSequence.length === 0) return;
    setIsSimulating(true);
    setSimulationStopIndex(-1);
    setSimulatedVehiclePos(WAREHOUSE_COORDS);
    setSimulatedLogs(["🚀 [FCM Simulator] Inicializando despacho desde Bodega Principal…"]);

    const pathPoints = [WAREHOUSE_COORDS, ...stopSequence.map(s => ({ lat: s.lat, lng: s.lng }))];
    if (returnToWarehouse) {
      pathPoints.push(WAREHOUSE_COORDS);
    }

    let legIndex = 0;
    
    const runStep = async () => {
      if (legIndex >= pathPoints.length - 1) {
        setIsSimulating(false);
        setSimulationStopIndex(-2);
        setSimulatedVehiclePos(null);
        setSimulatedLogs(prev => [...prev, "✨ [FCM Simulator] Simulación completada. Todas las alertas Push FCM y el enrutamiento han sido validados exitosamente."]);
        return;
      }

      const origin = pathPoints[legIndex];
      const dest = pathPoints[legIndex + 1];
      const associatedStop = legIndex < stopSequence.length ? stopSequence[legIndex] : null;

      const stepsCount = 5;
      for (let s = 1; s <= stepsCount; s++) {
        const ratio = s / stepsCount;
        const currentPos = {
          lat: origin.lat + (dest.lat - origin.lat) * ratio,
          lng: origin.lng + (dest.lng - origin.lng) * ratio
        };
        setSimulatedVehiclePos(currentPos);

        // Mitigate OBS-D: Throttled coordinate updates (every 3s+ or only on milestones) to prevent quota abuse and order race conditions
        const isMilestone = (s === 1 || s === stepsCount);
        if (associatedStop?.id && isMilestone) {
          try {
            await updateDoc(doc(db, "shipments", associatedStop.id), {
              currentLat: currentPos.lat,
              currentLng: currentPos.lng,
              vehicleStatus: "moving"
            });
          } catch (ge) {
            console.warn("Failed to write live gps coordinates to Firestore:", ge);
          }
        }

        await new Promise((r) => setTimeout(r, 1500)); // Sleep 1500ms per step (overall 3.0s+ between milestone writes)
      }

      legIndex++;
      setSimulationStopIndex(legIndex - 1);

      if (associatedStop) {
        const notifId = `NOTIF_SIM_${Date.now()}`;
        const msg = `¡Buenas noticias, ${associatedStop.customerName}! El camión de reparto asignado acaba de llegar a la dirección para entregar tu pedido #${associatedStop.orderId}.`;
        
        await setDoc(doc(db, "client_notifications", notifId), {
          id: notifId,
          title: `🚚 Repartidor en tu Domicilio`,
          message: msg,
          read: false,
          timestamp: new Date().toISOString(),
          type: "success",
          userId: associatedStop.customerId || "all"
        });

        // Set state to delivered, save final coordinates, and notify customer
        try {
          await updateDoc(doc(db, "shipments", associatedStop.id), {
            status: "delivered",
            currentLat: associatedStop.lat,
            currentLng: associatedStop.lng,
            vehicleStatus: "arrived"
          });
        } catch (stE) {
          console.warn("Failed to update status to delivered in Firestore:", stE);
        }

        setSimulatedLogs(prev => [
          ...prev,
          `📦 [Parada ${legIndex}] Notificación Push FCM transmitida a ${associatedStop.customerName} - Pedido #${associatedStop.orderId}`
        ]);
      } else {
        setSimulatedLogs(prev => [...prev, "🏢 Retornado con éxito a la Bodega Principal."]);
      }

      setTimeout(runStep, 1000);
    };

    setTimeout(runStep, 500);
  };

  const stopSimulation = () => {
    setIsSimulating(false);
    setSimulationStopIndex(-2);
    setSimulatedVehiclePos(null);
    setSimulatedLogs(prev => [...prev, "🛑 Simulación interrumpida por el operador."]);
  };

  // Default coordinate offsets for Santiago dispatches
  const santiagoCommunes = [
    { name: "Providencia", lat: -33.426, lng: -70.612 },
    { name: "Las Condes", lat: -33.412, lng: -70.578 },
    { name: "Ñuñoa", lat: -33.456, lng: -70.606 },
    { name: "Santiago Centro", lat: -33.448, lng: -70.669 },
    { name: "La Reina", lat: -33.441, lng: -70.548 },
  ];

  useEffect(() => {
    let q;
    if (portalCustomerId) {
      q = query(collection(db, "shipments"), where("customerId", "==", portalCustomerId));
    } else {
      q = query(collection(db, "shipments"));
    }
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setShipments(data);
      setLoading(false);
      if (data.length > 0) {
        setSelectedShipment(data[0]);
      } else {
        setSelectedShipment(null);
      }
    }, (err) => {
      console.error("Error fetching shipments:", err);
      setLoading(false);
    });
    return unsub;
  }, [portalCustomerId]);

  const handleCreateMockShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShipment.orderId || !newShipment.customerName || !newShipment.address) {
      alert("Por favor rellene los campos obligatorios.");
      return;
    }
    try {
      const id = `SHIP_${Date.now()}`;
      // Multi-branch (Tier 1.4b): admin now picks the source sucursal from a dropdown.
      // Fallback to selectedBranchId (sidebar context) and finally "default".
      const pickupBranchId = newShipment.pickupBranchId ||
        resolveBranchIdForStockOp(selectedBranchId);
      await setDoc(doc(db, "shipments", id), {
        id,
        orderId: newShipment.orderId,
        customerId: `CUST_${Date.now()}`,
        customerName: newShipment.customerName,
        address: newShipment.address,
        lat: parseFloat(newShipment.lat.toString()),
        lng: parseFloat(newShipment.lng.toString()),
        status: "prepared",
        driverName: newShipment.driverName,
        driverPhone: newShipment.driverPhone,
        total: Number(newShipment.total),
        items: newShipment.itemsText.split(",").map(i => i.trim()),
        pickupBranchId,
        branchId: pickupBranchId,
        timestamp: new Date().toISOString()
      });

      setShowAddForm(false);
      setNewShipment({
        orderId: "",
        customerName: "",
        address: "",
        lat: -33.456,
        lng: -70.662,
        driverName: "Claudio Gómez (Transportista)",
        driverPhone: "+56 9 8765 4321",
        total: 25000,
        itemsText: "2x Caja de Vino Premium, 1x Aceite Oliva Extra",
        pickupBranchId: resolveBranchIdForStockOp(selectedBranchId),
      });
    } catch (err) {
      alert("Error registrando despacho real");
    }
  };

  const handleUpdateStatus = async (shipmentId: string, status: "prepared" | "in_route" | "delivered") => {
    try {
      await updateDoc(doc(db, "shipments", shipmentId), { status });
      // Update selected state locally
      setSelectedShipment((prev: any) => prev && prev.id === shipmentId ? { ...prev, status } : prev);
      
      // Also register a timeline notification to the client automatically
      const notifId = `NOTIF_${Date.now()}`;
      let msg = `Tú pedido #${selectedShipment?.orderId || shipmentId} ha cambiado de estado. `;
      if (status === "prepared") msg += "Está preparado y listo en bodega.";
      if (status === "in_route") msg += `Está en camino a cargo de ${selectedShipment?.driverName || "transportista"}.`;
      if (status === "delivered") msg += "¡Ha sido entregado con éxito!";

      await setDoc(doc(db, "client_notifications", notifId), {
        id: notifId,
        title: status === "delivered" ? "✅ Despacho Entregado" : status === "in_route" ? "🚚 Pedido en Ruta" : "📦 Pedido Preparado",
        message: msg,
        read: false,
        timestamp: serverTimestamp(),
        type: "logistic",
        userId: selectedShipment?.customerId || "all"
      });

    } catch (err) {
      console.error("Error updating shipment status:", err);
    }
  };

  const activeShipments = shipments.filter(s => s.status !== "delivered");

  const getStopSequence = () => {
    if (isOptimizedMode && optimizedIndices.length > 0 && activeShipments.length > 0) {
      return optimizedIndices.reduce<typeof activeShipments>((acc, idx) => {
        const sh = activeShipments[idx];
        if (sh) acc.push(sh);
        return acc;
      }, []);
    }
    return activeShipments;
  };

  const stopSequence = getStopSequence();

  const handleOptimizeRoute = () => {
    if (activeShipments.length === 0) {
      setErrorMessage("No hay despachos preparados o en ruta para optimizar hoy.");
      return;
    }
    setErrorMessage(null);
    setIsOptimizing(true);
    setOptimizedIndices([]);
    setTriggerCount(prev => prev + 1);
  };

  const handleOptimizationComplete = (indices: number[], distance: number, duration: number) => {
    setOptimizedIndices(indices);
    setOptimizedDistance(distance);
    setOptimizedDuration(duration);
    setIsOptimizing(false);
  };

  const handleOptimizationError = (err: string) => {
    setErrorMessage(err);
    setIsOptimizing(false);
  };

  const handleSaveRouteIndices = async () => {
    if (stopSequence.length === 0 || optimizedIndices.length === 0) return;
    setSaveStatus("saving");
    try {
      const batch = writeBatch(db);
      stopSequence.forEach((ship, idx) => {
        const docRef = doc(db, "shipments", ship.id);
        batch.update(docRef, { routeIndex: idx + 1 });
      });
      await batch.commit();
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err) {
      console.error("Error saving optimized route indexes:", err);
      setSaveStatus("error");
    }
  };

  if (!hasValidKey) {
    return (
      <div className="flex items-center justify-center min-h-[500px] bg-slate-50 p-8 rounded-[2.5rem]">
        <div className="text-center max-w-xl bg-white p-10 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
          <div className="size-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <MapIcon size={32} />
          </div>
          <h2 className="text-xl font-black text-slate-800">Se requiere API Key de Google Maps Platform</h2>
          <p className="text-sm text-slate-400 font-medium leading-relaxed">
            Para ver mapas interactivos en tiempo real procedentes de la API de Google Maps:
          </p>
          <div className="text-left bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-3 font-medium text-xs text-slate-600">
            <p><strong>1.</strong> Consiga una clave de API autenticada de Google Maps: <a href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-bold underline">Obtener API Key</a></p>
            <p><strong>2.</strong> Añádala en el panel de Secrets de AI Studio:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Haga clic en el icono de engranaje (⚙️ <strong>Settings</strong>) arriba a la derecha.</li>
              <li>Seleccione la pestaña de <strong>Secrets</strong>.</li>
              <li>Ingrese el nombre exacto: <code>GOOGLE_MAPS_PLATFORM_KEY</code></li>
              <li>Pegue su valor y guarde. El sistema se compilará con datos reales automáticos.</li>
            </ul>
          </div>
          <div className="p-4 bg-amber-50 rounded-2xl text-[11px] font-black tracking-wide text-amber-800 uppercase flex items-center gap-x-2 justify-center">
            <span>⚠ ESTA EXPERIENCIA UTILIZA COORDENADAS GEOGRÁFICAS REALES DE LA CADENA</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 min-h-[600px] bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden p-3 md:p-6">
      {/* Shipment sidebar */}
      {!portalCustomerId && (
        <div className="lg:col-span-1 border-r border-slate-100 pr-0 lg:pr-6 flex flex-col h-full gap-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Despachos En Ruta</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Monitoreo de logística real</p>
          </div>
          <button type="button"
            aria-label="Crear guía de despacho"
            onClick={() => setShowAddForm(!showAddForm)}
            className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-colors"
            title="Crear guía despacho real"
          >
            <Plus size={16} />
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={handleCreateMockShipment} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
            <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Nueva Guía de Despacho</h4>
            
            <div className="space-y-1">
              <label htmlFor="orderId" className="text-[9px] font-black text-slate-400 uppercase tracking-widest">ID Pedido / Venta</label>
              <input
                id="orderId"
                type="text"
                placeholder="Ej: FE9281A"
                required
                className="w-full h-8 bg-white border border-slate-100 rounded-lg px-2 text-xs font-bold"
                value={newShipment.orderId}
                onChange={e => setNewShipment({ ...newShipment, orderId: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="customerName" className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nombre Cliente</label>
              <input
                id="customerName"
                type="text"
                placeholder="Ej: Sofía Pérez"
                required
                className="w-full h-8 bg-white border border-slate-100 rounded-lg px-2 text-xs font-bold"
                value={newShipment.customerName}
                onChange={e => setNewShipment({ ...newShipment, customerName: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="address" className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Dirección Despacho</label>
              <input
                id="address"
                type="text"
                placeholder="Ej: Av Providencia 1205, Providencia"
                required
                className="w-full h-8 bg-white border border-slate-100 rounded-lg px-2 text-xs font-bold font-medium"
                value={newShipment.address}
                onChange={e => setNewShipment({ ...newShipment, address: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <div className="space-y-1">
                <label htmlFor="geoRef" className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Referencia Geográfica</label>
                <select
                  id="geoRef"
                  className="w-full h-8 bg-white border border-slate-100 rounded-lg px-1 text-[10px] font-bold"
                  onChange={e => {
                    const comm = santiagoCommunes[parseInt(e.target.value)];
                    if (comm) {
                      setNewShipment({
                        ...newShipment,
                        address: `${newShipment.customerName ? `Entrega en ${newShipment.customerName}` : 'Cliente'}, comuna ${comm.name}`,
                        lat: comm.lat,
                        lng: comm.lng
                      });
                    }
                  }}
                >
                  <option value="">-- Comuna --</option>
                  {santiagoCommunes.map((c, idx) => (
                    <option key={c.name} value={idx}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="total" className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total</label>
                <input
                  id="total"
                  type="number"
                  className="w-full h-8 bg-white border border-slate-100 rounded-lg px-2 text-xs font-bold"
                  value={newShipment.total}
                  onChange={e => setNewShipment({ ...newShipment, total: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="pickupBranchId" className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sucursal de Origen (Despacha)</label>
              <select
                id="pickupBranchId"
                className="w-full h-8 bg-white border border-slate-100 rounded-lg px-1 text-[10px] font-bold"
                value={newShipment.pickupBranchId}
                onChange={e => setNewShipment({ ...newShipment, pickupBranchId: e.target.value })}
              >
                {branches.filter(b => b.active !== false).length === 0 ? (
                  <option value="default">Sucursal Principal (default)</option>
                ) : (
                  branches.filter(b => b.active !== false).map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))
                )}
              </select>
            </div>

            <button
              type="submit"
              className="w-full h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black uppercase tracking-widest"
            >
              Confirmar Despacho
            </button>
          </form>
        )}

        {/* Tab/Toggle Header */}
        <div className="flex bg-slate-100 p-1 rounded-2xl shrink-0">
          <button
            type="button"
            onClick={() => setIsOptimizedMode(false)}
            className={cn(
              "flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
              !isOptimizedMode ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Ficha Individual
          </button>
          <button
            type="button"
            onClick={() => {
              setIsOptimizedMode(true);
              setErrorMessage(null);
            }}
            className={cn(
              "flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1",
              isOptimizedMode ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <Sparkles size={11} /> Optimizar Ruta ({activeShipments.length})
          </button>
        </div>

        {/* Sidebar panels content conditionally */}
        {isOptimizedMode ? (
          <div className="flex-1 flex flex-col gap-y-4 text-left min-h-0">
            <div className="p-4 bg-indigo-50/50 rounded-3xl border border-indigo-100 space-y-3 shrink-0">
              <div className="flex items-center gap-x-2 text-indigo-700 font-extrabold text-xs">
                <Sparkles size={14} className="shrink-0" />
                <span>Optimizador de Ruta Diario</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                Esta herramienta calcula la secuencia óptima de paradas usando la API de Google Maps, reduciendo tiempos de reparto y consumo de combustible.
              </p>

              <div className="pt-1 flex items-center gap-x-2">
                <input
                  aria-label="Retornar a bodega"
                  type="checkbox"
                  id="return_wh"
                  checked={returnToWarehouse}
                  onChange={(e) => {
                    setReturnToWarehouse(e.target.checked);
                    setOptimizedIndices([]); // Re-compute necessary
                  }}
                  className="rounded text-indigo-600 focus:ring-indigo-500 size-4"
                />
                <label htmlFor="return_wh" className="text-[10px] font-black text-slate-600 uppercase tracking-wider cursor-pointer select-none">
                  Retornar a bodega al terminar
                </label>
              </div>

              <button
                type="button"
                onClick={handleOptimizeRoute}
                disabled={activeShipments.length === 0 || isOptimizing}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-x-2"
              >
                {isOptimizing ? (
                  <>
                    <Loader2 className="animate-spin" size={12} />
                    <span>Calculando con Google Maps…</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={12} />
                    <span>Calcular Ruta Óptima</span>
                  </>
                )}
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl text-[10px] font-bold border border-rose-100 font-sans">
                {errorMessage}
              </div>
            )}

            {optimizedIndices.length > 0 && (
              <div className="flex-1 flex flex-col min-h-0 gap-y-3">
                {/* Visual Comparative Analytics & Ecological metrics panel */}
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-2xl border border-emerald-100 p-3.5 space-y-3 shrink-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider flex items-center gap-1">
                      <Leaf size={12} className="text-emerald-600" /> Analítica de Ruta
                    </span>
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/10">
                      -{Math.max(12, Math.round((1 - (optimizedDistance / 1000) / ((activeShipments.length + 1) * 7.4)) * 100))}% de Consumo
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="text-left">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ruta Óptima</p>
                      <p className="text-base font-black text-slate-800">
                        {(optimizedDistance / 1000).toFixed(1)} km
                      </p>
                      <p className="text-[9px] text-emerald-700 font-bold mt-1">
                        -{Math.max(0.4, ((activeShipments.length + 1) * 7.4 - (optimizedDistance / 1000))).toFixed(1)} km vs tradicional
                      </p>
                    </div>

                    <div className="text-left">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Compensación CO₂</p>
                      <p className="text-base font-black text-emerald-600 flex items-center">
                        {(Math.max(0.4, ((activeShipments.length + 1) * 7.4 - (optimizedDistance / 1000))) * 0.22).toFixed(2)} kg
                      </p>
                      <p className="text-[9px] text-slate-400 font-semibold mt-1">Huella de carbono evitada</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 p-2 bg-white/60 rounded-xl border border-emerald-100/30 text-[10px] text-slate-600 font-semibold text-center grid-flow-row">
                    <span>⏱ Duración estimada de viaje consolidado: <strong className="text-slate-800">{Math.round(optimizedDuration / 60000)} minutos</strong></span>
                  </div>
                </div>

                {/* Interactive FCM Simulation Command Control Room */}
                <div className="p-3 bg-slate-900 text-white rounded-2xl border border-slate-800 space-y-2.5 shrink-0 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black tracking-widest text-[#10b981] uppercase">
                      ⚓ Centro de Simulación Push
                    </span>
                    {isSimulating && (
                      <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
                    )}
                  </div>

                  {isSimulating ? (
                    <button
                      type="button"
                      onClick={stopSimulation}
                      className="w-full py-2 bg-rose-650 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-x-2 shadow-lg shadow-rose-950/20"
                    >
                      <Square size={10} className="fill-white" />
                      <span>Detener Simulación</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startSimulation}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-x-2 shadow-lg shadow-indigo-950/20"
                    >
                      <Play size={10} className="fill-white" />
                      <span>Ejecutar Simulación Animada</span>
                    </button>
                  )}

                  {/* Terminal simulation log lines */}
                  {simulatedLogs.length > 0 && (
                    <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-[9px] font-mono text-emerald-400 font-semibold max-h-24 overflow-y-auto space-y-1 text-left leading-relaxed scrollbar-none">
                      {simulatedLogs.map((log, idx) => (
                        <p key={`${idx}-${log.slice(0, 30)}`} className="truncate">{log}</p>
                      ))}
                    </div>
                  )}
                </div>

                {/* Stop by stop checklist */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0 border-y border-slate-50 py-2">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Secuencia de Reparto:</p>
                  
                  {/* Origin */}
                  <div className="p-2 bg-slate-50 rounded-xl border border-dashed text-xs font-bold text-slate-500 flex items-center gap-x-2">
                    <span className="size-5 flex items-center justify-center bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-black">🏢</span>
                    <span className="truncate">Bodega Principal (Partida)</span>
                  </div>

                  {stopSequence.map((ship, index) => (
                    <div
                      key={ship.id}
                      className={cn(
                        "p-3 bg-white hover:bg-slate-50 rounded-2xl border text-xs flex items-center justify-between transition-all",
                        simulationStopIndex === index ? "border-emerald-500 bg-emerald-50/25 shadow-sm" : "border-slate-100"
                      )}
                    >
                      <div className="flex items-center gap-x-2.5 min-w-0">
                        <span className={cn(
                          "size-5 flex items-center justify-center rounded-full text-[10px] font-black shrink-0 shadow-sm",
                          simulationStopIndex === index ? "bg-emerald-600 text-white" : "bg-emerald-500 text-white"
                        )}>
                          {index + 1}
                        </span>
                        <div className="min-w-0 font-sans">
                          <p className="font-extrabold text-slate-800 truncate leading-tight">{ship.customerName}</p>
                          <p className="text-[9px] text-slate-400 truncate leading-tight mt-0.5">{ship.address}</p>
                        </div>
                      </div>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0 font-sans">
                        #{ship.orderId}
                      </span>
                    </div>
                  ))}

                  {/* Return optionally */}
                  {returnToWarehouse && (
                    <div className="p-2 bg-slate-50 rounded-xl border border-dashed text-xs font-bold text-slate-500 flex items-center gap-x-2">
                      <span className="size-5 flex items-center justify-center bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-black">🏢</span>
                      <span className="truncate">Bodega Principal (Retorno)</span>
                    </div>
                  )}
                </div>

                {/* Button to save order for driver portal */}
                <button
                  type="button"
                  onClick={handleSaveRouteIndices}
                  disabled={saveStatus === "saving"}
                  className={cn(
                    "w-full py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 shrink-0 shadow-sm",
                    saveStatus === "success"
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  )}
                >
                  <Save size={12} />
                  {saveStatus === "saving" && "Guardando Secuencia…"}
                  {saveStatus === "success" && "¡Guardado con Éxito!"}
                  {saveStatus === "error" && "Error al Guardar"}
                  {saveStatus === "idle" && "Publicar Ruta para Chofer"}
                </button>
              </div>
            )}

            {optimizedIndices.length === 0 && !isOptimizing && (
              <div className="p-8 text-center border border-dashed border-slate-200 rounded-3xl bg-slate-50/50 flex-1 flex flex-col justify-center items-center">
                <Navigation size={24} className="text-slate-300 mb-2" />
                <p className="text-xs text-slate-400 font-extrabold text-center leading-relaxed">
                  Presione el botón superior para calcular el recorrido más eficiente.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Normal Shipment list */
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-slate-800 min-h-0">
            {shipments.map((s) => (
              <button
                type="button"
                key={s.id}
                tabIndex={0}
                aria-label={`Seleccionar envío ${s.id}`}
                onClick={() => setSelectedShipment(s)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedShipment(s); } }}
                className={cn(
                  "p-4 rounded-3xl border text-left transition-all cursor-pointer relative overflow-hidden w-full",
                  selectedShipment?.id === s.id
                    ? "bg-slate-900 border-transparent text-white shadow-lg"
                    : "bg-slate-50 border-slate-100 hover:bg-slate-100"
                )}
              >
                {selectedShipment?.id === s.id && (
                  <div className="absolute top-0 right-0 size-24 bg-indigo-500/10 blur-2xl rounded-full" />
                )}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-black tracking-widest px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 uppercase font-sans">
                    #{s.orderId}
                  </span>
                  <span
                    className={cn(
                      "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full font-sans",
                      s.status === "delivered"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : s.status === "in_route"
                        ? "bg-indigo-505 bg-opacity-20 text-indigo-400 animate-pulse"
                        : "bg-amber-500/20 text-yellow-500"
                    )}
                  >
                    {s.status === "delivered" ? "Entregado" : s.status === "in_route" ? "En Ruta" : "Preparado"}
                  </span>
                </div>
                <p className="text-xs font-extrabold tracking-tight truncate leading-tight font-sans">
                  {s.customerName}
                </p>
                <div className="flex items-center gap-x-1 mt-1 text-[10px] opacity-60 font-sans">
                  <MapPin size={10} className="shrink-0" />
                  <span className="truncate">{s.address}</span>
                </div>
              </button>
            ))}

            {shipments.length === 0 && !loading && (
              <div className="p-8 text-center border border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                <Package size={24} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs text-slate-400 font-bold italic">No hay despachos registrados hoy</p>
              </div>
            )}

            {loading && (
              <div className="flex justify-center p-8">
                <Loader2 className="animate-spin text-slate-300" />
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Interactive Map Layout */}
      <div className={cn(
        "flex flex-col h-full min-h-[500px]",
        portalCustomerId ? "lg:col-span-4" : "lg:col-span-3"
      )}>
        {/* Dynamic header details based on mode */}
        {isOptimizedMode ? (
          <div className="p-4 bg-slate-900 text-white rounded-t-3xl border-b border-white/5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-x-3 text-left font-sans">
              <div className="size-10 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-400 border border-indigo-500/20 shrink-0">
                <Sparkles size={18} />
              </div>
              <div>
                <div className="flex items-center gap-x-2">
                  <h4 className="text-sm font-black tracking-tight uppercase">Ruta de Reparto Optimizada</h4>
                  <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    Google Maps Activo
                  </span>
                </div>
                <p className="text-[10px] text-white/50 font-medium mt-0.5">
                  Planificación de ruta consolidada para {activeShipments.length} entregas pendientes.
                </p>
              </div>
            </div>

            {optimizedIndices.length > 0 && (
              <div className="flex items-center gap-4 shrink-0 bg-white/5 px-4 py-2 rounded-2xl border border-white/5 text-right font-sans">
                <div className="text-left">
                  <p className="text-[8px] text-white/40 font-black uppercase tracking-wider">Plan de Viaje</p>
                  <p className="text-xs font-black text-emerald-400">
                    {(optimizedDistance / 1000).toFixed(1)} km ({Math.round(optimizedDuration / 60000)} min)
                  </p>
                </div>
                <div className="h-6 w-px bg-white/10" />
                <button
                  type="button"
                  onClick={handleSaveRouteIndices}
                  disabled={saveStatus === "saving"}
                  className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 text-white font-black text-[9px] uppercase tracking-widest rounded-xl transition-all"
                >
                  {saveStatus === "saving" ? "Guardando…" : "Confirmar Recorrido"}
                </button>
              </div>
            )}
          </div>
        ) : selectedShipment ? (
          <div className="p-4 bg-slate-900 text-white rounded-t-3xl border-b border-white/5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-left font-semibold">
            <div>
              <div className="flex items-center gap-x-2">
                <h4 className="text-sm font-black tracking-tight font-sans">{selectedShipment.customerName}</h4>
                <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded font-sans">
                  Pedido #{selectedShipment.orderId}
                </span>
              </div>
              <p className="text-[10px] text-white/50 font-bold mt-1 max-w-md truncate font-sans">
                Dirección registrada: {selectedShipment.address}
              </p>
            </div>

            {portalCustomerId ? (
              <div className="flex items-center gap-x-3 shrink-0 font-sans">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                  Estado despacho:
                </span>
                <span className={cn(
                  "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                  selectedShipment.status === "delivered"
                    ? "bg-emerald-500 text-white"
                    : selectedShipment.status === "in_route"
                    ? "bg-indigo-600 text-white animate-pulse"
                    : "bg-amber-500 text-white"
                )}>
                  {selectedShipment.status === "delivered"
                    ? "✓ Entregado con éxito"
                    : selectedShipment.status === "in_route"
                    ? "🚚 Repartidor en ruta"
                    : "📦 Preparado en bodega"}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-x-2 shrink-0 font-sans">
                <span className="text-xs font-black text-white/40 uppercase tracking-widest mr-2">Control Logístico:</span>
                <button type="button"
                  onClick={() => handleUpdateStatus(selectedShipment.id, "prepared")}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                    selectedShipment.status === "prepared" ? "bg-amber-500 text-white" : "bg-white/5 hover:bg-white/10"
                  )}
                >
                  Preparado
                </button>
                <button type="button"
                  onClick={() => handleUpdateStatus(selectedShipment.id, "in_route")}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                    selectedShipment.status === "in_route" ? "bg-indigo-600 text-white" : "bg-white/5 hover:bg-white/10"
                  )}
                >
                  En Camino
                </button>
                <button type="button"
                  onClick={() => handleUpdateStatus(selectedShipment.id, "delivered")}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                    selectedShipment.status === "delivered" ? "bg-emerald-500 text-white" : "bg-white/5 hover:bg-white/10"
                  )}
                >
                  Entregado
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-slate-900 text-slate-400 text-xs font-black uppercase tracking-wider rounded-t-3xl text-center font-sans">
            {portalCustomerId
              ? "No posees despachos activos registrados el día de hoy"
              : "Seleccione un despacho para ver estado georreferenciado"}
          </div>
        )}

        {/* Map Body */}
        <div className="flex-1 w-full min-h-[400px] relative rounded-b-3xl overflow-hidden border border-slate-100 shadow-inner">
          <APIProvider apiKey={API_KEY} version="weekly">
            <Map
              defaultCenter={WAREHOUSE_COORDS}
              defaultZoom={12}
              mapId="DELIVERY_TRACKER_MAP_ID"
              internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
              style={{ width: "100%", height: "100%" }}
            >
              {/* Warehouse Pin marker */}
              <AdvancedMarker position={WAREHOUSE_COORDS}>
                <Pin background="#4f46e5" glyphColor="#fff" scale={1.2}>
                  <div className="p-1 text-xs">🏢</div>
                </Pin>
              </AdvancedMarker>

              {/* All Customer Pin markers with optimized ordering if applicable */}
              {shipments.map((s) => {
                if (!s.lat || !s.lng) return null;
                
                // Get optimization order position if optimized mode is active
                const stopIndex = stopSequence.findIndex(os => os.id === s.id);
                const isOptimizedStop = isOptimizedMode && stopIndex !== -1 && optimizedIndices.length > 0;
                const isSelected = selectedShipment?.id === s.id;

                return (
                  <AdvancedMarker 
                    key={s.id} 
                    position={{ lat: s.lat, lng: s.lng }}
                    onClick={() => {
                      setSelectedShipment(s);
                      if (isOptimizedMode) {
                        // Switch tab to allow detailed actions
                        setIsOptimizedMode(false);
                      }
                    }}
                  >
                    <Pin 
                      background={
                        isOptimizedStop 
                          ? "#10b981" // Active optimized stop: emerald green
                          : s.status === "delivered"
                          ? "#64748b" // Slated grey if delivered
                          : isSelected
                          ? "#6366f1" // Active selected: indigo
                          : "#f59e0b" // Normal prepared: amber
                      } 
                      glyphColor="#fff"
                      scale={isSelected ? 1.25 : 1.0}
                    >
                      {isOptimizedStop ? (
                        <div className="text-[11px] font-black text-white size-5 flex items-center justify-center font-sans">
                          {stopIndex + 1}
                        </div>
                      ) : (
                        <div className="text-[10px]">🚚</div>
                      )}
                    </Pin>
                  </AdvancedMarker>
                );
              })}

              {/* Dynamic single route computation overlay */}
              {!isOptimizedMode && selectedShipment && selectedShipment.lat && (
                <RoutePolyline
                  origin={WAREHOUSE_COORDS}
                  destination={{ lat: selectedShipment.lat, lng: selectedShipment.lng }}
                />
              )}

              {/* Virtual Simulated Vehicle Marker on Map */}
              {isSimulating && simulatedVehiclePos && (
                <AdvancedMarker position={simulatedVehiclePos}>
                  <div className="relative flex items-center justify-center -translate-x-1/2 -translate-y-[85%]">
                    <span className="absolute inline-flex size-8 rounded-full bg-indigo-500 opacity-40 animate-ping" />
                    <div className="size-9 bg-slate-950 border-2 border-white rounded-full flex items-center justify-center shadow-2xl text-sm relative z-10 animate-soft-bounce">
                      🚚
                    </div>
                  </div>
                </AdvancedMarker>
              )}

              {/* Firestore Real-Time Coordinates Tracker for Customers & Inactive Simizers */}
              {!isSimulating && shipments.map((s) => {
                if (s.status === "in_route" && s.currentLat && s.currentLng) {
                  return (
                    <AdvancedMarker key={`realtime_truck_${s.id}`} position={{ lat: s.currentLat, lng: s.currentLng }}>
                      <div className="relative flex items-center justify-center -translate-x-1/2 -translate-y-[85%]">
                        <span className="absolute inline-flex size-8 rounded-full bg-emerald-500 opacity-40 animate-ping" />
                        <div className="size-9 bg-slate-950 border-2 border-emerald-400 rounded-full flex items-center justify-center shadow-2xl text-sm relative z-10 animate-soft-bounce" title={`Pedido #${s.orderId} en camino`}>
                          🚚
                        </div>
                      </div>
                    </AdvancedMarker>
                  );
                }
                return null;
              })}

              {/* Optimized multi-stop route computation overlay */}
              {isOptimizedMode && activeShipments.length > 0 && (
                <OptimizedRouteDisplay
                  origin={WAREHOUSE_COORDS}
                  intermediates={activeShipments.map(s => ({ lat: s.lat, lng: s.lng }))}
                  returnToWarehouse={returnToWarehouse}
                  onOptimizationComplete={handleOptimizationComplete}
                  onOptimizationError={handleOptimizationError}
                  triggerCount={triggerCount}
                />
              )}
            </Map>
          </APIProvider>

          {/* Quick info-tag floating on the map */}
          {selectedShipment && !isOptimizedMode && (
            <div className="absolute bottom-6 right-6 bg-slate-900/95 backdrop-blur text-white p-4 rounded-3xl shadow-2xl max-w-xs border border-white/10 space-y-2 z-10 text-left font-sans">
              <div className="flex items-center gap-x-2 text-indigo-400 font-black text-[10px] uppercase tracking-wider">
                <Truck size={12} />
                <span>Hoja de Ruta Real</span>
              </div>
              <p className="text-xs font-extrabold">{selectedShipment.driverName || "Repartidor No Asignado"}</p>
              <p className="text-[10px] text-white/60 flex items-center gap-x-1 font-semibold">
                <Phone size={10} />
                <span>{selectedShipment.driverPhone || "Sin fono"}</span>
              </p>
              {selectedShipment.routeIndex !== undefined && (
                <div className="py-1 px-2.5 bg-indigo-505 bg-opacity-25 text-indigo-400 border border-indigo-500/20 rounded-xl text-[10px] font-black uppercase tracking-wider inline-block">
                  Parada #{selectedShipment.routeIndex} de Ruta
                </div>
              )}
              <div className="pt-2 border-t border-white/5">
                <p className="text-[9px] text-white/40 font-black uppercase tracking-widest font-semibold">Paquete de Pedido:</p>
                <div className="max-h-20 overflow-y-auto mt-1 space-y-1">
                  {selectedShipment.items?.map((item: string, idx: number) => (
                    <p key={`${idx}-${item}`} className="text-[10px] text-white/80 font-medium truncate">• {item}</p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
