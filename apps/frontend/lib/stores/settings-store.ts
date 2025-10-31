/**
 * Settings Store - Zustand state management for application settings
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

export type FontSize = 'small' | 'medium' | 'large';
export type Device = 'auto' | 'metal' | 'cpu' | 'gpu';
export type Language = 'en' | 'es' | 'fr' | 'de' | 'zh' | 'ja';
export type SuggestionMode = 'on' | 'off' | 'when_empty';

interface SettingsState {
  // Application settings
  fontSize: FontSize;
  language: Language;
  locale: string;
  device: Device;
  defaultModel: string;
  suggestionMode: SuggestionMode;
  downloadPath: string;
  enableDatalake: boolean;

  // Advanced settings
  cpuThreads: number;
  enableSystemTray: boolean;
  enableLocalAPI: boolean;
  apiServerPort: number;
  checkForUpdates: boolean;

  // Actions
  setFontSize: (size: FontSize) => void;
  setLanguage: (language: Language) => void;
  setLocale: (locale: string) => void;
  setDevice: (device: Device) => void;
  setDefaultModel: (model: string) => void;
  setSuggestionMode: (mode: SuggestionMode) => void;
  setDownloadPath: (path: string) => void;
  setEnableDatalake: (enabled: boolean) => void;
  setCpuThreads: (threads: number) => void;
  setEnableSystemTray: (enabled: boolean) => void;
  setEnableLocalAPI: (enabled: boolean) => void;
  setApiServerPort: (port: number) => void;
  setCheckForUpdates: (enabled: boolean) => void;

  // Reset to defaults
  resetToDefaults: () => void;
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_SETTINGS = {
  fontSize: 'small' as FontSize,
  language: 'en' as Language,
  locale: 'en-US',
  device: 'auto' as Device,
  defaultModel: 'GPT-4',
  suggestionMode: 'when_empty' as SuggestionMode,
  downloadPath: '~/Downloads',
  enableDatalake: false,
  cpuThreads: 4,
  enableSystemTray: true,
  enableLocalAPI: false,
  apiServerPort: 4891,
  checkForUpdates: true,
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Initial state
      ...DEFAULT_SETTINGS,

      // Actions
      setFontSize: (size) => set({ fontSize: size }),
      setLanguage: (language) => set({ language }),
      setLocale: (locale) => set({ locale }),
      setDevice: (device) => set({ device }),
      setDefaultModel: (model) => set({ defaultModel: model }),
      setSuggestionMode: (mode) => set({ suggestionMode: mode }),
      setDownloadPath: (path) => set({ downloadPath: path }),
      setEnableDatalake: (enabled) => set({ enableDatalake: enabled }),
      setCpuThreads: (threads) => set({ cpuThreads: threads }),
      setEnableSystemTray: (enabled) => set({ enableSystemTray: enabled }),
      setEnableLocalAPI: (enabled) => set({ enableLocalAPI: enabled }),
      setApiServerPort: (port) => set({ apiServerPort: port }),
      setCheckForUpdates: (enabled) => set({ checkForUpdates: enabled }),

      // Reset
      resetToDefaults: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'youworker-settings-storage',
    }
  )
);

// ============================================================================
// Custom Hooks
// ============================================================================

export function useFontSize() {
  return useSettingsStore(state => state.fontSize);
}

export function useSettingsActions() {
  return {
    setFontSize: useSettingsStore(state => state.setFontSize),
    setLanguage: useSettingsStore(state => state.setLanguage),
    setLocale: useSettingsStore(state => state.setLocale),
    setDevice: useSettingsStore(state => state.setDevice),
    setDefaultModel: useSettingsStore(state => state.setDefaultModel),
    setSuggestionMode: useSettingsStore(state => state.setSuggestionMode),
    setDownloadPath: useSettingsStore(state => state.setDownloadPath),
    setEnableDatalake: useSettingsStore(state => state.setEnableDatalake),
    setCpuThreads: useSettingsStore(state => state.setCpuThreads),
    setEnableSystemTray: useSettingsStore(state => state.setEnableSystemTray),
    setEnableLocalAPI: useSettingsStore(state => state.setEnableLocalAPI),
    setApiServerPort: useSettingsStore(state => state.setApiServerPort),
    setCheckForUpdates: useSettingsStore(state => state.setCheckForUpdates),
    resetToDefaults: useSettingsStore(state => state.resetToDefaults),
  };
}

// ============================================================================
// Font Scale Multipliers (for CSS variables)
// ============================================================================

export function getFontScaleMultiplier(fontSize: FontSize): number {
  switch (fontSize) {
    case 'small':
      return 1.0;
    case 'medium':
      return 1.3;
    case 'large':
      return 1.8;
    default:
      return 1.0;
  }
}
