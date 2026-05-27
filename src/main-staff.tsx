// Tier 5.B — Entry point for the StockFlow Staff APK (cl.stockflow.staff).
// Bundled by vite.config.staff.ts, NOT included in Sf Client or Sf Driver builds.
//
// Composition order matches the legacy src/main.tsx so existing context
// expectations (BranchProvider depends on AuthProvider, etc.) are preserved.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MotionConfig } from "motion/react";
import { AuthProvider } from "./contexts/AuthContext";
import { BranchProvider } from "./contexts/BranchContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { AppShell } from "./apps/staff/AppShell";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <BranchProvider>
            <SettingsProvider>
              <AppShell />
            </SettingsProvider>
          </BranchProvider>
        </AuthProvider>
      </MotionConfig>
    </BrowserRouter>
  </StrictMode>,
);
