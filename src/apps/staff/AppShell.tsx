// Tier 5.B — StockFlow Staff APK shell.
//
// This shell ONLY hosts the internal-workforce roles: owner, admin, manager,
// seller, logistics. The driver and customer flows live in their own APKs
// (Sf Driver, Sf Client) and their code is NOT bundled here.
//
// Routing decisions:
//   - Loading auth state → spinner.
//   - Not authenticated → <Login />.
//   - Authenticated as customer (somehow ended up in the staff app) → signOut + message.
//   - Authenticated as driver → show "use Sf Driver app" message + signOut.
//   - Authenticated as staff role → AdminRoutes.
//
// `App.tsx` (the legacy monolithic shell) is no longer rendered by this entry —
// each APK now owns its own routing. The shared providers (AuthContext,
// BranchContext, SettingsContext) are still composed at the top by main-staff.tsx.

import React, { Suspense, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Login } from "../../shared/components/Login";
import { VerifyEmail } from "../../shared/components/VerifyEmail";
import { FlowResult } from "../../shared/components/FlowResult";
import { useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { seedCouponsIfEmpty } from "../../lib/coupons";
import { isStaff } from "../../lib/roles";
import { requiresEmailVerification } from "../../lib/authPolicy";

const AdminRoutes = React.lazy(() =>
  import("../admin/routes").then(m => ({ default: m.AdminRoutes }))
);

const LazyFallback = () => (
  <div className="flex h-screen items-center justify-center bg-gray-50">
    <div className="size-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent shadow-md" />
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
          className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-700 transition-all"
          aria-label="Cerrar sesión"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

export function AppShell() {
  const { user, profile, claimRole, loading } = useAuth();
  const location = useLocation();

  // Seed default coupons only — customers are NOT seeded from the client anymore
  // (the create rule requires uid match; legacy seed used arbitrary doc ids).
  useEffect(() => {
    if (user && (profile?.role === "admin" || profile?.role === "manager" || profile?.role === "owner")) {
      seedCouponsIfEmpty();
    }
  }, [user, profile]);

  // /flow-result is the Webpay/Flow.cl callback — public, can run without auth.
  if (location.pathname === "/flow-result") {
    return <FlowResult />;
  }

  if (loading) return <LazyFallback />;

  // Not signed in → standard staff login screen.
  if (!user) return <Login variant="staff" />;

  // Signed in but the claim says "customer" or "driver" → cross-app guard,
  // NOT the login screen. Without this we re-rendered <Login /> on every
  // wrong-app login attempt, leaving the user stuck on the form with no
  // way out (Tier 5.B smoke Case 2 regression).
  if (claimRole === "customer") {
    return (
      <WrongAppMessage
        title="Esta es la app de Trabajadores"
        body="Tu cuenta es de cliente. Descarga e instala la app Sf Client para acceder a tus beneficios."
      />
    );
  }
  if (claimRole === "driver") {
    return (
      <WrongAppMessage
        title="Esta es la app de Trabajadores"
        body="Tu cuenta es de repartidor. Descarga e instala la app Sf Driver para ver tus rutas y entregas."
      />
    );
  }

  // Signed in with a staff claim but no /users mirror yet — wait for the
  // mirror listener (a missing mirror with a valid claim is also handled
  // explicitly inside AuthContext, which surfaces a warning).
  if (!profile) return <LazyFallback />;

  if (requiresEmailVerification(user.emailVerified)) return <VerifyEmail />;

  // Staff-only check via canonical helper (safety net against typos in role string)
  if (!isStaff(profile.role)) {
    return (
      <WrongAppMessage
        title="Cuenta sin autorización"
        body="Tu cuenta no tiene un rol válido asignado. Contacta al administrador."
      />
    );
  }

  return (
    <Suspense fallback={<LazyFallback />}>
      <AdminRoutes />
    </Suspense>
  );
}
