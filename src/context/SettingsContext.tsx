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

  // Guarantee that gasWebAppUrl and critical properties fall back to active embedded config if empty or invalid
  const embeddedConfig = getActiveGasConfig();
  const settings: AppSettings = React.useMemo(() => {
    const rawGasUrl = (rawSettings?.gasWebAppUrl || '').trim();
    const isGasUrlValid = rawGasUrl.startsWith('https://script.google.com/macros/s/') && !rawGasUrl.includes('AKfycbz_9e5n4Jb4Jz');
    const validGasUrl = isGasUrlValid ? rawGasUrl : embeddedConfig.gasWebAppUrl;

    const rawSpreadsheetId = (rawSettings?.spreadsheetId || '').trim();
    const isSpreadsheetIdValid = rawSpreadsheetId && !rawSpreadsheetId.includes('1L2Z_eT5u6r0k');
    const validSpreadsheetId = isSpreadsheetIdValid ? rawSpreadsheetId : embeddedConfig.spreadsheetId;

    return {
      ...SettingsContextData.defaultSettings,
      ...embeddedConfig,
      ...rawSettings,
      gasWebAppUrl: validGasUrl,
      spreadsheetId: validSpreadsheetId,
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

