import * as React from 'react';
import { usePersistState } from '../hooks/usePersistState';
import { AppSettings } from '../types';
import { SettingsContextData } from './contextConstants';
import { getActiveGasConfig } from '../config/gasConfig';

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

const SettingsContext = React.createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [rawSettings, setRawSettings] = usePersistState<AppSettings>(
    'pln_mobile_settings',
    SettingsContextData.defaultSettings
  );

  // Guarantee that gasWebAppUrl and critical properties fall back to active embedded config if empty
  const embeddedConfig = getActiveGasConfig();
  const settings: AppSettings = React.useMemo(() => {
    return {
      ...SettingsContextData.defaultSettings,
      ...rawSettings,
      gasWebAppUrl: rawSettings?.gasWebAppUrl?.trim() || embeddedConfig.gasWebAppUrl || SettingsContextData.defaultSettings.gasWebAppUrl,
      spreadsheetId: rawSettings?.spreadsheetId?.trim() || embeddedConfig.spreadsheetId || SettingsContextData.defaultSettings.spreadsheetId,
      driveFolderId: rawSettings?.driveFolderId?.trim() || embeddedConfig.driveFolderId || SettingsContextData.defaultSettings.driveFolderId,
      absensiFolderId: rawSettings?.absensiFolderId?.trim() || embeddedConfig.absensiFolderId || SettingsContextData.defaultSettings.absensiFolderId,
    };
  }, [rawSettings, embeddedConfig]);

  const updateSettings = React.useCallback((newSettings: Partial<AppSettings>) => {
    setRawSettings(prev => ({ ...prev, ...newSettings }));
  }, [setRawSettings]);

  const resetSettings = React.useCallback(() => {
    setRawSettings(SettingsContextData.defaultSettings);
  }, [setRawSettings]);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = React.useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

