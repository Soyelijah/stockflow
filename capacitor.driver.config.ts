// Tier 5.B — Capacitor config for the Sf Driver APK (delivery / map flows).
// Outputs to android-driver/. Built via `pnpm apk:driver`.

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "cl.sfdriver.app",
  appName: "Sf Driver",
  webDir: "dist-driver",
  server: {
    androidScheme: "https",
  },
  android: {
    path: "android-driver",
  },
};

export default config;
