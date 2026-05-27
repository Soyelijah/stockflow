// Tier 5.B — Capacitor config for the StockFlow Staff APK.
// Outputs to android-staff/. Built via `pnpm apk:staff`.
//
// IMPORTANT: appId is the Android package name. Once shipped to Play Store,
// it CANNOT change without losing the existing install base. Picked carefully.

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "cl.stockflow.staff",
  appName: "StockFlow",
  webDir: "dist-staff",
  server: {
    androidScheme: "https",
  },
  android: {
    path: "android-staff",
  },
};

export default config;
