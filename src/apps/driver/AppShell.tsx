// Tier 5.B — Sf Driver APK shell.
//
// This shell ONLY hosts the driver / delivery routes (DeliveryRoutes —
// the interactive map, GPS, barcode scan, customer signature flows).
// Admin / customer code is NOT bundled here.
//
// Driver auth model: like staff, drivers have a Firebase Auth user + claim
// {role: "driver"}. They land here via Login + signInWithEmailAndPassword.
//
// Routing:
//   - Loading → spinner.
//   - Not authenticated → <Login />.
//   - Authenticated but not driver → message + signOut directing to the
//     right app.

import React, { Suspense } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Login } from "../../shared/components/Login";
import { VerifyEmail } from "../../shared/components/VerifyEmail";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";

const DeliveryRoutes = React.lazy(() =>
  import("../delivery/routes").then(m => ({ default: m.DeliveryRoutes }))
);

const LazyFallback = () => (
  <div className="flex h-screen items-center justify-center bg-slate-900">
    <div className="size-12 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent shadow-md" />
  </div>
);

function WrongAppMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-black text-slate-900">{title}</h1>
        <p className="text-sm text-slate-600 leading-relaxed">{body}</p>
        <button
          onClick={() => signOut(auth).catch(() => {})}
          className="px-6 py-3 bg-cyan-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-cyan-500 transition-all"
          aria-label="Cerrar sesión"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

export function AppShell() {
  const { user, profile, loading } = useAuth();

  if (loading) return <LazyFallback />;
  if (!user || !profile) return <Login variant="driver" />;

  const isDemoEmail = user.email?.endsWith("@stockflow.com");
  if (!user.emailVerified && !isDemoEmail) return <VerifyEmail />;

  if (profile.role === "customer") {
    return (
      <WrongAppMessage
        title="Esta es la app de Repartidores"
        body="Tu cuenta es de cliente. Descarga e instala la app Sf Client para acceder a tus beneficios."
      />
    );
  }

  if (profile.role !== "driver") {
    return (
      <WrongAppMessage
        title="Esta es la app de Repartidores"
        body="Tu cuenta no tiene rol de repartidor. Si eres del personal interno, usa la app StockFlow."
      />
    );
  }

  return (
    <Suspense fallback={<LazyFallback />}>
      <DeliveryRoutes />
    </Suspense>
  );
}
