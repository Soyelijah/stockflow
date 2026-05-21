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
