import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import type { SystemSettings } from '../types';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeAccent =
  | 'monochrome'
  | 'emerald'
  | 'indigo'
  | 'blue'
  | 'violet'
  | 'amber'
  | 'rose'
  | 'cyan'
  | 'orange'
  | 'titanium';
export type FontSize = 'sm' | 'md' | 'lg';
export type CurrencyMode = 'USD' | 'VES';

interface PreferencesState {
  mode: ThemeMode;
  accent: ThemeAccent;
  fontSize: FontSize;
  highContrast: boolean;
  resolvedMode: 'light' | 'dark';
  currency: CurrencyMode;
  bcvRate: number;
  bcvUpdatedAt: string | null;
}

interface PreferencesContextType extends PreferencesState {
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: ThemeAccent) => void;
  setFontSize: (fontSize: FontSize) => void;
  setHighContrast: (highContrast: boolean) => void;
  setCurrency: (currency: CurrencyMode) => void;
  toggleMode: () => void;
  resetDefaults: () => void;
  refreshBcvRate: () => Promise<void>;
  updateBcvRate: (newRate: number) => Promise<void>;
}

const STORAGE_KEY = 'xion_pay_preferences';

const defaultPreferences: PreferencesState = {
  mode: 'light',
  accent: 'monochrome',
  fontSize: 'md',
  highContrast: false,
  resolvedMode: 'light',
  currency: 'USD',
  bcvRate: 36.50,
  bcvUpdatedAt: null,
};

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<PreferencesState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          mode: parsed.mode || 'light',
          accent: parsed.accent || 'monochrome',
          fontSize: parsed.fontSize || 'md',
          highContrast: Boolean(parsed.highContrast),
          resolvedMode: parsed.mode === 'dark' ? 'dark' : 'light',
          currency: (parsed.currency === 'VES' ? 'VES' : 'USD') as CurrencyMode,
          bcvRate: typeof parsed.bcvRate === 'number' ? parsed.bcvRate : 36.50,
          bcvUpdatedAt: parsed.bcvUpdatedAt || null,
        };
      }
    } catch {
      // fallback
    }
    return defaultPreferences;
  });

  // Calculate resolved dark/light mode
  const getResolvedMode = (mode: ThemeMode): 'light' | 'dark' => {
    if (mode === 'system') {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    return mode;
  };

  useEffect(() => {
    const resolved = getResolvedMode(preferences.mode);
    setPreferences((prev) => ({ ...prev, resolvedMode: resolved }));

    // Apply classes to root HTML element
    const root = document.documentElement;

    // Dark class
    if (resolved === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // High Contrast class
    if (preferences.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    // Data attributes for accent & font size
    root.setAttribute('data-accent', preferences.accent);
    root.setAttribute('data-font-size', preferences.fontSize);

    // Save to local storage
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        mode: preferences.mode,
        accent: preferences.accent,
        fontSize: preferences.fontSize,
        highContrast: preferences.highContrast,
        currency: preferences.currency,
        bcvRate: preferences.bcvRate,
        bcvUpdatedAt: preferences.bcvUpdatedAt,
      })
    );
  }, [
    preferences.mode,
    preferences.accent,
    preferences.fontSize,
    preferences.highContrast,
    preferences.currency,
    preferences.bcvRate,
    preferences.bcvUpdatedAt,
  ]);

  // Initial and periodic fetch of BCV rate from settings API
  const refreshBcvRate = useCallback(async () => {
    try {
      const res = await api.get<SystemSettings>('/settings');
      if (res.data && typeof res.data.usd_ves_rate === 'number') {
        setPreferences((prev) => ({
          ...prev,
          bcvRate: res.data.usd_ves_rate,
          bcvUpdatedAt: res.data.updated_at || new Date().toISOString(),
        }));
      }
    } catch (e) {
      console.warn('Could not refresh BCV rate from API:', e);
    }
  }, []);

  useEffect(() => {
    refreshBcvRate();
  }, [refreshBcvRate]);

  // Listen to system theme changes if in 'system' mode
  useEffect(() => {
    if (preferences.mode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      setPreferences((prev) => ({
        ...prev,
        resolvedMode: mediaQuery.matches ? 'dark' : 'light',
      }));
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [preferences.mode]);

  const setMode = (mode: ThemeMode) => {
    setPreferences((prev) => ({ ...prev, mode, resolvedMode: getResolvedMode(mode) }));
  };

  const setAccent = (accent: ThemeAccent) => {
    setPreferences((prev) => ({ ...prev, accent }));
  };

  const setFontSize = (fontSize: FontSize) => {
    setPreferences((prev) => ({ ...prev, fontSize }));
  };

  const setHighContrast = (highContrast: boolean) => {
    setPreferences((prev) => ({ ...prev, highContrast }));
  };

  const setCurrency = (currency: CurrencyMode) => {
    setPreferences((prev) => ({ ...prev, currency }));
  };

  const updateBcvRate = async (newRate: number) => {
    const res = await api.put<SystemSettings>('/settings/exchange-rate', { usd_ves_rate: newRate });
    setPreferences((prev) => ({
      ...prev,
      bcvRate: res.data.usd_ves_rate,
      bcvUpdatedAt: res.data.updated_at || new Date().toISOString(),
    }));
  };

  const toggleMode = () => {
    const nextMode = preferences.resolvedMode === 'dark' ? 'light' : 'dark';
    setMode(nextMode);
  };

  const resetDefaults = () => {
    setPreferences(defaultPreferences);
  };

  return (
    <PreferencesContext.Provider
      value={{
        ...preferences,
        setMode,
        setAccent,
        setFontSize,
        setHighContrast,
        setCurrency,
        toggleMode,
        resetDefaults,
        refreshBcvRate,
        updateBcvRate,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
};
