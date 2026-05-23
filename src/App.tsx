import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Login } from "./shared/components/Login";
import { VerifyEmail } from "./shared/components/VerifyEmail";
import { FlowResult } from "./shared/components/FlowResult";
import { SettingsProvider } from "./contexts/SettingsContext";
import { seedCouponsIfEmpty, seedCustomersIfEmpty } from "./lib/coupons";

// Import the sub-app routes
import { AdminRoutes } from "./apps/admin/routes";
import { StoreRoutes } from "./apps/store/routes";
import { DeliveryRoutes } from "./apps/delivery/routes";

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
    return <StoreRoutes />;
  }

  if (isFlowResultPath) {
    return <FlowResult />;
  }

  // Auth requirement for all core roles
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent shadow-md"></div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Login />;
  }

  // Bypass email verification for demo accounts and owner/reviewer to permit instant sandbox tests
  const isDemoEmail = user.email?.endsWith("@stockflow.com") || profile?.role === "owner";
  if (!user.emailVerified && !isDemoEmail) {
    return <VerifyEmail />;
  }

  // Multi-role routing based strictly on custom claim / profile role
  if (profile?.role === "driver") {
    return <DeliveryRoutes />;
  }

  // admin, manager, seller, logistics, owner roles get AdminRoutes
  return <AdminRoutes />;
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <AppContent />
      </SettingsProvider>
    </AuthProvider>
  );
}
