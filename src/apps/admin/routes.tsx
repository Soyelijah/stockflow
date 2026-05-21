import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from './layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Inventory } from './pages/Inventory';
import { POS } from './pages/POS';
import { Transactions } from './pages/Transactions';
import { Suppliers } from './pages/Suppliers';
import { Expenses } from './pages/Expenses';
import { Settings } from './pages/Settings';
import { StockLedger } from './pages/StockLedger';
import { Logistics } from './pages/Logistics';
import { Customers } from './pages/Customers';
import { Profile } from './pages/Profile';
import { MobilePOS } from './pages/MobilePOS';
import { DriverPortal } from '../delivery/pages/DriverPortal';
import { RoleGuard } from '@/src/shared/ui/RoleGuard';
import { useAuth } from '@/src/contexts/AuthContext';
import { seedCouponsIfEmpty } from '@/src/lib/coupons';
import { motion, AnimatePresence } from 'motion/react';

type Page = "dashboard" | "inventory" | "pos" | "transactions" | "suppliers" | "expenses" | "settings" | "kardex" | "logistics" | "driver" | "customers" | "profile";

function AdminLegacyContent() {
  const { user, profile } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");

  useEffect(() => {
    if (user && (profile?.role === "admin" || profile?.role === "manager" || user.email === "solier.elijah@gmail.com")) {
      seedCouponsIfEmpty();
    }
  }, [user, profile]);

  useEffect(() => {
    setCurrentPage("dashboard");
  }, [user?.uid, profile?.role]);

  if (profile?.role === "seller") {
    return <MobilePOS />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard": return <Dashboard onNavigate={setCurrentPage} />;
      case "inventory": return <Inventory />;
      case "logistics": return <Logistics onNavigate={setCurrentPage} />;
      case "driver": return <DriverPortal onBackToDashboard={() => setCurrentPage("logistics")} />;
      case "pos": return <POS />;
      case "transactions": return <Transactions />;
      case "suppliers": return <Suppliers />;
      case "expenses": return <Expenses />;
      case "settings": return <Settings />;
      case "kardex": return <StockLedger />;
      case "customers": return <Customers />;
      case "profile": return <Profile />;
      default: return <Dashboard onNavigate={setCurrentPage} />;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPage}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="container mx-auto p-1 sm:p-4 md:p-6"
        >
          {renderPage()}
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}

export default function AdminRoutes() {
  return (
    <Routes>
      <Route element={<RoleGuard allowedRoles={['admin', 'manager', 'owner', 'logistics', 'inventory_manager', 'cashier', 'seller']} />}>
        <Route path="/*" element={<AdminLegacyContent />} />
      </Route>
    </Routes>
  );
}
