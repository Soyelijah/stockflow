import React from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Dashboard } from "../../shared/components/Dashboard";
import { Inventory } from "../../shared/components/Inventory";
import { POS } from "../../shared/components/POS";
import { Transactions } from "../../shared/components/Transactions";
import { Suppliers } from "../../shared/components/Suppliers";
import { Expenses } from "../../shared/components/Expenses";
import { Settings } from "../../shared/components/Settings";
import { StockLedger } from "../../shared/components/StockLedger";
import { Logistics } from "../../shared/components/Logistics";
import { Customers } from "../../shared/components/Customers";
import { Profile } from "../../shared/components/Profile";
import { MobilePOS } from "../../shared/components/MobilePOS";
import { Layout } from "../../shared/components/Layout";
import { motion, AnimatePresence } from "motion/react";

export function AdminRoutes() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Seller always gets the MobilePOS view!
  // No full desktop layout or sidebars for sellers - exactly what the CEO wanted
  if (profile?.role === "seller") {
    return (
      <Routes>
        <Route path="/" element={<MobilePOS />} />
        <Route path="/mobile" element={<MobilePOS />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Pure Mobile POS Route for others (no sidebar/layout)
  if (location.pathname === "/mobile") {
    return <MobilePOS />;
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
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}
