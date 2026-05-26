// Multi-branch foundation (Tier 1.0).
// Branches are the per-store partitioning. A retailer can have N branches.
// Some users are pinned to one branch (manager, seller, driver) and others
// are cross-branch (admin, owner, logistics by default).

import { UserRole } from "./roles";

export const DEFAULT_BRANCH_ID = "default";
export const CROSS_BRANCH_SENTINEL = "*";

export interface Branch {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  businessHours?: string;
  geolocation?: { lat: number; lng: number } | null;
  active: boolean;
  managerUserId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// True if the branchId means "all branches" (cross-branch authority).
export function isCrossBranch(branchId: string | null | undefined): boolean {
  return branchId === CROSS_BRANCH_SENTINEL;
}

// True if the user holding `userBranchId` can read/write data scoped to `targetBranchId`.
// Used in UI as a defensive client-side check. Authoritative enforcement happens in Firestore rules.
export function canAccessBranch(
  userBranchId: string | null | undefined,
  targetBranchId: string | null | undefined
): boolean {
  if (!userBranchId || !targetBranchId) return false;
  if (isCrossBranch(userBranchId)) return true;
  return userBranchId === targetBranchId;
}

// Default branch assignment when a role is created without an explicit branchId.
// Admin/owner/logistics get "*" (cross-branch). Everyone else lands on "default" sentinel.
// Logistics is cross-branch per Tier 1 design decision §4.1.
export function defaultBranchForRole(role: UserRole | string | undefined | null): string {
  if (!role) return DEFAULT_BRANCH_ID;
  if (role === "admin" || role === "owner" || role === "logistics") {
    return CROSS_BRANCH_SENTINEL;
  }
  return DEFAULT_BRANCH_ID;
}

// Human-readable label for a branchId in UI badges/dropdowns.
// Falls back to a localized "Todas las sucursales" / "Sucursal Principal" if no branch metadata is available yet.
export function branchLabel(branchId: string | null | undefined, branches: Branch[]): string {
  if (!branchId) return "Sin sucursal";
  if (isCrossBranch(branchId)) return "Todas las sucursales";
  const match = branches.find((b) => b.id === branchId);
  if (match) return match.name;
  if (branchId === DEFAULT_BRANCH_ID) return "Sucursal Principal";
  return branchId;
}
