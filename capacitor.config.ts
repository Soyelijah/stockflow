// Capacitor configuration for the native Android wrap of the StockFlow PWA.
// This wraps the existing React + Vite SPA inside a native Android webview,
// producing an installable .apk for sideloading or eventual Play Store distribution.
//
// Workflow (after `pnpm install` of the Capacitor packages):
//   1. `npx cap add android`        — one-time scaffolding of the /android Gradle project.
//   2. `pnpm cap:sync`              — builds web assets + copies them into /android/app/src/main/assets/public.
//   3. `pnpm apk:debug`             — produces /android/app/build/outputs/apk/debug/app-debug.apk.
//   4. `pnpm apk:release`           — produces signed APK (requires keystore configuration).
//
// See docs/APK.md for the full step-by-step including device install.

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // Reverse-DNS identifier used by Android's package manager. Must be globally unique
  // on Play Store, lowercase, no dashes. Once the app is published this CANNOT change
  // without losing existing installs — pick carefully.
  appId: "cl.stockflow.app",

  // Display name shown on the home screen launcher + system app list.
  appName: "StockFlow",

  // Web assets directory — Capacitor copies everything here into the native APK on `cap sync`.
  // pnpm build outputs to ./dist (Vite default + the esbuild server bundle). The native
  // webview only loads index.html + /assets/*, so the server.cjs file is shipped but unused.
  // ~70KB waste, acceptable for MVP. Tier 3.1 can split web output to dist/web/ to clean this.
  webDir: "dist",

  server: {
    // Required for cookies, Firebase Auth state persistence, and Service Worker compatibility
    // when the webview serves from the local capacitor:// scheme. Without this the auth flow
    // would break because the webview origin would not match Firebase's allowed domains.
    androidScheme: "https",
  },

  // Future plugin configuration goes here (Tier 3.1+):
  //   - @capacitor/push-notifications for native FCM (replaces the web SW for mobile)
  //   - @capacitor/geolocation for the Driver app GPS (currently uses browser API)
  //   - @capacitor/preferences for native key-value storage (replaces localStorage fallbacks)
  //   - @capacitor/splash-screen for branded splash
};

export default config;
