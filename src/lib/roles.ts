export const ROLES = [
  "owner",
  "admin",
  "manager",
  "seller",
  "logistics",
  "driver"
] as const;

export type UserRole = typeof ROLES[number];

/**
 * Checks if a role is the owner (super-admin).
 */
export function isOwner(role?: string | null): boolean {
  return role === "owner";
}

/**
 * Checks if a role has admin-level access (owner or admin).
 */
export function isAdmin(role?: string | null): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Checks if a role has general management access (owner, admin, or manager).
 */
export function isAdminOrManager(role?: string | null): boolean {
  return role === "owner" || role === "admin" || role === "manager";
}

/**
 * Checks if a role has logistics access.
 */
export function isLogistics(role?: string | null): boolean {
  return role === "owner" || role === "admin" || role === "manager" || role === "logistics";
}

/**
 * Checks if a role has seller/POS access.
 */
export function isSeller(role?: string | null): boolean {
  return role === "owner" || role === "admin" || role === "manager" || role === "seller";
}
