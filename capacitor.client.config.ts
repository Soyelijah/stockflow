// Tier 5.B — Capacitor config for the Sf Client APK (customer-facing).
// Outputs to android-client/. Built via `pnpm apk:client`.

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "cl.sfclient.app",
  appName: "Sf Client",
  webDir: "dist-client",
  server: {
    androidScheme: "https",
  },
  android: {
    path: "android-client",
  },
};

export default config;
