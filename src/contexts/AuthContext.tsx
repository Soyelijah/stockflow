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
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

interface UserProfile {
  uid: string;
  email: string | null;
  role: "admin" | "manager" | "seller" | "logistics";
  name: string;
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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setUser(user);
        if (user) {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            // This is a safety check: profile should be created at register
            const newProfile: UserProfile = {
              uid: user.uid,
              email: user.email,
              role: user.email === "solier.elijah@gmail.com" ? "admin" : "seller",
              name: user.displayName || "Usuario",
            };
            await setDoc(docRef, {
              ...newProfile,
              createdAt: new Date().toISOString(),
            });
            setProfile(newProfile);
          }
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error("Auth status change error:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
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
