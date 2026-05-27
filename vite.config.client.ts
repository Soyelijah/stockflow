// Tier 5.B — Vite config for the Sf Client APK (cl.sfclient.app).
//
// Outputs to dist-client/. Consumed by capacitor.client.config.ts → android-client/.
// Entry: index-client.html → src/main-client.tsx → src/apps/client/AppShell.tsx.
//
// Bundle expectation: significantly smaller than staff (no AdminRoutes,
// no DeliveryRoutes, no admin AI / shrinkage / kardex code). Bundle
// assertion script in scripts/bundle-check.cjs verifies it post-build.

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    plugins: [react(), tailwindcss()],
    define: {
      // Client never calls AI insights; GEMINI key is intentionally omitted
      // from the bundle to make it explicit that this APK has no LLM surface.
      "process.env.GEMINI_API_KEY": JSON.stringify(""),
      "process.env.GOOGLE_MAPS_PLATFORM_KEY": JSON.stringify(env.GOOGLE_MAPS_PLATFORM_KEY || env.VITE_GOOGLE_MAPS_PLATFORM_KEY || ""),
      __APP_VARIANT__: JSON.stringify("client"),
    },
    resolve: {
      alias: { "@": path.resolve(__dirname, ".") },
    },
    build: {
      outDir: "dist-client",
      emptyOutDir: true,
      rollupOptions: {
        input: path.resolve(__dirname, "index-client.html"),
        output: {
          manualChunks: {
            "vendor-firebase": ["firebase/app", "firebase/auth", "firebase/firestore", "firebase/storage", "firebase/functions"],
            "vendor-motion": ["motion/react"],
          },
        },
      },
    },
    server: {
      hmr: false,
      watch: process.env.DISABLE_HMR === "true" ? null : {},
    },
  };
});
