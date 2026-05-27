import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  onAuthStateChanged, 
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut
} from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { defaultBranchForRole } from "../lib/branches";

interface UserProfile {
  uid: string;
  email: string | null;
  role: "admin" | "manager" | "seller" | "logistics" | "driver" | "owner";
  // Multi-branch (Tier 1.0): the branch this user is pinned to, or "*" for cross-branch roles.
  // Profile field is a mirror; the authoritative source is the Firebase custom claim `branchId`.
  // May be missing for legacy users until migrate-users-add-branchid runs.
  branchId?: string;
  name: string;
  photoURL?: string;
  avatarUrl?: string;
  phone?: string;
  rut?: string;
  birthday?: string;
  address?: string;
  createdAt?: string;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  // Tier 5.B fix: expose the custom-claim role directly so AppShells can
  // distinguish "authenticated but not staff" from "not authenticated" without
  // relying on the /users mirror (which doesn't exist for customers/drivers
  // on the staff app path).
  claimRole: string | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, name: string, role?: "admin" | "manager" | "seller" | "logistics" | "driver" | "owner") => Promise<void>;
  sendVerification: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [claimRole, setClaimRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);

      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (!authUser) {
        setClaimRole(null);
      }

      if (authUser) {
        // Tier 5.A4.5: trust the Firebase custom claim as the SOLE source of role.
        //
        // What we removed (and why):
        //   - Auto-provisioning of role:"seller" when /users/{uid} did not exist.
        //     Any authenticated email landing on /login became a seller in /users,
        //     which is exactly the privilege-escalation vector that closed in
        //     Sprint 21 for /customers — re-introduced here via the staff path.
        //   - Email backdoors for "admin@stockflow.com", ".sandbox", "-demo"
        //     variants of every role. Same anti-pattern as CLAUDE.md §11.2.
        //   - Auto-write to /users/{uid} from the client. The Cloud Function
        //     setUserRole + scripts/bootstrap-admin are the only authorized
        //     writers of role + mirror; the client must NEVER do it on its own.
        let resolvedClaim: string | null = null;
        try {
          const tokenResult = await authUser.getIdTokenResult();
          resolvedClaim = typeof tokenResult.claims.role === "string" ? tokenResult.claims.role : null;
        } catch (e) {
          console.error("AuthContext: failed reading token claim:", e);
        }
        // Publish the claim to consumers BEFORE we make any further decisions
        // so AppShells can distinguish customer/driver/no-claim from "not auth'd".
        setClaimRole(resolvedClaim);

        // Customers do not live in /users — they live in /customers and the
        // CustomerPortal hydrates its own profile via its own listener. The
        // staff AuthProvider must not attempt to read /users for them (it
        // would always be a no-op and the listener would consume reads
        // forever). Just clear staff profile and let the customer flow run.
        if (resolvedClaim === "customer") {
          setProfile(null);
          setLoading(false);
          return;
        }

        const validStaffRoles = ["owner", "admin", "manager", "seller", "logistics", "driver"];
        if (!resolvedClaim || !validStaffRoles.includes(resolvedClaim)) {
          // Authenticated but with no staff role claim. This used to silently
          // create a seller doc; now it surfaces as "no profile" so the staff
          // app can render an unauthorized message + logout button.
          console.warn(`AuthContext: authenticated user ${authUser.email} has no staff role claim (claim="${resolvedClaim}"). Not provisioning anything.`);
          setProfile(null);
          setLoading(false);
          return;
        }

        // Valid staff claim → subscribe to the mirror doc for UI fields
        // (name, photo, etc). If the doc is missing despite a valid claim,
        // surface it as a no-profile state (operator should investigate;
        // could mean the bootstrap script wrote the claim but the mirror
        // write failed). DO NOT auto-create.
        const docRef = doc(db, "users", authUser.uid);
        unsubscribeProfile = onSnapshot(
          docRef,
          (docSnap) => {
            if (!docSnap.exists()) {
              console.warn(
                `AuthContext: staff claim "${resolvedClaim}" present for ${authUser.email} but /users/${authUser.uid} missing. Mirror inconsistency — surfacing as no-profile.`
              );
              setProfile(null);
              setLoading(false);
              return;
            }
            const profileData = docSnap.data() as UserProfile;
            // Trust the claim, not the mirror. If they disagree (e.g. mirror was
            // edited via Firebase Console without updating the claim), prefer the
            // claim. UI fields like name/photo still come from the mirror.
            if (profileData.role !== resolvedClaim) {
              console.warn(
                `AuthContext: mirror/claim role mismatch for ${authUser.email}: mirror="${profileData.role}" claim="${resolvedClaim}". Trusting claim.`
              );
              profileData.role = resolvedClaim as UserProfile["role"];
            }
            setProfile(profileData);
            setLoading(false);
          },
          (error) => {
            console.error("AuthContext: profile listener error:", error);
            setLoading(false);
          }
        );
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const login = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err: any) {
      if (err.code === "auth/operation-not-allowed") {
        throw new Error("El proveedor de Email/Password no está habilitado en Firebase Console. Por favor, actívelo.");
      }
      throw err;
    }
  };
  
  const register = async (email: string, pass: string, name: string, role: "admin" | "manager" | "seller" | "logistics" | "driver" | "owner" | "customer" = "seller") => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);

    // Send verification email
    await sendEmailVerification(userCredential.user);

    const safeRole = (role === "admin" || role === "owner" || role === "logistics" || role === "manager")
      ? "customer"
      : (role as any);

    const profileData: UserProfile = {
      uid: userCredential.user.uid,
      email,
      role: safeRole,
      // Multi-branch: customers and sellers default to the main branch; logistics/admin/owner
      // are cross-branch ("*"). Note: client-side write of branchId is a hint only — the
      // authoritative claim is set server-side by setUserRole or bootstrap-admin.
      branchId: defaultBranchForRole(safeRole),
      name
    };

    await setDoc(doc(db, "users", userCredential.user.uid), {
      ...profileData,
      createdAt: new Date().toISOString()
    });
    setProfile(profileData);
  };

  const sendVerification = async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const refreshUser = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      setUser({...auth.currentUser});
    }
  };

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      claimRole,
      loading,
      login,
      register,
      sendVerification,
      sendPasswordReset,
      refreshUser,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
