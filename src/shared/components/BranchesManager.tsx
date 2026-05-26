// Multi-branch (Tier 1.4) — admin CRUD for /branches metadata.
// Embedded inside Settings as the "Sucursales" tab. Admin/owner only.
//
// Concerns:
//   - Soft delete (toggle `active: false`) — never hard-delete branches because
//     historical data (transactions, shipments, stock movements) reference them
//     via branchId. Hard-delete would orphan that history.
//   - Cannot delete "default" — it's the migration seed and acts as the fallback
//     branch for unscoped writes. Disabling it would brick the system.
//   - Cannot edit `id` after creation (it's the document key, used everywhere).
//   - geolocation is optional but recommended for customer auto-routing (Tier 1.4b).

import React, { useState, useEffect, useId } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { Building2, Plus, Edit2, X, Save, MapPin, Phone, Power, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { db, handleFirestoreError, OperationType } from "../../lib/firebase";
import { Branch, DEFAULT_BRANCH_ID } from "../../lib/branches";
import { cn, INPUT_MAX } from "../../lib/utils";
import { ModernAlert } from "./ui/ModernAlert";

interface NewBranchForm {
  id: string;
  name: string;
  address: string;
  phone: string;
  lat: string;
  lng: string;
}

const EMPTY_FORM: NewBranchForm = {
  id: "",
  name: "",
  address: "",
  phone: "",
  lat: "",
  lng: "",
};

export function BranchesManager() {
  const fid = useId();
  const fId = (s: string) => `${fid}-${s}`;
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NewBranchForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "warning" | "delete" | "info";
    onConfirm?: () => void;
  }>({ isOpen: false, title: "", message: "", type: "info" });

  useEffect(() => {
    // Load BOTH active and inactive so admin can see / re-enable disabled branches.
    const unsub = onSnapshot(
      query(collection(db, "branches")),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Branch);
        list.sort((a, b) => {
          if (a.id === DEFAULT_BRANCH_ID) return -1;
          if (b.id === DEFAULT_BRANCH_ID) return 1;
          return (a.name || "").localeCompare(b.name || "");
        });
        setBranches(list);
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "branches");
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setIsModalOpen(true);
  };

  const openEdit = (b: Branch) => {
    setEditingId(b.id);
    setForm({
      id: b.id,
      name: b.name || "",
      address: b.address || "",
      phone: b.phone || "",
      lat: b.geolocation?.lat?.toString() || "",
      lng: b.geolocation?.lng?.toString() || "",
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const id = form.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const name = form.name.trim();

    if (!name) {
      setFormError("El nombre es obligatorio.");
      return;
    }
    if (!editingId && !id) {
      setFormError("El ID es obligatorio para crear una sucursal nueva.");
      return;
    }
    if (id === "*") {
      setFormError("El ID '*' está reservado para el sentinel de claims.");
      return;
    }

    // Build geolocation payload only if both lat AND lng are valid numbers.
    let geolocation: { lat: number; lng: number } | null = null;
    if (form.lat.trim() && form.lng.trim()) {
      const lat = Number(form.lat);
      const lng = Number(form.lng);
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        setFormError("Coordenadas inválidas. Latitud: -90 a 90, Longitud: -180 a 180.");
        return;
      }
      geolocation = { lat, lng };
    }

    setSubmitting(true);
    try {
      if (editingId) {
        // Update — ID is immutable.
        await updateDoc(doc(db, "branches", editingId), {
          name,
          address: form.address.trim(),
          phone: form.phone.trim(),
          geolocation,
          updatedAt: serverTimestamp(),
        });
        setAlertConfig({
          isOpen: true,
          type: "success",
          title: "Sucursal actualizada",
          message: `Los datos de "${name}" se guardaron correctamente.`,
        });
      } else {
        // Create — use setDoc with explicit id so we control the doc key.
        await setDoc(doc(db, "branches", id), {
          name,
          address: form.address.trim(),
          phone: form.phone.trim(),
          geolocation,
          active: true,
          managerUserId: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setAlertConfig({
          isOpen: true,
          type: "success",
          title: "Sucursal creada",
          message: `"${name}" (ID: ${id}) está lista para operar.`,
        });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, "branches");
      setFormError(`No se pudo guardar: ${err.message || "error desconocido"}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (b: Branch) => {
    if (b.id === DEFAULT_BRANCH_ID) {
      setAlertConfig({
        isOpen: true,
        type: "warning",
        title: "Sucursal protegida",
        message: "La sucursal 'default' es el seed del sistema y no puede desactivarse. Es el fallback para operaciones sin sucursal específica.",
      });
      return;
    }
    const willActivate = !b.active;
    setAlertConfig({
      isOpen: true,
      type: willActivate ? "info" : "warning",
      title: willActivate ? "¿Activar sucursal?" : "¿Desactivar sucursal?",
      message: willActivate
        ? `"${b.name}" volverá a estar disponible para asignaciones de rol y operaciones nuevas.`
        : `"${b.name}" no podrá recibir nuevas operaciones. Las transacciones, despachos y movimientos históricos se conservan intactos. Reactivable cuando quieras.`,
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, "branches", b.id), {
            active: willActivate,
            updatedAt: serverTimestamp(),
          });
        } catch (err: any) {
          handleFirestoreError(err, OperationType.UPDATE, "branches");
        }
      },
    });
  };

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 space-y-6">
      <div className="flex items-center justify-between gap-x-4">
        <div className="flex items-center gap-x-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Building2 size={24} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800 tracking-tight">Sucursales</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">
              Gestión de tiendas, bodegas y puntos de operación
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="bg-indigo-600 text-white font-bold px-5 py-3 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-indigo-500 transition-all flex items-center gap-x-2 shrink-0"
        >
          <Plus size={16} />
          <span>Nueva</span>
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400 font-medium py-12 text-center">Cargando sucursales…</p>
      ) : branches.length === 0 ? (
        <div className="py-12 text-center bg-slate-50 rounded-2xl">
          <Building2 size={32} className="mx-auto text-slate-300 mb-2" />
          <p className="text-xs text-slate-500 font-bold">No hay sucursales registradas.</p>
          <p className="text-[10px] text-slate-400 mt-1">
            Ejecute el script <code>seed-default-branch.ts</code> para crear la sucursal inicial.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {branches.map((b) => (
            <div
              key={b.id}
              className={cn(
                "flex items-center justify-between p-4 rounded-2xl border transition-all",
                b.active
                  ? "bg-slate-50 border-slate-100 hover:border-indigo-200"
                  : "bg-slate-50/40 border-slate-100 opacity-60"
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-x-2">
                  <p className="text-sm font-black text-slate-800 truncate">{b.name}</p>
                  {b.id === DEFAULT_BRANCH_ID && (
                    <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded">
                      Seed
                    </span>
                  )}
                  {!b.active && (
                    <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded">
                      Inactiva
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-x-3 mt-1 text-[10px] font-bold text-slate-400">
                  <span className="font-mono">{b.id}</span>
                  {b.address && (
                    <span className="flex items-center gap-x-1 truncate">
                      <MapPin size={9} />
                      {b.address}
                    </span>
                  )}
                  {b.phone && (
                    <span className="flex items-center gap-x-1">
                      <Phone size={9} />
                      {b.phone}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openEdit(b)}
                  aria-label={`Editar sucursal ${b.name}`}
                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleActive(b)}
                  aria-label={b.active ? `Desactivar sucursal ${b.name}` : `Activar sucursal ${b.name}`}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    b.active
                      ? "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                  )}
                >
                  <Power size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-start gap-x-2 px-3 py-2 bg-amber-50/60 border border-amber-100 rounded-xl">
        <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
        <p className="text-[10px] font-bold text-amber-700 leading-relaxed">
          Las sucursales se desactivan (soft-delete) en lugar de eliminarse para preservar el historial de transacciones,
          despachos y movimientos de stock que las referencian. La sucursal <code>default</code> es el seed del sistema
          y no puede desactivarse.
        </p>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              role="button"
              tabIndex={-1}
              aria-label="Cerrar modal"
              onClick={() => !submitting && setIsModalOpen(false)}
              onKeyDown={(e) => { if (e.key === "Escape" && !submitting) setIsModalOpen(false); }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-x-3 text-indigo-600">
                  <Building2 size={20} />
                  <h3 className="text-base font-black text-slate-800 tracking-tight">
                    {editingId ? "Editar Sucursal" : "Nueva Sucursal"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => !submitting && setIsModalOpen(false)}
                  aria-label="Cerrar formulario"
                  className="p-2 text-slate-400 hover:text-slate-900 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
                <div className="space-y-1.5">
                  <label htmlFor={fId("id")} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">
                    ID interno {!editingId && <span className="text-rose-500">*</span>}
                  </label>
                  <input
                    id={fId("id")}
                    type="text"
                    required={!editingId}
                    disabled={!!editingId}
                    maxLength={INPUT_MAX.SHORT_TEXT}
                    placeholder="providencia, las_condes, bodega_central"
                    className={cn(
                      "w-full h-12 border border-slate-100 rounded-xl px-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-800 font-mono",
                      editingId ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "bg-slate-50"
                    )}
                    value={form.id}
                    onChange={(e) => setForm({ ...form, id: e.target.value })}
                  />
                  <p className="text-[9px] font-bold text-slate-400 ml-1">
                    {editingId ? "El ID es inmutable después de crear." : "Lowercase + guiones bajos. Se usa internamente para referenciar la sucursal."}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor={fId("name")} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">
                    Nombre <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id={fId("name")}
                    type="text"
                    required
                    maxLength={INPUT_MAX.NAME}
                    placeholder="Tienda Providencia"
                    className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-800"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor={fId("address")} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">
                    Dirección
                  </label>
                  <input
                    id={fId("address")}
                    type="text"
                    maxLength={INPUT_MAX.ADDRESS}
                    placeholder="Av. Providencia 1234, Santiago"
                    className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-800"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor={fId("phone")} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">
                    Teléfono
                  </label>
                  <input
                    id={fId("phone")}
                    type="tel"
                    maxLength={INPUT_MAX.PHONE}
                    placeholder="+56 2 1234 5678"
                    className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-800"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor={fId("lat")} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">
                      Latitud
                    </label>
                    <input
                      id={fId("lat")}
                      type="text"
                      inputMode="decimal"
                      placeholder="-33.4263"
                      className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-800 font-mono"
                      value={form.lat}
                      onChange={(e) => setForm({ ...form, lat: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor={fId("lng")} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">
                      Longitud
                    </label>
                    <input
                      id={fId("lng")}
                      type="text"
                      inputMode="decimal"
                      placeholder="-70.6135"
                      className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-800 font-mono"
                      value={form.lng}
                      onChange={(e) => setForm({ ...form, lng: e.target.value })}
                    />
                  </div>
                </div>
                <p className="text-[9px] font-bold text-slate-400 ml-1">
                  Las coordenadas (opcionales) se usan para auto-asignar órdenes del cliente a la sucursal más cercana con stock.
                </p>

                {formError && (
                  <div className="px-3 py-2 bg-rose-50 border border-rose-100 rounded-xl">
                    <p className="text-[10px] font-bold text-rose-600">{formError}</p>
                  </div>
                )}

                <div className="flex gap-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={submitting}
                    className="flex-1 py-3 bg-slate-100 text-slate-500 font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-[2] py-3 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-indigo-500 transition-all flex items-center justify-center gap-x-2 shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save size={14} />
                    <span>{submitting ? "Guardando…" : editingId ? "Actualizar" : "Crear"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ModernAlert
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
        onConfirm={alertConfig.onConfirm}
      />
    </div>
  );
}
