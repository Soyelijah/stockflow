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

interface UserProfile {
  uid: string;
  email: string | null;
  role: string; // TODO(day2): align union to 7 roles: customer, cashier, inventory_manager, logistics, delivery, admin, owner
  name: string;
  photoURL?: string;
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
  register: (email: string, pass: string, name: string) => Promise<void>;
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
        try {
          // Leer Custom Claim desde el token de autenticación (Día 2)
          const tokenResult = await authUser.getIdTokenResult(true);
          const customRole = (tokenResult.claims.role as string) || "customer";

          const docRef = doc(db, "users", authUser.uid);
          
          unsubscribeProfile = onSnapshot(docRef, async (docSnap) => {
            if (docSnap.exists()) {
              // El token manda sobre el documento
              setProfile({ ...(docSnap.data() as UserProfile), role: customRole });
            } else {
              const newProfile: UserProfile = {
                uid: authUser.uid,
                email: authUser.email,
                role: customRole,
                name: authUser.displayName || "Usuario",
              };
              try {
                await setDoc(docRef, {
                  ...newProfile,
                  createdAt: new Date().toISOString(),
                });
              } catch (e) {
                console.warn("No se pudo guardar el perfil inicial en Firestore:", e);
              }
              setProfile(newProfile);
            }
            setLoading(false);
        }, (error) => {
          console.error("Profile listener error:", error);
          setLoading(false);
        });
        } catch (e) {
          console.error("Error al obtener Custom Claims:", e);
          setLoading(false);
        }
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
  
  const register = async (email: string, pass: string, name: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    
    // Send verification email
    await sendEmailVerification(userCredential.user);

    // TODO(day2): remove email-based role inference — replace with custom claim
    const isAdmin = email === "solier.elijah@gmail.com";
    const profileData: UserProfile = {
      uid: userCredential.user.uid,
      email,
      role: isAdmin ? "admin" : "seller",
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
