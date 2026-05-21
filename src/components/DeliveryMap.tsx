import React, { useEffect, useState, useRef } from "react";
import { APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { collection, onSnapshot, query, doc, updateDoc, setDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../lib/utils";
import { MapPin, Navigation, Truck, User, Phone, CheckCircle, Package, Plus, Map as MapIcon, Loader2 } from "lucide-react";

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

export function DeliveryMap() {
  const { profile } = useAuth();
  const [shipments, setShipments] = useState<any[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Form states to register a mockup shipment (Real coordinates in Santiago for demo/production delivery)
  const [showAddForm, setShowAddForm] = useState(false);
  const [newShipment, setNewShipment] = useState({
    orderId: "",
    customerName: "",
    address: "",
    lat: -33.456,
    lng: -70.662,
    driverName: "Claudio Gómez (Repartidor)",
    driverPhone: "+56 9 8765 4321",
    total: 25000,
    itemsText: "2x Caja de Vino Premium, 1x Aceite Oliva Extra"
  });

  // Default coordinate offsets for Santiago dispatches
  const santiagoCommunes = [
    { name: "Providencia", lat: -33.426, lng: -70.612 },
    { name: "Las Condes", lat: -33.412, lng: -70.578 },
    { name: "Ñuñoa", lat: -33.456, lng: -70.606 },
    { name: "Santiago Centro", lat: -33.448, lng: -70.669 },
    { name: "La Reina", lat: -33.441, lng: -70.548 },
  ];

  useEffect(() => {
    const q = query(collection(db, "shipments"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setShipments(data);
      setLoading(false);
      if (data.length > 0 && !selectedShipment) {
        setSelectedShipment(data[0]);
      }
    }, (err) => {
      console.error("Error fetching shipments:", err);
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleCreateMockShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShipment.orderId || !newShipment.customerName || !newShipment.address) {
      alert("Por favor rellene los campos obligatorios.");
      return;
    }
    try {
      const id = `SHIP_${Date.now()}`;
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
        timestamp: new Date().toISOString()
      });

      setShowAddForm(false);
      setNewShipment({
        orderId: "",
        customerName: "",
        address: "",
        lat: -33.456,
        lng: -70.662,
        driverName: "Claudio Gómez (Repartidor)",
        driverPhone: "+56 9 8765 4321",
        total: 25000,
        itemsText: "2x Caja de Vino Premium, 1x Aceite Oliva Extra"
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
      if (status === "in_route") msg += `Está en camino a cargo de ${selectedShipment?.driverName || "repartidor"}.`;
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

  if (!hasValidKey) {
    return (
      <div className="flex items-center justify-center min-h-[500px] bg-slate-50 p-8 rounded-[2.5rem]">
        <div className="text-center max-w-xl bg-white p-10 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto shadow-sm">
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
          <div className="p-4 bg-amber-50 rounded-2xl text-[11px] font-black tracking-wide text-amber-800 uppercase flex items-center space-x-2 justify-center">
            <span>⚠ ESTA EXPERIENCIA UTILIZA COORDENADAS GEOGRÁFICAS REALES DE LA CADENA</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 min-h-[600px] bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden p-3 md:p-6">
      {/* Shipment sidebar */}
      <div className="lg:col-span-1 border-r border-slate-100 pr-0 lg:pr-6 flex flex-col h-full space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Despachos En Ruta</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Monitoreo de logística real</p>
          </div>
          <button
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
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">ID Pedido / Venta</label>
              <input
                type="text"
                placeholder="Ej: FE9281A"
                required
                className="w-full h-8 bg-white border border-slate-100 rounded-lg px-2 text-xs font-bold"
                value={newShipment.orderId}
                onChange={e => setNewShipment({ ...newShipment, orderId: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nombre Cliente</label>
              <input
                type="text"
                placeholder="Ej: Sofía Pérez"
                required
                className="w-full h-8 bg-white border border-slate-100 rounded-lg px-2 text-xs font-bold"
                value={newShipment.customerName}
                onChange={e => setNewShipment({ ...newShipment, customerName: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Dirección Despacho</label>
              <input
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
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Referencia Geográfica</label>
                <select
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
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total</label>
                <input
                  type="number"
                  className="w-full h-8 bg-white border border-slate-100 rounded-lg px-2 text-xs font-bold"
                  value={newShipment.total}
                  onChange={e => setNewShipment({ ...newShipment, total: Number(e.target.value) })}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black uppercase tracking-widest"
            >
              Confirmar Despacho
            </button>
          </form>
        )}

        {/* Shipment list */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-slate-800">
          {shipments.map((s) => (
            <div
              key={s.id}
              onClick={() => setSelectedShipment(s)}
              className={cn(
                "p-4 rounded-3xl border text-left transition-all cursor-pointer relative overflow-hidden",
                selectedShipment?.id === s.id
                  ? "bg-slate-900 border-transparent text-white shadow-lg"
                  : "bg-slate-50 border-slate-100 hover:bg-slate-100"
              )}
            >
              {selectedShipment?.id === s.id && (
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 blur-2xl rounded-full" />
              )}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-black tracking-widest px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 uppercase">
                  #{s.orderId}
                </span>
                <span
                  className={cn(
                    "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                    s.status === "delivered"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : s.status === "in_route"
                      ? "bg-indigo-500/20 text-indigo-400 animate-pulse"
                      : "bg-amber-500/20 text-amber-400"
                  )}
                >
                  {s.status === "delivered" ? "Entregado" : s.status === "in_route" ? "En Ruta" : "Preparado"}
                </span>
              </div>
              <p className="text-xs font-extrabold tracking-tight truncate leading-tight">
                {s.customerName}
              </p>
              <div className="flex items-center space-x-1 mt-1 text-[10px] opacity-60">
                <MapPin size={10} className="shrink-0" />
                <span className="truncate">{s.address}</span>
              </div>
            </div>
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
      </div>

      {/* Interactive Map Layout */}
      <div className="lg:col-span-3 flex flex-col h-full min-h-[500px]">
        {/* Selected shipment overlay details */}
        {selectedShipment ? (
          <div className="p-4 bg-slate-900 text-white rounded-t-3xl border-b border-white/5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="text-sm font-black tracking-tight">{selectedShipment.customerName}</h4>
                <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded">
                  Pedido #{selectedShipment.orderId}
                </span>
              </div>
              <p className="text-[10px] text-white/50 font-bold mt-1 max-w-md truncate">
                Dirección registrada: {selectedShipment.address}
              </p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <span className="text-xs font-black text-white/40 uppercase tracking-widest mr-2">Control Logístico:</span>
              <button
                onClick={() => handleUpdateStatus(selectedShipment.id, "prepared")}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                  selectedShipment.status === "prepared" ? "bg-amber-500 text-white" : "bg-white/5 hover:bg-white/10"
                )}
              >
                Preparado
              </button>
              <button
                onClick={() => handleUpdateStatus(selectedShipment.id, "in_route")}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                  selectedShipment.status === "in_route" ? "bg-indigo-600 text-white" : "bg-white/5 hover:bg-white/10"
                )}
              >
                En Camino
              </button>
              <button
                onClick={() => handleUpdateStatus(selectedShipment.id, "delivered")}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                  selectedShipment.status === "delivered" ? "bg-emerald-500 text-white" : "bg-white/5 hover:bg-white/10"
                )}
              >
                Entregado
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-slate-900 text-slate-400 text-xs font-black uppercase tracking-wider rounded-t-3xl text-center">
            Seleccione un despacho para ver estado georreferenciado
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

              {/* Customer Pin marker */}
              {selectedShipment && selectedShipment.lat && (
                <AdvancedMarker position={{ lat: selectedShipment.lat, lng: selectedShipment.lng }}>
                  <Pin background={selectedShipment.status === "delivered" ? "#10b981" : "#f59e0b"} glyphColor="#fff">
                    <div className="text-xs">🚚</div>
                  </Pin>
                </AdvancedMarker>
              )}

              {/* Dynamic route computation overlay */}
              {selectedShipment && selectedShipment.lat && (
                <RoutePolyline
                  origin={WAREHOUSE_COORDS}
                  destination={{ lat: selectedShipment.lat, lng: selectedShipment.lng }}
                />
              )}
            </Map>
          </APIProvider>

          {/* Quick info-tag floating on the map */}
          {selectedShipment && (
            <div className="absolute bottom-6 right-6 bg-slate-900/95 backdrop-blur text-white p-4 rounded-3xl shadow-2xl max-w-xs border border-white/10 space-y-2 z-10 text-left">
              <div className="flex items-center space-x-2 text-indigo-400 font-black text-[10px] uppercase tracking-wider">
                <Truck size={12} />
                <span>Hoja de Ruta Real</span>
              </div>
              <p className="text-xs font-extrabold">{selectedShipment.driverName || "Repartidor No Asignado"}</p>
              <p className="text-[10px] text-white/60 flex items-center space-x-1">
                <Phone size={10} />
                <span>{selectedShipment.driverPhone || "Sin fono"}</span>
              </p>
              <div className="pt-2 border-t border-white/5">
                <p className="text-[9px] text-white/40 font-black uppercase tracking-widest">Paquete de Pedido:</p>
                <div className="max-h-20 overflow-y-auto mt-1 space-y-1">
                  {selectedShipment.items?.map((item: string, idx: number) => (
                    <p key={idx} className="text-[10px] text-white/80 font-medium truncate">• {item}</p>
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
