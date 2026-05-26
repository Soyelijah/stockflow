export type UserRole = "admin" | "manager" | "seller" | "logistics" | "driver" | "owner" | "customer";

export const ROLES_WHITELIST: UserRole[] = ["admin", "manager", "seller", "logistics", "driver", "owner"];

const STAFF_ROLES: ReadonlySet<string> = new Set<string>([
  "owner", "admin", "manager", "seller", "logistics", "driver"
]);

export function isOwner(role: string | null | undefined): boolean {
  return role === "owner";
}

export function isAdmin(role: string | null | undefined): boolean {
  return role === "admin" || role === "owner";
}

export function isManager(role: string | null | undefined): boolean {
  return role === "manager";
}

export function isAdminOrManager(role: string | null | undefined): boolean {
  return role === "admin" || role === "manager" || role === "owner";
}

export function isSeller(role: string | null | undefined): boolean {
  return role === "seller";
}

export function isLogistics(role: string | null | undefined): boolean {
  return role === "logistics";
}

export function isDriver(role: string | null | undefined): boolean {
  return role === "driver";
}

export function isCustomer(role: string | null | undefined): boolean {
  return role === "customer";
}

export function isStaff(role: string | null | undefined): boolean {
  return typeof role === "string" && STAFF_ROLES.has(role);
}
