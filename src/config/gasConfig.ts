/**
 * KONFIGURASI NATIVE TERANAM (EMBEDDED GAS CONFIGURATION)
 * Sistem APHRO - PLN ES UP4 Sumatera Barat UP3 Padang
 */

import { getLocalDateTimeString } from '../utils/dateUtils';

export interface EmbeddedGASConfig {
  gasWebAppUrl: string;
  spreadsheetId: string;
  driveFolderId: string;
  absensiFolderId: string;
  spreadsheetName: string;
  autoSyncOnStartup: boolean;
  lastUpdated: string;
}

// Default embedded configuration compiled directly into the application
export const EMBEDDED_GAS_CONFIG: EmbeddedGASConfig = {
  gasWebAppUrl: 'https://script.google.com/macros/s/AKfycbxtykzff_RNTvEM3_Cib2DkR7FfDQSX2ofFdeJPwFOM6FvuvPYkpIgZcg2T10rMiXg/exec',
  spreadsheetId: '1KFUEh_jHtjZRtxCLYMK9aJpgSJEm3RblFjURuNYw2Ik',
  driveFolderId: '1idu8U3COKEqdcCewdWntu9X06ZMnzskr',
  absensiFolderId: '1zDU9fGaFan01Y9Dogtd0XhOPM1S1Vry5',
  spreadsheetName: 'APHRO_DATABASE_ENTERPRISE',
  autoSyncOnStartup: true,
  lastUpdated: '2026-08-06',
};

/**
 * Direct helper function to force-embed and persist GAS Web App URL directly into localStorage & App State
 */
export const saveAndEmbedGasConfig = (config: Partial<EmbeddedGASConfig>): EmbeddedGASConfig => {
  const newConfig: EmbeddedGASConfig = {
    ...EMBEDDED_GAS_CONFIG,
    ...config,
    lastUpdated: getLocalDateTimeString(),
  };

  // Save to persistent localStorage key for embedded configs
  try {
    localStorage.setItem('aphro_embedded_gas_config', JSON.stringify(newConfig));
  } catch {
    // Ignore storage write error
  }
  return newConfig;
};

/**
 * Get active embedded GAS configuration
 */
export const getActiveGasConfig = (): EmbeddedGASConfig => {
  try {
    const saved = localStorage.getItem('aphro_embedded_gas_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (
        parsed &&
        parsed.gasWebAppUrl &&
        typeof parsed.gasWebAppUrl === 'string' &&
        parsed.gasWebAppUrl.startsWith('https://script.google.com/macros/s/') &&
        !parsed.gasWebAppUrl.includes('AKfycbz_9e5n4Jb4Jz')
      ) {
        return {
          ...EMBEDDED_GAS_CONFIG,
          ...parsed,
        };
      }
    }
  } catch {
    // Fallback to default
  }
  return EMBEDDED_GAS_CONFIG;
};
