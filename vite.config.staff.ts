// Tier 5.B — Vite config for the StockFlow Staff APK (cl.stockflow.staff).
//
// Outputs to dist-staff/. Consumed by capacitor.staff.config.ts → android-staff/.
// Entry: index-staff.html → src/main-staff.tsx → src/apps/staff/AppShell.tsx.

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    plugins: [react(), tailwindcss()],
    define: {
      "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY),
      "process.env.GOOGLE_MAPS_PLATFORM_KEY": JSON.stringify(env.GOOGLE_MAPS_PLATFORM_KEY || env.VITE_GOOGLE_MAPS_PLATFORM_KEY || ""),
      __APP_VARIANT__: JSON.stringify("staff"),
    },
    resolve: {
      alias: { "@": path.resolve(__dirname, ".") },
    },
    build: {
      outDir: "dist-staff",
      emptyOutDir: true,
      rollupOptions: {
        input: path.resolve(__dirname, "index-staff.html"),
        output: {
          manualChunks: {
            "vendor-firebase": ["firebase/app", "firebase/auth", "firebase/firestore", "firebase/storage", "firebase/functions"],
            "vendor-recharts": ["recharts"],
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
