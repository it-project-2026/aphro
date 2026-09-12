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
  const embeddedConfig = React.useMemo(() => getActiveGasConfig(), []);
  const settings: AppSettings = React.useMemo(() => {
    const rawGasUrl = (rawSettings?.gasWebAppUrl || '').trim();
    const isGasUrlValid = rawGasUrl.startsWith('https://script.google.com/macros/s/') && !rawGasUrl.includes('AKfycbz_9e5n4Jb4Jz');
    const validGasUrl = isGasUrlValid ? rawGasUrl : embeddedConfig.gasWebAppUrl;

    const rawSpreadsheetId = (rawSettings?.spreadsheetId || '').trim();
    const isSpreadsheetIdValid = rawSpreadsheetId && !rawSpreadsheetId.includes('1L2Z_eT5u6r0k');
    const validSpreadsheetId = isSpreadsheetIdValid ? rawSpreadsheetId : embeddedConfig.spreadsheetId;

    // Detect if user has performed Inisiasi for a specific Unit Layanan
    let initiatedNamaUL = '';
    let initiatedSpreadsheetId = '';
    let initiatedDriveFolderId = '';
    let initiatedPhotoFolderId = '';
    let initiatedAbsensiFolderId = '';

    try {
      const explicitUnitName = localStorage.getItem('aphro_nama_unit_layanan');
      if (explicitUnitName && explicitUnitName.trim()) {
        initiatedNamaUL = explicitUnitName.trim();
      }
      const savedUl = localStorage.getItem('aphro_selected_inisiasi_ul');
      if (savedUl) {
        const parsed = JSON.parse(savedUl);
        if (parsed?.namaUL && !initiatedNamaUL) initiatedNamaUL = parsed.namaUL.trim();
        if (parsed?.id) initiatedSpreadsheetId = parsed.id;
        if (parsed?.folderIdSpreadsheet) initiatedDriveFolderId = parsed.folderIdSpreadsheet;
        if (parsed?.folderIdFoto) initiatedPhotoFolderId = parsed.folderIdFoto;
        if (parsed?.folderIdAbsensi) initiatedAbsensiFolderId = parsed.folderIdAbsensi;
      }
    } catch {
      // Ignore localStorage parse errors
    }

    // Resolve active namaUnitLayanan:
    // Prioritize initiated unit name if available; replace stale/hardcoded Padang defaults
    let resolvedNamaUnit = (rawSettings?.namaUnitLayanan || '').trim();
    if (initiatedNamaUL) {
      resolvedNamaUnit = initiatedNamaUL;
    } else if (
      !resolvedNamaUnit ||
      resolvedNamaUnit === 'PLN ES UP4 Sumatera Barat UP3 Padang' ||
      resolvedNamaUnit === 'PLN Electricity Services UP3 Padang' ||
      resolvedNamaUnit.toUpperCase().includes('PADANG')
    ) {
      resolvedNamaUnit = 'UL BUKITTINGGI';
    }

    return {
      ...SettingsContextData.defaultSettings,
      ...embeddedConfig,
      ...rawSettings,
      namaUnitLayanan: resolvedNamaUnit,
      gasWebAppUrl: validGasUrl,
      spreadsheetId: initiatedSpreadsheetId || validSpreadsheetId,
      driveFolderId: rawSettings?.driveFolderId?.trim() || initiatedDriveFolderId || embeddedConfig.driveFolderId || SettingsContextData.defaultSettings.driveFolderId,
      photoFolderId: rawSettings?.photoFolderId?.trim() || initiatedPhotoFolderId || SettingsContextData.defaultSettings.photoFolderId,
      absensiFolderId: rawSettings?.absensiFolderId?.trim() || initiatedAbsensiFolderId || embeddedConfig.absensiFolderId || SettingsContextData.defaultSettings.absensiFolderId,
    };
  }, [rawSettings, embeddedConfig]);

  // Keep localStorage and rawSettings synchronized with the active resolved unit name
  React.useEffect(() => {
    if (settings.namaUnitLayanan && rawSettings?.namaUnitLayanan !== settings.namaUnitLayanan) {
      setRawSettings(prev => ({ ...prev, namaUnitLayanan: settings.namaUnitLayanan }));
      try {
        localStorage.setItem('aphro_nama_unit_layanan', settings.namaUnitLayanan);
      } catch {}
    }
  }, [settings.namaUnitLayanan, rawSettings?.namaUnitLayanan, setRawSettings]);

  const updateSettings = React.useCallback((newSettings: Partial<AppSettings>) => {
    if (newSettings.namaUnitLayanan) {
      try {
        localStorage.setItem('aphro_nama_unit_layanan', newSettings.namaUnitLayanan);
      } catch {}
    }
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

