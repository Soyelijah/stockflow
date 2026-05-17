import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { 
  User, 
  Mail, 
  Shield, 
  Calendar, 
  Camera,
  Save,
  CheckCircle2,
  Phone
} from "lucide-react";
import { motion } from "motion/react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { cn } from "../lib/utils";

export function Profile() {
  const { profile, user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    photoURL: "",
    phone: "",
    rut: "",
    birthday: "",
    address: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync formData with profile when it loads
  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || "",
        photoURL: profile.photoURL || "",
        phone: profile.phone || "",
        rut: profile.rut || "",
        birthday: profile.birthday || "",
        address: profile.address || "",
      });
    }
  }, [profile]);

  const formatRUT = (value: string) => {
    const clean = value.replace(/[^0-9kK]/g, "");
    if (!clean) return "";
    let result = "";
    const body = clean.slice(0, -1);
    const dv = clean.slice(-1).toLowerCase();
    
    // Reverse for easier dot placement
    const revBody = body.split("").reverse().join("");
    let revResult = "";
    for (let i = 0; i < revBody.length; i++) {
      if (i > 0 && i % 3 === 0) revResult += ".";
      revResult += revBody[i];
    }
    result = revResult.split("").reverse().join("");
    if (dv) result += "-" + dv;
    return result;
  };

  const formatPhone = (value: string) => {
    const clean = value.replace(/\D/g, "");
    if (!clean) return "";
    let result = "";
    // Target: 9 1234 5678
    for (let i = 0; i < clean.length; i++) {
      if (i === 1 || i === 5) result += " ";
      result += clean[i];
      if (result.length >= 11) break; // Max length for 9 digits + spaces
    }
    return result;
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, photoURL: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        name: formData.name,
        photoURL: formData.photoURL,
        phone: formData.phone,
        rut: formData.rut,
        birthday: formData.birthday,
        address: formData.address,
        updatedAt: new Date().toISOString()
      });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error(error);
      alert("Error al actualizar perfil");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-black text-slate-800 tracking-tight">Mi Perfil</h1>
        <p className="text-slate-500 font-medium mt-1">Gestiona tu información personal y cuenta.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left: Avatar & Role */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm text-center">
            <div className="relative inline-block mb-6 group">
              <div className="w-32 h-32 rounded-[2.5rem] bg-indigo-600 flex items-center justify-center text-white text-5xl font-black shadow-2xl shadow-indigo-200 overflow-hidden">
                {formData.photoURL ? (
                  <img src={formData.photoURL} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  profile?.name.charAt(0)
                )}
              </div>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handlePhotoUpload}
                className="hidden" 
                accept="image/*"
              />
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-2 -right-2 p-3 bg-white rounded-2xl border border-slate-100 shadow-lg text-slate-400 hover:text-indigo-600 transition-colors group-hover:scale-110"
              >
                <Camera size={18} />
              </button>
            </div>
            
            <h3 className="text-xl font-black text-slate-800">{profile?.name}</h3>
            <div className="mt-2 inline-flex items-center px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100">
              <Shield size={12} className="mr-1.5" />
              {profile?.role}
            </div>
            
            <div className="mt-8 pt-8 border-t border-slate-50 space-y-4">
              <div className="flex items-center text-left space-x-3 text-slate-500">
                <Mail size={16} className="text-slate-300" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email</p>
                  <p className="text-xs font-bold text-slate-700 truncate">{profile?.email}</p>
                </div>
              </div>
              <div className="flex items-center text-left space-x-3 text-slate-500">
                <Calendar size={16} className="text-slate-300" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Miembro desde</p>
                  <p className="text-xs font-bold text-slate-700 truncate">
                    {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "N/A"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Settings Form */}
        <div className="md:col-span-2">
          <form onSubmit={handleSave} className="bg-white rounded-[2.5rem] border border-slate-100 p-10 shadow-sm space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nombre Completo</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    placeholder="Tu nombre"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">RUT / Identificación</label>
                <div className="relative">
                  <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={formData.rut}
                    onChange={(e) => setFormData({ ...formData, rut: formatRUT(e.target.value) })}
                    className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    placeholder="11.111.111-k"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Teléfono</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs flex items-center space-x-1">
                    <Phone size={14} />
                    <span>+56</span>
                  </div>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                    className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-16 pr-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    placeholder="9 1234 5678"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Fecha de Nacimiento</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="date"
                    value={formData.birthday}
                    onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                    className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Dirección Particular</label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-slate-50 border-none rounded-2xl py-4 px-5 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    placeholder="Calle #123, Comuna, Ciudad"
                  />
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Correo Electrónico (Solo Lectura)</label>
                <div className="relative opacity-60">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="email"
                    value={profile?.email || ""}
                    disabled
                    className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-slate-700"
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-medium ml-1">Para cambiar tu correo contacta al administrador.</p>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-50 flex items-center justify-between gap-6">
              <div className="flex items-center space-x-2">
                {showSuccess && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center text-emerald-600 text-xs font-bold"
                  >
                    <CheckCircle2 size={16} className="mr-1" />
                    Perfil actualizado
                  </motion.div>
                )}
              </div>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center space-x-2 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 disabled:shadow-none"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                <span>Guardar Cambios</span>
              </button>
            </div>
          </form>

          {/* Security Notice */}
          <div className="mt-6 p-6 bg-amber-50 border border-amber-100 rounded-[2rem] flex items-start space-x-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
              <Shield size={20} />
            </div>
            <div>
              <h4 className="text-xs font-black text-amber-800 uppercase tracking-widest mb-1">Seguridad de la Cuenta</h4>
              <p className="text-[11px] text-amber-700/70 font-medium leading-relaxed">
                Tu rol de <strong>{profile?.role}</strong> te otorga acceso específico a las herramientas que necesitas. No compartas tus credenciales con terceros para mantener la integridad de los datos.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
