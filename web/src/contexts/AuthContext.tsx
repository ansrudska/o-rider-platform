import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  type User,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, firestore, functions, googleProvider } from "../services/firebase";
import type { UserProfile } from "@shared/types";

function isWebView(): boolean {
  const ua = navigator.userAgent || "";
  // Android WebView
  if (/wv\b/.test(ua)) return true;
  // iOS WebView (not Safari, not CriOS/FxiOS)
  if (/iPhone|iPad|iPod/.test(ua) && !/Safari\//.test(ua)) return true;
  // Known in-app browsers
  if (/KAKAOTALK|NAVER|Line|Instagram|FBAN|FBAV/.test(ua)) return true;
  return false;
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  signInWithGoogle: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Handle redirect result (for WebView sign-in)
  useEffect(() => {
    getRedirectResult(auth).catch(() => {});
  }, []);

  // Listen to auth state
  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Ensure user profile exists
        const ensureProfile = httpsCallable(functions, "ensureUserProfile");
        await ensureProfile();
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  // Subscribe to user profile
  useEffect(() => {
    if (!user) return;

    return onSnapshot(
      doc(firestore, "users", user.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        }
      },
    );
  }, [user]);

  const signInWithGoogle = async () => {
    if (isWebView()) {
      // WebView에서는 redirect 방식 사용 (팝업 차단됨)
      await signInWithRedirect(auth, googleProvider);
    } else {
      await signInWithPopup(auth, googleProvider);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
