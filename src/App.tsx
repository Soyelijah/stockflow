import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { Login } from "./components/Login";
import { VerifyEmail } from "./components/VerifyEmail";

const StoreApp = React.lazy(() => import('./apps/store/routes'));
const FlowResultApp = React.lazy(() => import('./apps/store/pages/FlowResult').then(m => ({ default: m.FlowResult })));
const AdminApp = React.lazy(() => import('./apps/admin/routes'));
const DeliveryApp = React.lazy(() => import('./apps/delivery/routes'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent shadow-md"></div>
      </div>
    );
  }

  if (!user || !profile) return <Login />;
  if (!user.emailVerified) return <VerifyEmail />;
  
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <BrowserRouter>
          <Suspense fallback={
            <div className="flex h-screen items-center justify-center bg-gray-50">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent shadow-md"></div>
            </div>
          }>
            <Routes>
              {/* Public Routes */}
              <Route path="/cliente/*" element={<StoreApp />} />
              <Route path="/flow-result" element={<FlowResultApp />} />

              {/* Protected Routes */}
              <Route path="/driver/*" element={<ProtectedRoute><DeliveryApp /></ProtectedRoute>} />
              <Route path="/repartidor/*" element={<ProtectedRoute><DeliveryApp /></ProtectedRoute>} />
              
              {/* Admin/Default Protected Route */}
              <Route path="/*" element={<ProtectedRoute><AdminApp /></ProtectedRoute>} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </SettingsProvider>
    </AuthProvider>
  );
}
