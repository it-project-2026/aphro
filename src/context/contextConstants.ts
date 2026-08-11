import { AppSettings, User } from '../types';
import { getActiveGasConfig } from '../config/gasConfig';

const embeddedConfig = getActiveGasConfig();

export const SettingsContextData = {
  defaultSettings: {
    namaUnitLayanan: 'PT PLN (Persero) UP3 Padang',
    logoAplikasiUrl: '',
    logoInstansiUrl: '',
    loginBgUrl: '',
    themeColor: 'PLN Blue',
    footerText: '© 2026 PT PLN (Persero). All rights reserved.',
    versiAplikasi: '1.0.0',
    gasWebAppUrl: embeddedConfig.gasWebAppUrl || '',
    spreadsheetId: embeddedConfig.spreadsheetId || '',
    driveFolderId: embeddedConfig.driveFolderId || '',
    absensiFolderId: embeddedConfig.absensiFolderId || '',
    syncInterval: 30,
    offlineMode: false,
    theme: 'light',
    fontSize: 'medium',
    highContrast: false,
    autoSyncOnStart: true,
    kontakAdmin: {
      whatsapp: '',
      email: '',
      alamat: '',
    },
  } as AppSettings,
};

export const AuthContextData = {
  defaultUser: null as User | null,
};
