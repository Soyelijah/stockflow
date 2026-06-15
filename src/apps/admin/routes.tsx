import React from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Layout } from "../../shared/components/Layout";
import { motion, AnimatePresence } from "motion/react";
import { RouteGuard } from "../../shared/components/RouteGuard";

// Lazy-load page components per-route for fine-grained code-splitting.
// Without this, all admin pages (~12 components) ship in a single chunk.
const Dashboard = React.lazy(() => import("../../shared/components/Dashboard").then(m => ({ default: m.Dashboard })));
const Inventory = React.lazy(() => import("../../shared/components/Inventory").then(m => ({ default: m.Inventory })));
const POS = React.lazy(() => import("../../shared/components/POS").then(m => ({ default: m.POS })));
const Transactions = React.lazy(() => import("../../shared/components/Transactions").then(m => ({ default: m.Transactions })));
const Suppliers = React.lazy(() => import("../../shared/components/Suppliers").then(m => ({ default: m.Suppliers })));
const Expenses = React.lazy(() => import("../../shared/components/Expenses").then(m => ({ default: m.Expenses })));
const Settings = React.lazy(() => import("../../shared/components/Settings").then(m => ({ default: m.Settings })));
const StockLedger = React.lazy(() => import("../../shared/components/StockLedger").then(m => ({ default: m.StockLedger })));
const Logistics = React.lazy(() => import("../../shared/components/Logistics").then(m => ({ default: m.Logistics })));
const Customers = React.lazy(() => import("../../shared/components/Customers").then(m => ({ default: m.Customers })));
const Profile = React.lazy(() => import("../../shared/components/Profile").then(m => ({ default: m.Profile })));
const MobilePOS = React.lazy(() => import("../../shared/components/MobilePOS").then(m => ({ default: m.MobilePOS })));
const RoleMobileShell = React.lazy(() => import("../../shared/components/RoleMobileShell").then(m => ({ default: m.RoleMobileShell })));
const ShrinkageReport = React.lazy(() => import("../../shared/components/ShrinkageReport").then(m => ({ default: m.ShrinkageReport })));

const PageFallback = () => (
  <div className="flex h-[60vh] items-center justify-center">
    <div className="size-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent shadow-md"></div>
  </div>
);

export function AdminRoutes() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Seller always gets the MobilePOS view!
  // No full desktop layout or sidebars for sellers - exactly what the CEO wanted
  if (profile?.role === "seller") {
    return (
      <React.Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<MobilePOS />} />
          <Route path="/mobile" element={<MobilePOS />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </React.Suspense>
    );
  }

  // Staff mobile surfaces from design handoff: manager, logistics and admin use
  // dedicated role shells instead of the desktop Layout.
  if (profile?.role === "manager" || profile?.role === "logistics" || profile?.role === "admin") {
    return (
      <React.Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/*" element={<RoleMobileShell />} />
        </Routes>
      </React.Suspense>
    );
  }

  // Pure Mobile POS Route for others (no sidebar/layout)
  if (location.pathname === "/mobile") {
    return (
      <React.Suspense fallback={<PageFallback />}>
        <RouteGuard allowedRoles={["admin", "manager", "seller"]}>
          <MobilePOS />
        </RouteGuard>
      </React.Suspense>
    );
  }

  // Map path to a page label/string for navbar highlight
  let currentPage = "dashboard";
  const path = location.pathname;
  if (path.startsWith("/inventory")) currentPage = "inventory";
  else if (path.startsWith("/logistics")) currentPage = "logistics";
  else if (path.startsWith("/pos")) currentPage = "pos";
  else if (path.startsWith("/transactions")) currentPage = "transactions";
  else if (path.startsWith("/suppliers")) currentPage = "suppliers";
  else if (path.startsWith("/expenses")) currentPage = "expenses";
  else if (path.startsWith("/settings")) currentPage = "settings";
  else if (path.startsWith("/shrinkage")) currentPage = "shrinkage";
  else if (path.startsWith("/kardex")) currentPage = "kardex";
  else if (path.startsWith("/customers")) currentPage = "customers";
  else if (path.startsWith("/profile")) currentPage = "profile";

  const handleNavigate = (page: string) => {
    if (page === "kardex") {
      navigate("/kardex");
    } else {
      navigate(`/${page}`);
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={handleNavigate}>
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="container mx-auto p-1 sm:p-4 md:p-6"
        >
          <React.Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<RouteGuard allowedRoles={["admin", "manager", "seller", "logistics"]}><Dashboard onNavigate={handleNavigate} /></RouteGuard>} />
              <Route path="/dashboard" element={<RouteGuard allowedRoles={["admin", "manager", "seller", "logistics"]}><Dashboard onNavigate={handleNavigate} /></RouteGuard>} />
              <Route path="/inventory" element={<RouteGuard allowedRoles={["admin", "manager", "logistics"]}><Inventory /></RouteGuard>} />
              <Route path="/logistics" element={<RouteGuard allowedRoles={["admin", "manager", "logistics"]}><Logistics onNavigate={handleNavigate} /></RouteGuard>} />
              <Route path="/pos" element={<RouteGuard allowedRoles={["admin", "manager", "seller"]}><POS /></RouteGuard>} />
              <Route path="/transactions" element={<RouteGuard allowedRoles={["admin", "manager", "seller"]}><Transactions /></RouteGuard>} />
              <Route path="/suppliers" element={<RouteGuard allowedRoles={["admin", "manager", "logistics"]}><Suppliers /></RouteGuard>} />
              <Route path="/expenses" element={<RouteGuard allowedRoles={["admin", "manager"]}><Expenses /></RouteGuard>} />
              <Route path="/settings" element={<RouteGuard allowedRoles={["admin"]}><Settings /></RouteGuard>} />
              <Route path="/kardex" element={<RouteGuard allowedRoles={["admin", "manager", "logistics"]}><StockLedger /></RouteGuard>} />
              <Route path="/customers" element={<RouteGuard allowedRoles={["admin", "manager", "seller"]}><Customers /></RouteGuard>} />
              <Route path="/shrinkage" element={<RouteGuard allowedRoles={["admin", "manager"]}><ShrinkageReport /></RouteGuard>} />
              <Route path="/profile" element={<RouteGuard allowedRoles={["admin", "manager", "seller", "logistics"]}><Profile /></RouteGuard>} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </React.Suspense>
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}
