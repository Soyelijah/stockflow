// Tier 5.B — Vite config for the Sf Driver APK (cl.sfdriver.app).
//
// Outputs to dist-driver/. Consumed by capacitor.driver.config.ts → android-driver/.
// Entry: index-driver.html → src/main-driver.tsx → src/apps/driver/AppShell.tsx.
//
// Driver APK keeps vendor-maps (Google Maps) because DeliveryRoutes is
// mostly map-driven. Drops vendor-recharts (no charts) and AI integrations.

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    plugins: [react(), tailwindcss()],
    define: {
      "process.env.GEMINI_API_KEY": JSON.stringify(""),
      "process.env.GOOGLE_MAPS_PLATFORM_KEY": JSON.stringify(env.GOOGLE_MAPS_PLATFORM_KEY || env.VITE_GOOGLE_MAPS_PLATFORM_KEY || ""),
      __APP_VARIANT__: JSON.stringify("driver"),
    },
    resolve: {
      alias: { "@": path.resolve(__dirname, ".") },
    },
    build: {
      outDir: "dist-driver",
      emptyOutDir: true,
      rollupOptions: {
        input: path.resolve(__dirname, "index-driver.html"),
        output: {
          manualChunks: {
            "vendor-firebase": ["firebase/app", "firebase/auth", "firebase/firestore", "firebase/storage", "firebase/functions"],
            "vendor-motion": ["motion/react"],
            "vendor-maps": ["@vis.gl/react-google-maps"],
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
