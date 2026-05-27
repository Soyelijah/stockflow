// Tier 5.B — Entry point for the Sf Client APK (cl.sfclient.app).
// Bundled by vite.config.client.ts, NOT included in StockFlow or Sf Driver builds.
//
// Strictly smaller dependency surface than the staff entry:
//   - No AdminRoutes import (no admin/manager/seller/logistics UI).
//   - No DeliveryRoutes import (no map / GPS / driver UI).
//   - No BranchProvider — customers are always on the "default" branch
//     conceptually; per-item branch is decided at checkout by FlowResult.
//     If we ever need per-branch view on the customer side (e.g. pickup
//     location selector), we add it locally inside the customer module.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MotionConfig } from "motion/react";
import { AuthProvider } from "./contexts/AuthContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { AppShell } from "./apps/client/AppShell";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <SettingsProvider>
            <AppShell />
          </SettingsProvider>
        </AuthProvider>
      </MotionConfig>
    </BrowserRouter>
  </StrictMode>,
);
