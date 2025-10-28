"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useTheme } from 'next-themes';

interface Settings {
  theme: 'light' | 'dark' | 'system';
  accentColor: string;
  fontSize: 'small' | 'medium' | 'large';
  reduceMotion: boolean;
  defaultModel: string;
  defaultLanguage: string;
  enableTools: boolean;
  autoPlayAudio: boolean;
  streamSpeed: 'normal' | 'fast' | 'slow';
  apiKey: string | null;
  apiEndpoint: string;
  shortcuts: Record<string, string>;
  highContrast: boolean;
  screenReader: boolean;
}

interface SettingsContextType {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetSettings: () => void;
  isConnected: boolean;
}

const SETTINGS_KEY = 'youworker-settings';
const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  accentColor: '#3b82f6',
  fontSize: 'medium',
  reduceMotion: false,
  defaultModel: 'gpt-4o-mini',
  defaultLanguage: 'en',
  enableTools: true,
  autoPlayAudio: true,
  streamSpeed: 'normal',
  apiKey: null,
  apiEndpoint: '/api',
  shortcuts: {
    'cmd+n': 'New session',
    'cmd+enter': 'Send message',
    'cmd+shift+v': 'Voice input',
    'esc': 'Stop',
    'cmd+k': 'Command palette',
  },
  highContrast: false,
  screenReader: false,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isConnected, setIsConnected] = useState(true);
  const { theme: currentTheme, setTheme } = useTheme();

  useEffect(() => {
    // Load from localStorage
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings(prev => ({ ...DEFAULT_SETTINGS, ...parsed }));
      } catch {
        // Invalid JSON, reset
        localStorage.removeItem(SETTINGS_KEY);
      }
    }
  }, []);

  useEffect(() => {
    // Save to localStorage
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    // Sync theme with next-themes
    if (settings.theme !== 'system') {
      setTheme(settings.theme);
    }
  }, [settings.theme, setTheme]);

  useEffect(() => {
    // Connection status - simple ping
    const checkConnection = async () => {
      try {
        const response = await fetch('/api/health', { method: 'GET' });
        setIsConnected(response.ok);
      } catch {
        setIsConnected(false);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 30000); // Every 30s
    return () => clearInterval(interval);
  }, []);

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem(SETTINGS_KEY);
  };

  const value = {
    settings,
    updateSetting,
    resetSettings,
    isConnected,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}