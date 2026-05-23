import React from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Layout } from "../../shared/components/Layout";
import { motion, AnimatePresence } from "motion/react";

// Lazy load individual page components to split the admin route chunk into smaller assets (~100-200 KB each)
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

export function AdminRoutes() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Seller always gets the MobilePOS view!
  // No full desktop layout or sidebars for sellers - exactly what the CEO wanted
  if (profile?.role === "seller") {
    return (
      <React.Suspense fallback={
        <div className="flex h-screen items-center justify-center bg-gray-50">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent shadow-md"></div>
        </div>
      }>
        <Routes>
          <Route path="/" element={<MobilePOS />} />
          <Route path="/mobile" element={<MobilePOS />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </React.Suspense>
    );
  }

  // Pure Mobile POS Route for others (no sidebar/layout)
  if (location.pathname === "/mobile") {
    return (
      <React.Suspense fallback={
        <div className="flex h-screen items-center justify-center bg-gray-50">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent shadow-md"></div>
        </div>
      }>
        <MobilePOS />
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
          <React.Suspense fallback={
            <div className="flex h-[60vh] items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent shadow-md"></div>
            </div>
          }>
            <Routes>
              <Route path="/" element={<Dashboard onNavigate={handleNavigate} />} />
              <Route path="/dashboard" element={<Dashboard onNavigate={handleNavigate} />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/logistics" element={<Logistics onNavigate={handleNavigate} />} />
              <Route path="/pos" element={<POS />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/kardex" element={<StockLedger />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </React.Suspense>
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}
