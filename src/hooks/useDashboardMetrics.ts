import React from 'react';
import { WorkOrder, Realisasi, ULP, ReguROW, Petugas, Penyulang } from '../types';
import { getWOTargetKms, getWORealisasiKms, isWOSelesai, TARGET_KMS_PER_TIM_ROW } from '../utils/metricUtils';
import { normalizeDateISO, parseDateFromNomorWO } from '../utils/dateUtils';

export const useDashboardMetrics = (
  workOrders: WorkOrder[],
  realisasiList: Realisasi[],
  ulpList: ULP[],
  reguList: ReguROW[],
  petugasList: Petugas[],
  penyulangList: Penyulang[],
  filterUlp: string,
  filterPenyulang: string,
  matchesUlp: (name?: string, id?: string, filter?: string) => boolean,
  matchesPenyulang: (name?: string, id?: string, filter?: string) => boolean,
  cleanStr: (s: string) => string,
  filterYear: string = 'ALL',
  filterMonth: string = 'ALL',
  startDate: string = '',
  endDate: string = ''
) => {
  const matchesDate = React.useCallback((rawDate?: any, rawNomorWO?: string, rawCreatedAt?: any) => {
    const itemDate = normalizeDateISO(rawDate) || parseDateFromNomorWO(rawNomorWO || '') || normalizeDateISO(rawCreatedAt) || '';
    if (!itemDate) return true;

    const [y, m] = itemDate.split('-');

    // Year filter
    if (filterYear && filterYear !== 'ALL' && y !== filterYear) {
      return false;
    }

    // Month filter
    if (filterMonth && filterMonth !== 'ALL' && m !== filterMonth.padStart(2, '0')) {
      return false;
    }

    // Start date filter
    if (startDate) {
      const normStart = normalizeDateISO(startDate);
      if (normStart && itemDate < normStart) return false;
    }

    // End date filter
    if (endDate) {
      const normEnd = normalizeDateISO(endDate);
      if (normEnd && itemDate > normEnd) return false;
    }

    return true;
  }, [filterYear, filterMonth, startDate, endDate]);

  const filteredWOs = React.useMemo(() => {
    return workOrders.filter(wo => {
      const ulpMatch = matchesUlp(wo.ulpName, wo.ulpId, filterUlp);
      const penyulangMatch = matchesPenyulang(wo.penyulangName, wo.penyulangId, filterPenyulang);
      const dateMatch = matchesDate(wo.tanggal, wo.nomorWO, wo.createdAt);
      return ulpMatch && penyulangMatch && dateMatch;
    });
  }, [workOrders, filterUlp, filterPenyulang, matchesUlp, matchesPenyulang, matchesDate]);

  const filteredRealisasi = React.useMemo(() => {
    return realisasiList.filter(rel => {
      const ulpMatch = matchesUlp(rel.ulpName, undefined, filterUlp);
      const penyulangMatch = matchesPenyulang(rel.penyulangName, undefined, filterPenyulang);
      const dateMatch = matchesDate(rel.tanggalRealisasi, rel.nomorWO, rel.createdAt);
      return ulpMatch && penyulangMatch && dateMatch;
    });
  }, [realisasiList, filterUlp, filterPenyulang, matchesUlp, matchesPenyulang, matchesDate]);

  const topPerformersData = React.useMemo(() => {
    const reguMap = new Map<string, any>();
    
    reguList.forEach((r, idx) => {
      const key = cleanStr(r.namaRegu || r.id || `regu-${idx}`);
      if (!key) return;
      if (filterUlp !== 'ALL' && (r.ulpName || r.ulpId) && !matchesUlp(r.ulpName, r.ulpId, filterUlp)) return;

      reguMap.set(key, {
        id: r.id || `regu-${idx}`,
        namaRegu: r.namaRegu || `TIM ROW ${idx + 1}`,
        penanggungJawab: r.penanggungJawab || 'Petugas ROW',
        jumlahAnggota: r.jumlahAnggota || 4,
        ulpName: r.ulpName || '',
        realisasiKms: 0,
        targetKms: 0,
        woSelesai: 0,
        woTotal: 0,
        totalTebang: 0,
        totalPangkas: 0,
        percentage: 0,
      });
    });

    filteredWOs.forEach(wo => {
      const reguKey = cleanStr(wo.reguName || '');
      if (!reguKey) return;

      if (!reguMap.has(reguKey)) {
        reguMap.set(reguKey, {
          id: wo.reguId || reguKey,
          namaRegu: wo.reguName || 'TIM ROW',
          penanggungJawab: wo.petugasName || 'Petugas ROW',
          jumlahAnggota: 4,
          ulpName: wo.ulpName || '',
          realisasiKms: 0,
          targetKms: 0,
          woSelesai: 0,
          woTotal: 0,
          totalTebang: 0,
          totalPangkas: 0,
          percentage: 0,
        });
      }

      const reguItem = reguMap.get(reguKey)!;
      reguItem.woTotal += 1;
      if (isWOSelesai(wo.status)) reguItem.woSelesai += 1;

      const targetVal = getWOTargetKms(wo);
      const relVal = getWORealisasiKms(wo);

      reguItem.targetKms += targetVal;
      reguItem.realisasiKms += relVal;
    });

    filteredRealisasi.forEach(rel => {
      const reguKey = cleanStr(rel.reguName || '');
      if (!reguKey) return;
      const reguItem = reguMap.get(reguKey);
      if (reguItem) {
        const ket = (rel.keterangan || '').toUpperCase();
        if (ket.includes('TEBANG')) reguItem.totalTebang += 1;
        if (ket.includes('PANGKAS')) reguItem.totalPangkas += 1;
      }
    });

    return Array.from(reguMap.values()).map(r => {
      const realKms = Number(r.realisasiKms.toFixed(2));
      // Target setiap tim ROW adalah 50.20 KMS
      const targetVal = TARGET_KMS_PER_TIM_ROW;
      const pct = targetVal > 0 ? Math.min(100, Math.round((realKms / targetVal) * 100)) : 0;
      return { ...r, targetKms: targetVal, realisasiKms: realKms, percentage: pct };
    }).sort((a, b) => b.realisasiKms - a.realisasiKms);
  }, [reguList, filterUlp, matchesUlp, filteredWOs, filteredRealisasi, cleanStr]);

  return { filteredWOs, filteredRealisasi, topPerformersData };
};
