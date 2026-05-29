// Tier 5.B — Entry point for the Sf Client APK (cl.sfclient.app).
// Bundled by vite.config.client.ts, NOT included in StockFlow or Sf Driver builds.
//
// Strictly smaller dependency surface than the staff entry:
//   - No AdminRoutes import (no admin/manager/seller/logistics UI).
//   - No DeliveryRoutes import (no map / GPS / driver UI).
//
// Tier 5.C.2 hotfix: BranchProvider re-added. The shared DeliveryMap (consumed
// from CustomerPortal "Despacho" tab) calls useBranch() unconditionally. Without
// the provider, opening the dispatch tab crashes the client with a runtime error.
// Resolver falls back to defaultBranchForRole(profile.role) for the customer role,
// so functional behaviour stays unchanged ("default" branch view).

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MotionConfig } from "motion/react";
import { AuthProvider } from "./contexts/AuthContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { BranchProvider } from "./contexts/BranchContext";
import { AppShell } from "./apps/client/AppShell";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <MotionConfig reducedMotion="user" transition={{ type: "tween", ease: [0.32, 0.72, 0, 1], duration: 0.35 }}>
        <AuthProvider>
          <SettingsProvider>
            <BranchProvider>
              <AppShell />
            </BranchProvider>
          </SettingsProvider>
        </AuthProvider>
      </MotionConfig>
    </BrowserRouter>
  </StrictMode>,
);
