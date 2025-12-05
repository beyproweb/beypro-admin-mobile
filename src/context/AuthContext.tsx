import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { getItem, setItem, deleteItem } from "../utils/storage";
import { router } from "expo-router";
import { loginRequest, getMe } from "../api/auth.api";

export interface AuthContextType {
  user: any;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoggedIn: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // load user on app start
  useEffect(() => {
    (async () => {
      try {
        const token = await getItem("token");
        if (token) {
          const me = await getMe();
          setUser(me);
        }
      } catch (err) {
        console.log("Auth load error:", err);
      }
      setLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await loginRequest(email, password);
    if (res?.token) {
      await setItem("token", res.token);
      const me = await getMe();
      setUser(me);
      router.replace("/");
    }
  };

  const logout = async () => {
    await deleteItem("token");
    setUser(null);
    router.replace("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isLoggedIn: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
