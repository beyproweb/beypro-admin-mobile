import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import secureFetch from "../api/secureFetch";
import { useAuth } from "./AuthContext";

export type Permission =
  | "all"
  | "orders"
  | "payments"
  | "delivery"
  | "staff"
  | "reports"
  | "inventory"
  | "products"
  | "settings"
  | "notifications";

export interface PermissionsContextType {
  roles: Record<string, Permission[]>;
  userPermissions: Permission[];
  loading: boolean;
  error: string | null;
  hasPermission: (permission: Permission | Permission[]) => boolean;
  refreshPermissions: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | null>(null);

export function usePermissions() {
  const ctx = useContext(PermissionsContext);
  if (!ctx)
    throw new Error("usePermissions must be inside PermissionsProvider");
  return ctx;
}

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user, isLoggedIn } = useAuth();
  const [roles, setRoles] = useState<Record<string, Permission[]>>({
    admin: ["all"],
    cashier: ["orders", "payments"],
    driver: ["delivery"],
  });
  const [userPermissions, setUserPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch permissions config from backend
  const fetchPermissionsConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const config = await secureFetch("/settings/users");
      if (config?.roles) {
        setRoles(config.roles);
      }
    } catch (err) {
      console.error("❌ Failed to fetch permissions config:", err);
      setError("Failed to load permissions");
    } finally {
      setLoading(false);
    }
  }, []);

  // Calculate user permissions based on their role
  const calculateUserPermissions = useCallback(() => {
    if (!user?.role) {
      setUserPermissions([]);
      return;
    }

    const roleKey = user.role.toLowerCase();
    const permissions = roles[roleKey] || [];
    setUserPermissions(permissions);
  }, [user, roles]);

  // Check if user has a permission
  const hasPermission = useCallback(
    (permission: Permission | Permission[]): boolean => {
      if (userPermissions.includes("all")) return true;

      const permissionsToCheck = Array.isArray(permission)
        ? permission
        : [permission];

      return permissionsToCheck.some((perm) => userPermissions.includes(perm));
    },
    [userPermissions]
  );

  // Initial load
  useEffect(() => {
    if (isLoggedIn) {
      fetchPermissionsConfig();
    }
  }, [isLoggedIn, fetchPermissionsConfig]);

  // Recalculate when roles or user changes
  useEffect(() => {
    calculateUserPermissions();
  }, [calculateUserPermissions]);

  const refreshPermissions = useCallback(async () => {
    await fetchPermissionsConfig();
  }, [fetchPermissionsConfig]);

  return (
    <PermissionsContext.Provider
      value={{
        roles,
        userPermissions,
        loading,
        error,
        hasPermission,
        refreshPermissions,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}
