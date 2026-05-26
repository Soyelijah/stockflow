import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "./AuthContext";
import {
  Branch,
  CROSS_BRANCH_SENTINEL,
  DEFAULT_BRANCH_ID,
  defaultBranchForRole,
  isCrossBranch,
} from "../lib/branches";

interface BranchContextType {
  // All active branches in the retailer. Populated for any signed-in user.
  // (Rules allow read for all signed-in users — branches are not sensitive metadata.)
  branches: Branch[];

  // The branch the current user is pinned to. "*" if cross-branch.
  // Authoritative source is the custom claim; this is the mirror from profile.
  myBranchId: string;

  // The branch currently selected for filtering data. For cross-branch users
  // this can be "*" (all branches) or a specific id. For pinned users it equals myBranchId.
  selectedBranchId: string;

  // Switch the selected branch. Non-cross-branch users cannot switch — call is a no-op.
  selectBranch: (id: string) => void;

  isCrossBranchUser: boolean;
  loading: boolean;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(DEFAULT_BRANCH_ID);
  const [loading, setLoading] = useState(true);

  // Resolve the user's pinned branch. Fall back to role-default if profile lacks the field
  // (legacy users created before Tier 1.0 won't have it until migrate-users-add-branchid runs).
  const myBranchId = useMemo(() => {
    if (!profile) return DEFAULT_BRANCH_ID;
    if (profile.branchId) return profile.branchId;
    return defaultBranchForRole(profile.role);
  }, [profile]);

  const isCrossBranchUser = isCrossBranch(myBranchId);

  // Initialize selected branch when the pinned branch resolves.
  useEffect(() => {
    if (isCrossBranchUser) {
      setSelectedBranchId(CROSS_BRANCH_SENTINEL);
    } else {
      setSelectedBranchId(myBranchId);
    }
  }, [myBranchId, isCrossBranchUser]);

  // Subscribe to active branches list.
  useEffect(() => {
    if (!profile) {
      setBranches([]);
      setLoading(false);
      return;
    }
    const q = query(collection(db, "branches"), where("active", "==", true));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Branch);
        setBranches(list);
        setLoading(false);
      },
      (err) => {
        // If rules deny (e.g., during the brief window before rules are pushed) we silently
        // fall back to an empty list. The badge will show "Sucursal Principal" or branchId raw.
        console.warn("[BranchContext] Could not subscribe to /branches:", err.message);
        setBranches([]);
        setLoading(false);
      }
    );
    return unsub;
  }, [profile]);

  const selectBranch = (id: string) => {
    // Pinned users cannot switch — keep them on their assigned branch.
    if (!isCrossBranchUser && id !== myBranchId) return;
    setSelectedBranchId(id);
  };

  return (
    <BranchContext.Provider
      value={{
        branches,
        myBranchId,
        selectedBranchId,
        selectBranch,
        isCrossBranchUser,
        loading,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const ctx = useContext(BranchContext);
  if (!ctx) {
    throw new Error("useBranch must be used within a BranchProvider");
  }
  return ctx;
}
