/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { API_ENABLED, api } from "./api";

export interface AppSettings {
  siteFontScalePercent: number;
  songReaderFontPercent: number;
  stageReaderFontPercent: number;
  adminTerminalTitle: string;
  recommendationTrackingEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  siteFontScalePercent: 100,
  songReaderFontPercent: 73,
  stageReaderFontPercent: 100,
  adminTerminalTitle: "ChordSync Admin Terminal",
  recommendationTrackingEnabled: true,
};

const SETTINGS_KEY = "csl_app_settings_v1";

type SettingsContextValue = {
  settings: AppSettings;
  loading: boolean;
  refresh: () => Promise<void>;
  saveAdminSettings: (patch: Partial<AppSettings>) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

function readLocalSettings() {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function persistLocalSettings(settings: AppSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(readLocalSettings);
  const [loading, setLoading] = useState(API_ENABLED);

  const refresh = useCallback(async () => {
    if (!API_ENABLED) {
      setLoading(false);
      const local = readLocalSettings();
      setSettings(local);
      return;
    }

    setLoading(true);
    try {
      const res = await api.getPublicSettings();
      const next = { ...DEFAULT_SETTINGS, ...(res.settings || {}) };
      setSettings(next);
      persistLocalSettings(next);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveAdminSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      if (!API_ENABLED) {
        const next = { ...settings, ...patch };
        setSettings(next);
        persistLocalSettings(next);
        return;
      }

      const res = await api.updateAdminSettings(patch);
      const next = { ...DEFAULT_SETTINGS, ...(res.settings || {}) };
      setSettings(next);
      persistLocalSettings(next);
    },
    [settings],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty(
      "--app-font-scale",
      `${Math.max(0.6, settings.siteFontScalePercent / 100)}`,
    );
  }, [settings.siteFontScalePercent]);

  const value = useMemo(
    () => ({ settings, loading, refresh, saveAdminSettings }),
    [loading, refresh, saveAdminSettings, settings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useAppSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useAppSettings must be used inside SettingsProvider");
  return context;
}
