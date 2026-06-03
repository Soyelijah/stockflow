import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | undefined | null) {
  const value = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatRUT(value: string) {
  // Remove any character that is not a digit or k/K
  let cleanValue = value.replace(/[^0-9kK]/g, "");
  
  if (cleanValue.length === 0) return "";
  
  // Limit to 9 characters (max RUT length)
  cleanValue = cleanValue.slice(0, 9);
  
  const dv = cleanValue.slice(-1);
  const body = cleanValue.slice(0, -1);
  
  if (body.length === 0) return dv.toUpperCase();
  
  // Reverse body to add dots every 3 digits
  let formattedBody = body
    .split("")
    .reverse()
    .join("")
    .replace(/(?=\d*\.?)(\d{3})/g, "$1.")
    .split("")
    .reverse()
    .join("");
    
  // Remove leading dot if it exists
  if (formattedBody.startsWith(".")) {
    formattedBody = formattedBody.slice(1);
  }

  return `${formattedBody}-${dv.toUpperCase()}`;
}

/**
 * Lenient, format-only RUT check (NO módulo-11 check-digit enforcement).
 *
 * Use this for flows that MATCH an already-stored RUT — account activation and
 * claim filing — never for minting a brand-new identity. Legacy/migrated
 * customer records (imported from the physical-store POS) can carry a RUT whose
 * verifier digit predates validation, e.g. the seed record "12.345.678-9". The
 * server (`/api/customer/activate-request`) performs the authoritative,
 * check-digit-agnostic match and returns a uniform anti-enumeration response, so
 * a strict client-side module-11 gate would only lock those real customers out
 * of their own data — which is exactly the bug it used to cause.
 *
 * Accepts a 6–8 digit body followed by a single verifier (0-9 or K); tolerant of
 * dots, dashes and whitespace.
 */
export function isValidRUTFormat(rut: string): boolean {
  if (!rut) return false;
  const clean = rut.replace(/[.\-\s]/g, "").toUpperCase();
  if (clean.length < 7 || clean.length > 9) return false;
  const body = clean.slice(0, -1);
  const verifier = clean.slice(-1);
  return /^\d+$/.test(body) && /^[0-9K]$/.test(verifier);
}

export function formatChileanPhone(value: string) {
  // Remove non-digits
  let cleanValue = value.replace(/\D/g, "");
  
  // If user included 56 at the start, remove it to normalize
  if (cleanValue.startsWith("56")) {
    cleanValue = cleanValue.slice(2);
  }
  
  // Limit to 9 digits (standard Chilean mobile/fixed length)
  cleanValue = cleanValue.slice(0, 9);
  
  if (cleanValue.length === 0) return "+56 ";
  
  // Format as +56 9 XXXX XXXX or similar
  // Usually it's +56 9 1234 5678
  let formatted = "+56 ";
  if (cleanValue.length > 0) {
    formatted += cleanValue.slice(0, 1);
  }
  if (cleanValue.length > 1) {
    formatted += " " + cleanValue.slice(1, 5);
  }
  if (cleanValue.length > 5) {
    formatted += " " + cleanValue.slice(5, 9);
  }
  
  return formatted;
}

export function formatNumber(value: number | undefined | null) {
  const num = typeof value === 'number' && !isNaN(value) ? value : 0;
  return Math.round(num).toLocaleString("es-CL");
}

export const LOYALTY_TIERS = {
  PLATINUM: { min: 5000, name: "Platinum", color: "text-indigo-400", bg: "bg-slate-900", textColor: "text-white", segment: "vip" },
  GOLD: { min: 2000, name: "Gold", color: "text-amber-500", bg: "bg-amber-50", textColor: "text-slate-900", segment: "vip" },
  SILVER: { min: 500, name: "Silver", color: "text-slate-500", bg: "bg-slate-100", textColor: "text-slate-900", segment: "regular" },
  BRONZE: { min: 0, name: "Bronze", color: "text-orange-700", bg: "bg-orange-50", textColor: "text-slate-900", segment: "regular" }
};

export function getCustomerTier(points: number = 0) {
  if (points >= LOYALTY_TIERS.PLATINUM.min) return LOYALTY_TIERS.PLATINUM;
  if (points >= LOYALTY_TIERS.GOLD.min) return LOYALTY_TIERS.GOLD;
  if (points >= LOYALTY_TIERS.SILVER.min) return LOYALTY_TIERS.SILVER;
  return LOYALTY_TIERS.BRONZE;
}

export function toDate(timestamp: any): Date {
  if (!timestamp) return new Date();
  if (typeof timestamp.toDate === "function") return timestamp.toDate();
  if (timestamp.seconds !== undefined) return new Date(timestamp.seconds * 1000);
  if (timestamp instanceof Date) return timestamp;
  return new Date(timestamp);
}

export function calculatePoints(amount: number) {
  return Math.floor(amount / 1000); // 1 point per $1000 CLP
}

export function getHealthStatus(lastTxDate?: any) {
  if (!lastTxDate) return { label: "Sin Datos", color: "text-slate-400" };
  const date = lastTxDate.toDate ? lastTxDate.toDate() : new Date(lastTxDate);
  const diff = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  
  if (diff > 90) return { label: "Crítico", color: "text-rose-600", level: 3 };
  if (diff > 45) return { label: "En Riesgo", color: "text-amber-600", level: 2 };
  return { label: "Saludable", color: "text-emerald-600", level: 1 };
}

export function formatDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

// Sprint 20 — input length caps (defense against accidental or malicious mega-strings).
// Used as `maxLength` on <input> and <textarea> in forms. Trims at the browser before submit.
export const INPUT_MAX = {
  NAME: 120,
  EMAIL: 254,
  PHONE: 20,
  RUT: 12,
  ADDRESS: 200,
  SHORT_TEXT: 80,
  URL: 2048,
  NOTES: 1000,
  DESCRIPTION: 500,
  PASSWORD: 72,
} as const;

// Sprint 20 — normalize a RUT for search/comparison (strip dots/dashes/spaces, uppercase).
// Use on BOTH sides of the comparison so "12.345.678-9" matches stored "123456789".
export function normalizeRutForSearch(s: string): string {
  return (s || "").replace(/[^0-9kK]/g, "").toUpperCase();
}

// Sprint 20 — defense-in-depth email cleaner.
// Use at point of consumption (storage, comparison) even when source is supposed to be normalized.
export function cleanEmail(s: string | null | undefined): string {
  return (s || "").trim().toLowerCase();
}
