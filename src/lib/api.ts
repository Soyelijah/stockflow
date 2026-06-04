// Connectivity bridge for the Express backend (/api/*).
//
// THE PROBLEM. On the web the SPA is served by the same Express server that owns
// /api/*, so a relative `fetch("/api/...")` hits the right origin. Inside the
// Capacitor APK there is NO Express: the webview serves static assets from
// `https://localhost` (capacitor.*.config.ts → androidScheme: "https", no
// server.url), so a relative `fetch("/api/...")` resolves to the local static
// server and never reaches Cloud Run. Every customer server feature (secure-pin,
// claim, activate-request, flow create-payment / payment-status) silently fails
// closed in the APK as a result.
//
// THE FIX. Route /api/* through apiUrl():
//   - Web (Capacitor.isNativePlatform() === false): return the path unchanged →
//     relative request, same origin, existing behavior preserved (dev included).
//   - Native APK: prefix with VITE_API_BASE (the Cloud Run origin) so the request
//     crosses to the real backend. Server CORS already allowlists https://localhost,
//     and these endpoints authenticate via `Authorization: Bearer <idToken>`
//     (header, not cookies), so the cross-origin call is accepted.
//
// VITE_API_BASE is a build-time public URL (not a secret). Set it only for APK
// builds (e.g. VITE_API_BASE=https://ais-dev-…run.app for debug). When unset the
// helper is a no-op and everything stays relative — so a misconfigured web build
// can never accidentally point at Cloud Run.
import { Capacitor } from "@capacitor/core";

const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/+$/, "");

/**
 * Resolve an /api path to the correct absolute/relative URL for the current
 * runtime. Web → relative (same origin). Native APK → VITE_API_BASE-prefixed.
 *
 * @param path e.g. "/api/customer/secure-pin" (a leading slash is enforced).
 */
export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return Capacitor.isNativePlatform() ? `${API_BASE}${normalized}` : normalized;
}
