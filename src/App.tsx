import React, { useEffect, Suspense } from "react";
import { useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { BranchProvider } from "./contexts/BranchContext";
import { Login } from "./shared/components/Login";
import { VerifyEmail } from "./shared/components/VerifyEmail";
import { FlowResult } from "./shared/components/FlowResult";
import { SettingsProvider } from "./contexts/SettingsContext";
import { seedCouponsIfEmpty, seedCustomersIfEmpty } from "./lib/coupons";
import { requiresEmailVerification, shouldShowEmailVerification } from "./lib/authPolicy";

// Lazy-load sub-app routes to enable per-role code-splitting.
// Without this, all admin/store/delivery code ships in a single ~2.4 MB bundle.
const AdminRoutes = React.lazy(() => import("./apps/admin/routes").then(m => ({ default: m.AdminRoutes })));
const StoreRoutes = React.lazy(() => import("./apps/store/routes").then(m => ({ default: m.StoreRoutes })));
const DeliveryRoutes = React.lazy(() => import("./apps/delivery/routes").then(m => ({ default: m.DeliveryRoutes })));

const LazyFallback = () => (
  <div className="flex h-screen items-center justify-center bg-gray-50">
    <div className="size-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent shadow-md"></div>
  </div>
);

function AppContent() {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  // Seed default coupons and customers if missing, executed securely by staff with admin/manager/owner privileges
  useEffect(() => {
    if (user && (profile?.role === "admin" || profile?.role === "manager" || profile?.role === "owner")) {
      seedCouponsIfEmpty();
      seedCustomersIfEmpty();
    }
  }, [user, profile]);

  // Public path checkout and feedback routes
  const isCustomerPath = location.pathname.startsWith("/cliente");
  const isFlowResultPath = location.pathname === "/flow-result";

  // Allow accessing the customer portal or payment callback without auth
  if (isCustomerPath) {
    if (loading) return <LazyFallback />;
    if (shouldShowEmailVerification(user)) {
      return <VerifyEmail />;
    }
    return (
      <Suspense fallback={<LazyFallback />}>
        <StoreRoutes />
      </Suspense>
    );
  }

  if (isFlowResultPath) {
    return <FlowResult />;
  }

  // Auth requirement for all core roles
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="size-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent shadow-md"></div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Login />;
  }

  // Email verification is mandatory for every role. Demo behavior must be
  // configured in Firebase Auth/emulators, never inferred from an email domain.
  if (requiresEmailVerification(user.emailVerified)) {
    return <VerifyEmail />;
  }

  // Multi-role routing based strictly on custom claim / profile role
  if (profile?.role === "driver") {
    return (
      <Suspense fallback={<LazyFallback />}>
        <DeliveryRoutes />
      </Suspense>
    );
  }

  // admin, manager, seller, logistics, owner roles get AdminRoutes
  return (
    <Suspense fallback={<LazyFallback />}>
      <AdminRoutes />
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BranchProvider>
        <SettingsProvider>
          <AppContent />
        </SettingsProvider>
      </BranchProvider>
    </AuthProvider>
  );
}
