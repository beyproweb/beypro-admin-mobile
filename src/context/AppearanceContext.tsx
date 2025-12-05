import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import api from "../api/axiosClient";

export type ThemeKey = "light" | "dark" | "system";
export type FontSizeKey = "small" | "medium" | "large";
export type AccentKey =
  | "default"
  | "emerald-500"
  | "rose-500"
  | "amber-500"
  | "cyan-500"
  | "violet-500"
  | "lime-500"
  | "sky-500";

export type AppearanceSettings = {
  theme: ThemeKey;
  fontSize: FontSizeKey;
  accent: AccentKey;
  highContrast: boolean;
};

const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: "system",
  fontSize: "medium",
  accent: "default",
  highContrast: false,
};

type AppearanceContextValue = {
  appearance: AppearanceSettings;
  setAppearance: React.Dispatch<React.SetStateAction<AppearanceSettings>>;
  loading: boolean;
  saving: boolean;
  saveAppearance: (next?: AppearanceSettings) => Promise<void>;
  isDark: boolean;
  fontScale: number;
  accentColor: string;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

async function loadAppearanceFromBackend(): Promise<Partial<AppearanceSettings>> {
  try {
    const res = await api.get("/settings/appearance");
    return res.data || {};
  } catch (err: any) {
    if (err?.response?.status === 404) {
      try {
        const res = await api.get("/user-settings/appearance");
        return res.data || {};
      } catch (err2: any) {
        if (err2?.response?.status === 404) {
          // Backend doesn't support appearance yet – use defaults only.
          return {};
        }
        throw err2;
      }
    }
    throw err;
  }
}

async function saveAppearanceToBackend(payload: AppearanceSettings): Promise<void> {
  try {
    await api.post("/settings/appearance", payload);
  } catch (err: any) {
    if (err?.response?.status === 404) {
      try {
        await api.post("/user-settings/appearance", payload);
        return;
      } catch (err2: any) {
        if (err2?.response?.status === 404) {
          // No backend support – silently skip persistence.
          return;
        }
        throw err2;
      }
    }
    throw err;
  }
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const systemScheme = useColorScheme();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await loadAppearanceFromBackend();
        if (cancelled) return;
        setAppearance({
          ...DEFAULT_APPEARANCE,
          ...data,
        });
      } catch (err) {
        if (!cancelled) {
          console.log("❌ Failed to load appearance settings:", err);
          setAppearance(DEFAULT_APPEARANCE);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const saveAppearance = async (next?: AppearanceSettings) => {
    const payload = next ?? appearance;
    try {
      setSaving(true);
      await saveAppearanceToBackend(payload);
      setAppearance(payload);
    } catch (err) {
      console.log("❌ Failed to save appearance settings:", err);
    } finally {
      setSaving(false);
    }
  };

  const isDark =
    appearance.theme === "dark" ||
    (appearance.theme === "system" && systemScheme === "dark");

  const fontScale =
    appearance.fontSize === "small"
      ? 0.9
      : appearance.fontSize === "large"
        ? 1.15
        : 1;

  const accentMap: Record<AccentKey, string> = {
    default: "#4F46E5",
    "emerald-500": "#10B981",
    "rose-500": "#F43F5E",
    "amber-500": "#F59E0B",
    "cyan-500": "#06B6D4",
    "violet-500": "#8B5CF6",
    "lime-500": "#84CC16",
    "sky-500": "#0EA5E9",
  };
  const accentColor = accentMap[appearance.accent] ?? accentMap.default;

  return (
    <AppearanceContext.Provider
      value={{
        appearance,
        setAppearance,
        loading,
        saving,
        saveAppearance,
        isDark,
        fontScale,
        accentColor,
      }}
    >
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) {
    throw new Error("useAppearance must be used inside AppearanceProvider");
  }
  return ctx;
}
