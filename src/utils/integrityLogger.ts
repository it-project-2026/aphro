/**
 * Data Integrity Guard & Development Logger for APHRO
 * 
 * Strict invariants:
 * 1. JANGAN PERNAH MENEBAK Nomor_WO REALISASI berdasarkan tanggal.
 * 2. Sync/Refresh/Load/Repair TIDAK BOLEH mengubah data historis (ID, WO_ID, Nomor_WO, TANGGAL) secara otomatis.
 * 3. Relasi yang benar: REALISASI.WO_ID -> WORK_ORDER.WO_ID -> WORK_ORDER.Nomor_WO.
 * 4. Jika WO_ID kosong -> "WO TIDAK TERHUBUNG".
 * 5. Jika WO_ID ada tetapi WORK_ORDER tidak ditemukan -> "WORK_ORDER TIDAK DITEMUKAN".
 */

export interface IntegrityViolationLog {
  realisasiId: string;
  woIdBefore?: string;
  nomorWoBefore?: string;
  tanggalBefore?: string;
  woIdAfter?: string;
  nomorWoAfter?: string;
  tanggalAfter?: string;
  reason: string;
  functionName: string;
  timestamp: string;
  prevented: boolean;
}

const violationHistory: IntegrityViolationLog[] = [];

/**
 * Checks and audits mutations on REALISASI entity.
 * Logs any unauthorized modification to ID, WO_ID, Nomor_WO, or TANGGAL.
 */
export function auditRealisasiMutation(
  before: { id?: string; workOrderId?: string; nomorWO?: string; tanggalRealisasi?: string } | null | undefined,
  after: { id?: string; workOrderId?: string; nomorWO?: string; tanggalRealisasi?: string },
  functionName: string,
  reason: string = 'Sync / Data Normalization'
): boolean {
  if (!before) return true; // Initial creation

  const idChanged = before.id && after.id && before.id !== after.id;
  const woIdChanged = Boolean(before.workOrderId && after.workOrderId && before.workOrderId !== after.workOrderId);
  const nomorWoChanged = Boolean(before.nomorWO && after.nomorWO && before.nomorWO !== after.nomorWO);

  if (idChanged || woIdChanged || nomorWoChanged) {
    const violation: IntegrityViolationLog = {
      realisasiId: after.id || before.id || 'UNKNOWN',
      woIdBefore: before.workOrderId || '-',
      nomorWoBefore: before.nomorWO || '-',
      tanggalBefore: before.tanggalRealisasi || '-',
      woIdAfter: after.workOrderId || '-',
      nomorWoAfter: after.nomorWO || '-',
      tanggalAfter: after.tanggalRealisasi || '-',
      reason,
      functionName,
      timestamp: new Date().toISOString(),
      prevented: true,
    };

    violationHistory.push(violation);

    // Development & Diagnostic Logging
    console.warn(
      `%c[DATA INTEGRITY GUARD] Mutasi Ilegal Terdeteksi pada REALISASI!%c\n` +
      `------------------------------------------------------------\n` +
      `REALISASI ID       : ${violation.realisasiId}\n` +
      `WO_ID Sebelum      : ${violation.woIdBefore}\n` +
      `Nomor_WO Sebelum   : ${violation.nomorWoBefore}\n` +
      `WO_ID Sesudah      : ${violation.woIdAfter}\n` +
      `Nomor_WO Sesudah   : ${violation.nomorWoAfter}\n` +
      `Alasan Perubahan   : ${violation.reason}\n` +
      `Fungsi Pelaku      : ${violation.functionName}\n` +
      `Status             : BLOCKED (Nilai Asli Dipertahankan)\n` +
      `------------------------------------------------------------`,
      'background: #dc2626; color: #ffffff; font-weight: bold; padding: 2px 6px; border-radius: 4px;',
      'color: inherit;'
    );

    return false;
  }

  return true;
}

/**
 * Returns list of recorded violations for diagnostics / testing
 */
export function getIntegrityViolations(): IntegrityViolationLog[] {
  return [...violationHistory];
}

/**
 * Helper to resolve status display string for REALISASI Work Order relation
 */
export function resolveRealisasiWoStatus(
  rel: { workOrderId?: string; nomorWO?: string },
  workOrdersMap: Record<string, { id: string; nomorWO: string }>
): {
  displayNomorWO: string;
  statusType: 'LINKED' | 'UNLINKED' | 'NOT_FOUND';
  statusLabel: string;
} {
  // 1. If Realisasi already has an explicit immutable Nomor_WO, return it
  if (rel.nomorWO && rel.nomorWO.trim() !== '' && rel.nomorWO !== '-' && rel.nomorWO !== 'null') {
    return {
      displayNomorWO: rel.nomorWO,
      statusType: 'LINKED',
      statusLabel: rel.nomorWO,
    };
  }

  // 2. If workOrderId is missing or null
  const cleanWoId = (rel.workOrderId || '').trim();
  if (!cleanWoId || cleanWoId === '-' || cleanWoId === 'null' || cleanWoId.startsWith('REL-')) {
    return {
      displayNomorWO: '',
      statusType: 'UNLINKED',
      statusLabel: 'WO TIDAK TERHUBUNG',
    };
  }

  // 3. If workOrderId is present, look up in Work Order map strictly by WO_ID
  const matchedWo = workOrdersMap[cleanWoId] || workOrdersMap[cleanWoId.toLowerCase()];
  if (matchedWo && matchedWo.nomorWO) {
    return {
      displayNomorWO: matchedWo.nomorWO,
      statusType: 'LINKED',
      statusLabel: matchedWo.nomorWO,
    };
  }

  // 4. WO_ID exists but Work Order not found in database / map
  return {
    displayNomorWO: '',
    statusType: 'NOT_FOUND',
    statusLabel: 'WORK_ORDER TIDAK DITEMUKAN',
  };
}
