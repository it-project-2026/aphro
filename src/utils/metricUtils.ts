/**
 * Metric Utilities for APHRO
 * Centralizes target and realization KMS calculations across Dashboard, Rekap, and Monitoring.
 */

/**
 * Safe numeric parser supporting numbers, strings, and Indonesian decimal commas (e.g. "1,5" -> 1.5)
 */
export function parseNumeric(val: any, fallback: number = 0): number {
  if (typeof val === 'number') {
    return isNaN(val) ? fallback : val;
  }
  if (val === null || val === undefined) {
    return fallback;
  }
  const str = String(val).trim().replace(',', '.');
  if (str === '') return fallback;
  const parsed = parseFloat(str);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Checks if a Work Order status indicates completion
 */
export function isWOSelesai(status?: string): boolean {
  if (!status) return false;
  const s = String(status).toUpperCase().trim();
  if (s.includes('BELUM') || s.includes('PROGRESS') || s.includes('SEDANG') || s.includes('NOT')) {
    return false;
  }
  return s === 'SELESAI' || s.includes('SELESAI') || s === 'COMPLETE' || s === 'DONE' || s === 'CLOSED';
}

/**
 * Checks if a Work Order status indicates work is in progress
 */
export function isWOInProgress(status?: string): boolean {
  if (!status) return false;
  const s = String(status).toUpperCase().trim();
  return s === 'SEDANG DIKERJAKAN' || s.includes('PROGRESS') || s.includes('SEDANG') || s === 'PROSES' || s.includes('PROSES');
}

/**
 * Calculates planned/target KMS of a Work Order.
 * Converts GAWANG to KMS (divide by 20, since 1 gawang = 50m = 0.05 km).
 */
export function getWOTargetKms(wo: {
  volumePekerjaan?: any;
  woKms?: any;
  satuan?: string;
}): number {
  let val = parseNumeric(wo.volumePekerjaan ?? wo.woKms, 0);
  if (String(wo.satuan || '').toUpperCase().trim() === 'GAWANG') {
    val = val / 20;
  }
  return Number(val.toFixed(2));
}

/**
 * Calculates realized KMS of a Work Order accurately:
 * 1. If explicit totalRealisasi is provided (> 0), use it (converting GAWANG if needed).
 * 2. If status is SELESAI, the completed work order realized 100% of its planned volume.
 * 3. If status is SEDANG DIKERJAKAN, calculate by progress percent if > 0.
 */
export function getWORealisasiKms(wo: {
  status?: string;
  totalRealisasi?: any;
  satuanTotalRealisasi?: string;
  volumePekerjaan?: any;
  woKms?: any;
  satuan?: string;
  progressPercent?: any;
}): number {
  const statusUpper = (wo.status || '').toUpperCase().trim();
  const isSelesai = isWOSelesai(statusUpper);

  // 1. Check if totalRealisasi is explicitly filled with a positive number
  const explicit = parseNumeric(wo.totalRealisasi, 0);
  if (explicit > 0) {
    const isGawang = String(wo.satuanTotalRealisasi || wo.satuan || '').toUpperCase().trim() === 'GAWANG';
    const val = isGawang ? explicit / 20 : explicit;
    return Number(val.toFixed(2));
  }

  // 2. If status is SELESAI, default realization is 100% of the Work Order's planned volume
  if (isSelesai) {
    return getWOTargetKms(wo);
  }

  // 3. If in progress, calculate by progress percent if > 0
  if (isWOInProgress(statusUpper)) {
    const progress = parseNumeric(wo.progressPercent, 0);
    if (progress > 0) {
      const target = getWOTargetKms(wo);
      return Number(((progress / 100) * target).toFixed(2));
    }
  }

  return 0;
}

/**
 * Program Target Standards:
 * Target untuk UL BUKITTINGGI adalah 552 KMS, dan setiap tim ROW targetnya 50.20 KMS.
 */
export const TARGET_UL_BUKITTINGGI_KMS = 552;
export const TOTAL_PROGRAM_TARGET_KMS = 552;
export const TOTAL_PROGRAM_TIM_ROW = 11;
export const TARGET_KMS_PER_TIM_ROW = 50.20;

/**
 * Calculates Target KMS for a specific number of Tim ROWs.
 * - Setiap tim ROW targetnya: 50.20 KMS
 * - Untuk UL BUKITTINGGI (11 Tim ROW): 552.00 KMS
 */
export function calculateTimRowTargetKms(count: number = 1, isBukittinggi: boolean = true): number {
  if (count <= 0) return 0;
  if (count === TOTAL_PROGRAM_TIM_ROW && isBukittinggi) return TARGET_UL_BUKITTINGGI_KMS;
  return Number((count * TARGET_KMS_PER_TIM_ROW).toFixed(2));
}
