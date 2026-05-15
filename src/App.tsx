/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Login } from "./components/Login";
import { VerifyEmail } from "./components/VerifyEmail";
import { Dashboard } from "./components/Dashboard";
import { Inventory } from "./components/Inventory";
import { POS } from "./components/POS";
import { Transactions } from "./components/Transactions";
import { Suppliers } from "./components/Suppliers";
import { Expenses } from "./components/Expenses";
import { Settings } from "./components/Settings";
import { Layout } from "./components/Layout";
import { FlowResult } from "./components/FlowResult";
import { StockLedger } from "./components/StockLedger";
import { Logistics } from "./components/Logistics";
import { SettingsProvider } from "./contexts/SettingsContext";
import { motion, AnimatePresence } from "motion/react";

type Page = "dashboard" | "inventory" | "pos" | "transactions" | "suppliers" | "expenses" | "settings" | "kardex" | "logistics";

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");

  // Handle Flow Result Path
  if (window.location.pathname === "/flow-result") {
    return <FlowResult />;
  }

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

  if (!user.emailVerified) {
    return <VerifyEmail />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard onNavigate={setCurrentPage} />;
      case "inventory":
        return <Inventory />;
      case "logistics":
        return <Logistics />;
      case "pos":
        return <POS />;
      case "transactions":
        return <Transactions />;
      case "suppliers":
        return <Suppliers />;
      case "expenses":
        return <Expenses />;
      case "settings":
        return <Settings />;
      case "kardex":
        return <StockLedger />;
      default:
        return <Dashboard />;
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
          className="container mx-auto p-4 md:p-6"
        >
          {renderPage()}
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
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
