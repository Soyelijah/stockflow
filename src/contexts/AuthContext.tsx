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
import { UserRole } from "../lib/roles";

interface UserProfile {
  uid: string;
  email: string | null;
  role: UserRole;
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
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, name: string, role?: UserRole) => Promise<void>;
  sendVerification: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (authUser) {
        let isOwnerClaim = false;
        try {
          const tokenResult = await authUser.getIdTokenResult();
          isOwnerClaim = tokenResult.claims.role === "owner";
        } catch (e) {
          console.error("Error reading token result:", e);
        }

        const docRef = doc(db, "users", authUser.uid);
        
        unsubscribeProfile = onSnapshot(docRef, async (docSnap) => {
          let needsUpdate = false;
          let profileData: UserProfile;

          if (docSnap.exists()) {
            profileData = docSnap.data() as UserProfile;
          } else {
            profileData = {
              uid: authUser.uid,
              email: authUser.email,
              role: isOwnerClaim ? "owner" : "seller",
              name: authUser.displayName || "Usuario",
              createdAt: new Date().toISOString()
            };
            needsUpdate = true;
          }

          if (isOwnerClaim && profileData.role !== "owner") {
            profileData.role = "owner";
            needsUpdate = true;
          }

          // Force check if standard sandbox corporate emails have proper mapping
          const userEmail = authUser.email || "";
          if (
            userEmail === "admin@stockflow.com" || 
            userEmail.startsWith("admin.sandbox") || 
            userEmail.startsWith("admin-demo")
          ) {
            if (profileData.role !== "admin" && !isOwnerClaim) {
              profileData.role = "admin";
              needsUpdate = true;
            }
            if (profileData.name === "Usuario" || !profileData.name || profileData.name.includes("Asesor")) {
              profileData.name = "Administrador Máster";
              needsUpdate = true;
            }
          } else if (
            userEmail === "manager@stockflow.com" || 
            userEmail.startsWith("manager.sandbox") || 
            userEmail.startsWith("manager-demo")
          ) {
            if (profileData.role !== "manager" && !isOwnerClaim) {
              profileData.role = "manager";
              needsUpdate = true;
            }
            if (profileData.name === "Usuario" || !profileData.name || profileData.name.includes("Asesor")) {
              profileData.name = "Jefe de Operaciones";
              needsUpdate = true;
            }
          } else if (
            userEmail === "logistics@stockflow.com" || 
            userEmail.startsWith("logistics.sandbox") || 
            userEmail.startsWith("logistics-demo")
          ) {
            if (profileData.role !== "logistics" && !isOwnerClaim) {
              profileData.role = "logistics";
              needsUpdate = true;
            }
            if (profileData.name === "Usuario" || !profileData.name || profileData.name.includes("Asesor")) {
              profileData.name = "Personal de Logística";
              needsUpdate = true;
            }
          } else if (
            userEmail === "seller@stockflow.com" || 
            userEmail.startsWith("seller.sandbox") || 
            userEmail.startsWith("seller-demo")
          ) {
            if (profileData.role !== "seller" && !isOwnerClaim) {
              profileData.role = "seller";
              needsUpdate = true;
            }
            if (profileData.name === "Usuario" || !profileData.name || profileData.name.includes("Asesor")) {
              profileData.name = "Vendedor de Tienda";
              needsUpdate = true;
            }
          }

          if (needsUpdate) {
            try {
              await setDoc(docRef, {
                ...profileData,
                updatedAt: new Date().toISOString()
              }, { merge: true });
            } catch (err) {
              console.error("Failed to auto-repair user role in firestore:", err);
            }
          }

          setProfile(profileData);
          setLoading(false);
        }, (error) => {
          console.error("Profile listener error:", error);
          setLoading(false);
        });
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
  
  const register = async (email: string, pass: string, name: string, role: UserRole = "seller") => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    
    // Send verification email
    await sendEmailVerification(userCredential.user);

    const profileData: UserProfile = {
      uid: userCredential.user.uid,
      email,
      role: role,
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
