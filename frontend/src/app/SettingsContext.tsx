import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface SettingsState {
  largeText: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  colorblindMode: boolean;
  autoCenter: boolean;
  notifications: boolean;
}

const DEFAULT_SETTINGS: SettingsState = {
  largeText: false,
  highContrast: false,
  reducedMotion: false,
  colorblindMode: false,
  autoCenter: true,
  notifications: true,
};

const STORAGE_KEY = "lecturelens:settings";

function loadSettings(): SettingsState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

interface SettingsContextValue extends SettingsState {
  setSetting: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsState>(loadSettings);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("a11y-large-text", settings.largeText);
    root.classList.toggle("a11y-high-contrast", settings.highContrast);
    root.classList.toggle("a11y-reduced-motion", settings.reducedMotion);
    root.classList.toggle("a11y-colorblind", settings.colorblindMode);
  }, [settings.largeText, settings.highContrast, settings.reducedMotion, settings.colorblindMode]);

  const setSetting: SettingsContextValue["setSetting"] = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return <SettingsContext.Provider value={{ ...settings, setSetting }}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within a SettingsProvider");
  return ctx;
}
