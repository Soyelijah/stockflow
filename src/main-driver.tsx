// Tier 5.B — Entry point for the Sf Driver APK (cl.sfdriver.app).
// Bundled by vite.config.driver.ts, NOT included in StockFlow or Sf Client builds.
//
// Driver APK keeps BranchProvider because drivers operate per-branch
// (route assignments are scoped). It does NOT need SettingsProvider —
// driver UX is mostly map + scan + signature; settings are operator-managed
// in the staff app.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MotionConfig } from "motion/react";
import { AuthProvider } from "./contexts/AuthContext";
import { BranchProvider } from "./contexts/BranchContext";
import { AppShell } from "./apps/driver/AppShell";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <MotionConfig reducedMotion="user" transition={{ type: "tween", ease: [0.32, 0.72, 0, 1], duration: 0.35 }}>
        <AuthProvider>
          <BranchProvider>
            <AppShell />
          </BranchProvider>
        </AuthProvider>
      </MotionConfig>
    </BrowserRouter>
  </StrictMode>,
);
