import { AppSettings, User } from '../types';
import { getActiveGasConfig } from '../config/gasConfig';

const embeddedConfig = getActiveGasConfig();

export const SettingsContextData = {
  defaultSettings: {
    namaUnitLayanan: 'UL BUKITTINGGI',
    logoAplikasiUrl: '',
    logoInstansiUrl: '',
    loginBgUrl: '',
    themeColor: 'PLN Blue',
    footerText: '© 13307BKT - 2026 PLN ES UP4 Sumatera Barat UL BUKITTINGGI. All rights reserved.',
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
