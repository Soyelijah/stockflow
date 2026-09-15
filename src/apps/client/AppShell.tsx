// Tier 5.B — Sf Client APK shell.
//
// This shell ONLY hosts the customer portal flow. The staff and driver code
// is NOT bundled here, so the cliente APK is significantly smaller and the
// bundle inspection grep (B.6) will confirm zero leakage of AdminRoutes /
// DeliveryRoutes / MobilePOS / setUserRole / costPrice symbols.
//
// Routing:
//   - / and /cliente both go to the customer portal (the legacy /cliente
//     prefix is preserved as an alias for QR codes and printed receipts).
//   - /flow-result is still the Flow.cl payment callback (public).
//   - If a staff/driver user signs in here by mistake, we show a message
//     directing them to the right app + signOut. The same guard exists
//     reciprocally in the staff and driver shells (see AppShell.tsx).

import React, { Suspense, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { FlowResult } from "../../shared/components/FlowResult";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { VerifyEmail } from "../../shared/components/VerifyEmail";
import { shouldShowEmailVerification } from "../../lib/authPolicy";

const CustomerPortal = React.lazy(() =>
  import("../../shared/components/CustomerPortal").then(m => ({ default: m.CustomerPortal }))
);

const LazyFallback = () => (
  <div className="flex h-screen items-center justify-center bg-slate-50">
    <div className="size-12 animate-spin rounded-full border-4 border-orange-500 border-t-transparent shadow-md" />
  </div>
);

function WrongAppMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-black text-slate-900">{title}</h1>
        <p className="text-sm text-slate-600 leading-relaxed">{body}</p>
        <button
          type="button"
          onClick={() => signOut(auth).catch(() => {})}
          className="px-6 py-3 bg-orange-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-orange-400 transition-all"
          aria-label="Cerrar sesión"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

const STAFF_ROLES = ["owner", "admin", "manager", "seller", "logistics"];

export function AppShell() {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  // /flow-result is the public payment callback — bypass all auth checks
  if (location.pathname === "/flow-result") {
    return <FlowResult />;
  }

  // Loading auth state
  if (loading) return <LazyFallback />;

  // Authenticated as STAFF (somehow landed on the customer app) → message + signOut.
  // Customer-without-profile is handled inside CustomerPortal itself (Tier 5.A4.4 guard).
  if (user && profile?.role && STAFF_ROLES.includes(profile.role)) {
    return (
      <WrongAppMessage
        title="Esta es la app de Clientes"
        body="Tu cuenta es del personal interno. Descarga e instala la app StockFlow para acceder al panel administrativo."
      />
    );
  }

  if (user && profile?.role === "driver") {
    return (
      <WrongAppMessage
        title="Esta es la app de Clientes"
        body="Tu cuenta es de repartidor. Descarga e instala la app Sf Driver para ver tus rutas."
      />
    );
  }

  if (shouldShowEmailVerification(user)) {
    return <VerifyEmail />;
  }

  // Everything else (no user, or user with claim=customer) → portal.
  // CustomerPortal handles its own login/register/activate/recover modes
  // and never reads /users (which is staff-only).
  return (
    <Suspense fallback={<LazyFallback />}>
      <Routes>
        <Route path="/cliente" element={<CustomerPortal />} />
        <Route path="/" element={<CustomerPortal />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
