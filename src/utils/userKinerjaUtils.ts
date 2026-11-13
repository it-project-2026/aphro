import { Realisasi, ReguROW, ULP, User, WorkOrder } from '../types';
import { getStandardUnitId } from '../services/inisiasiService';
import {
  classifyRealisasiAction,
  deduplicateRealisasi,
  getCanonicalReguKey,
  getCanonicalUlpKey,
  getRealisasiPohonCount,
  RekapHarianService,
  UL_PRESETS,
} from '../services/rekapHarianService';
import { getItemDateISO, getWIBDateString } from './dateUtils';

export const cleanToken = (s?: string | null): string => {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .replace(/^(regu|tim|petugas|kelompok|regu_row|tim_row)\s+/gi, '')
    .replace(/[^a-z0-9]/gi, '');
};

export const extractTeamNumber = (s?: string | null): string | null => {
  if (!s) return null;
  const str = String(s).trim();
  const explicitTeamMatch =
    str.match(/(?:tim\s*row|regu\s*row|tim|regu|row|usr|user|users)[-_\s]*0*(\d+)/i) ||
    str.match(/^\s*0*(\d+)\s*$/);
  if (explicitTeamMatch) {
    return String(parseInt(explicitTeamMatch[1], 10));
  }
  const fallbackDigit = str.match(/\b0*(\d+)\b/);
  return fallbackDigit ? String(parseInt(fallbackDigit[1], 10)) : null;
};

export function isStrictUserRoleAccount(user: User | null | undefined): boolean {
  if (!user) return false;
  const userRoleClean = (user.role || '').trim().toUpperCase();
  const isAdmShortcut =
    (user.userName || '').toLowerCase() === 'admbkt' ||
    (user.nip || '').toLowerCase() === 'admbkt' ||
    (user.id || '').toLowerCase() === 'admbkt';
  return userRoleClean === 'USER' && !isAdmShortcut;
}

const isPlaceholderValue = (val?: string | null): boolean => {
  if (!val) return true;
  const s = String(val).trim().toLowerCase();
  return (
    s === '' ||
    s === '-' ||
    s === 'null' ||
    s === 'undefined' ||
    s === 'belum ada regu' ||
    s === 'semua regu' ||
    s === 'semua ulp' ||
    s === 'petugas row' ||
    s === 'manajemen/admin'
  );
};

export interface StrictUserIdentity {
  reguName: string;
  reguId: string;
  ulpName: string;
  identifiers: Set<string>;
  cleanNames: Set<string>;
}

/**
 * Resolves the logged-in user's exact team/regu & personal identifiers WITHOUT
 * falling back to another default team (never guesses "TIM ROW 01" if blank).
 */
export function resolveStrictUserIdentity(
  currentUser: User | null | undefined,
  activeUnitName: string,
  masterUsers?: User[],
  _ulpList?: ULP[],
  reguList?: ReguROW[]
): StrictUserIdentity {
  if (!currentUser) {
    return {
      reguName: '',
      reguId: '',
      ulpName: '',
      identifiers: new Set(),
      cleanNames: new Set(),
    };
  }

  const userIdentifiers = [currentUser.id, currentUser.nip, currentUser.userName]
    .filter((v): v is string => Boolean(v && !isPlaceholderValue(v)))
    .map((v) => String(v).trim().toLowerCase());

  const matchedMaster = (masterUsers || []).find((m: any) => {
    if (!m) return false;
    const candidates = [m.id, m.nip, m.userName]
      .filter(Boolean)
      .map((v: any) => String(v).trim().toLowerCase());
    return candidates.some((c) => userIdentifiers.includes(c));
  });

  const reguCandidates = [
    currentUser.reguName,
    currentUser.Nama_Regu,
    currentUser.groupWO,
    currentUser.namaGroupWO,
    (currentUser as any).Regu_ROW,
    (currentUser as any).Regu,
    matchedMaster?.reguName,
    matchedMaster?.Nama_Regu,
    matchedMaster?.groupWO,
    matchedMaster?.namaGroupWO,
    (matchedMaster as any)?.Regu_ROW,
  ];

  let reguName =
    reguCandidates.find((v) => v && !isPlaceholderValue(v))?.trim() || '';

  const reguId = String(currentUser.reguId || matchedMaster?.reguId || '').trim();

  if (!reguName && reguId && reguList && reguList.length > 0) {
    const matchedRegu = reguList.find((r) => String(r.id) === reguId);
    if (matchedRegu?.namaRegu && !isPlaceholderValue(matchedRegu.namaRegu)) {
      reguName = matchedRegu.namaRegu.trim();
    }
  }

  // Only match preset row by explicit row/tim code in userName or nip (never default to row 1!)
  if (!reguName) {
    const explicitNum =
      extractTeamNumber(currentUser.userName) ||
      extractTeamNumber(currentUser.nip) ||
      extractTeamNumber(currentUser.name);
    if (explicitNum) {
      const unitKey = RekapHarianService.normalizeUnitKey(
        currentUser.unitName || currentUser.unitId || activeUnitName
      );
      const preset = UL_PRESETS[unitKey];
      const presetRow = preset?.rows?.find(
        (r) => extractTeamNumber(r.timRow) === explicitNum
      );
      if (presetRow) {
        reguName = presetRow.timRow;
      } else if (reguList && reguList.length > 0) {
        const reguMatch = reguList.find(
          (r) => extractTeamNumber(r.namaRegu) === explicitNum
        );
        if (reguMatch?.namaRegu) reguName = reguMatch.namaRegu;
      }
    }
  }

  const ulpCandidates = [
    currentUser.ulpName,
    (currentUser as any).ULP,
    (currentUser as any).namaULP,
    matchedMaster?.ulpName,
    (matchedMaster as any)?.ULP,
  ];
  const ulpName =
    ulpCandidates.find((v) => v && !isPlaceholderValue(v))?.trim() || '';

  const cleanNames = new Set<string>();
  [currentUser.name, currentUser.userName, matchedMaster?.name]
    .filter((v): v is string => Boolean(v && !isPlaceholderValue(v)))
    .forEach((v) => {
      const tok = cleanToken(v);
      if (tok && tok.length >= 2) cleanNames.add(tok);
    });

  return {
    reguName,
    reguId,
    ulpName,
    identifiers: new Set(userIdentifiers),
    cleanNames,
  };
}

function matchesActiveUnitAndUlp(
  itemUnitId: string | undefined,
  itemUlpName: string | undefined,
  activeUnitId: string,
  activeUnitName: string
): boolean {
  if (itemUnitId && String(itemUnitId).trim() !== '') {
    const stdItemUnit = getStandardUnitId(itemUnitId);
    if (stdItemUnit && activeUnitId && stdItemUnit !== activeUnitId) {
      return false;
    }
  }

  if (itemUlpName && !isPlaceholderValue(itemUlpName)) {
    const activeUnitKey = RekapHarianService.normalizeUnitKey(
      activeUnitName || activeUnitId
    );
    const activePreset = UL_PRESETS[activeUnitKey];
    if (activePreset?.rows) {
      const itemUlpClean = cleanToken(itemUlpName);
      const inActivePreset = activePreset.rows.some((r) => {
        const pUlp = cleanToken(r.namaUlp);
        return pUlp && (itemUlpClean.includes(pUlp) || pUlp.includes(itemUlpClean));
      });
      if (!inActivePreset) {
        for (const [presetKey, presetData] of Object.entries(UL_PRESETS)) {
          if (presetKey === activeUnitKey) continue;
          const inOtherPreset = presetData.rows.some((r) => {
            const pUlp = cleanToken(r.namaUlp);
            return pUlp && (itemUlpClean.includes(pUlp) || pUlp.includes(itemUlpClean));
          });
          if (inOtherPreset) return false;
        }
      }
    }
  }

  return true;
}

function matchesStrictTeamOrOwner(
  itemReguRaw: string,
  itemReguId: string,
  itemPetugasId: string,
  itemPetugasName: string,
  itemUlpRaw: string,
  identity: StrictUserIdentity
): boolean {
  const hasItemRegu = !isPlaceholderValue(itemReguRaw);
  const hasUserRegu = !isPlaceholderValue(identity.reguName);

  // 1. If item explicitly specifies a team (reguName), compare against user's team strictly.
  //    If user has a team and team doesn't match, ALWAYS reject (prevents cross-team bleed).
  if (hasItemRegu && hasUserRegu) {
    const userNum = extractTeamNumber(identity.reguName);
    const itemNum = extractTeamNumber(itemReguRaw);
    if (userNum && itemNum) {
      if (userNum !== itemNum) return false;

      // Extra guard: if both carry distinct ULP names, ensure ULP does not contradict
      if (!isPlaceholderValue(identity.ulpName) && !isPlaceholderValue(itemUlpRaw)) {
        const uUlp = getCanonicalUlpKey(identity.ulpName);
        const iUlp = getCanonicalUlpKey(itemUlpRaw);
        if (uUlp && iUlp && uUlp !== iUlp && !uUlp.includes(iUlp) && !iUlp.includes(uUlp)) {
          return false;
        }
      }
      return true;
    }

    const userCanon = getCanonicalReguKey(identity.reguName);
    const itemCanon = getCanonicalReguKey(itemReguRaw);
    if (userCanon && itemCanon) {
      return userCanon === itemCanon;
    }
    return false;
  }

  // 2. Direct reguId match (only if item does not carry a conflicting reguName)
  if (!hasItemRegu && identity.reguId && itemReguId && identity.reguId === itemReguId.trim()) {
    return true;
  }

  // 3. Direct personal petugasId match (only when reguName did not explicitly assign another team)
  const cleanPetugasId = String(itemPetugasId || '').trim().toLowerCase();
  if (cleanPetugasId && identity.identifiers.has(cleanPetugasId)) {
    if (!hasItemRegu) return true;
    if (!hasUserRegu) return true;
  }

  // 4. Exact petugasName match (never substring `.includes()` to avoid row1 matching row10)
  const cleanItemPetugas = !isPlaceholderValue(itemPetugasName)
    ? cleanToken(itemPetugasName)
    : '';
  if (cleanItemPetugas && identity.cleanNames.has(cleanItemPetugas)) {
    if (!hasItemRegu) return true;
    if (!hasUserRegu) return true;
  }

  return false;
}

export function matchesLoggedInUserWO(
  wo: WorkOrder,
  currentUser: User | null | undefined,
  activeUnitId: string,
  resolvedReguName: string,
  activeUnitName: string = '',
  identityOverride?: StrictUserIdentity
): boolean {
  if (!isStrictUserRoleAccount(currentUser) || !currentUser || !wo) return false;

  if (
    !matchesActiveUnitAndUlp(
      wo.unitId,
      wo.ulpName,
      activeUnitId,
      activeUnitName || currentUser.unitName || ''
    )
  ) {
    return false;
  }

  const identity: StrictUserIdentity = identityOverride || {
    reguName: !isPlaceholderValue(resolvedReguName)
      ? resolvedReguName
      : !isPlaceholderValue(currentUser.reguName)
      ? String(currentUser.reguName)
      : '',
    reguId: String(currentUser.reguId || '').trim(),
    ulpName: String(currentUser.ulpName || '').trim(),
    identifiers: new Set(
      [currentUser.id, currentUser.nip, currentUser.userName]
        .filter((v): v is string => Boolean(v && !isPlaceholderValue(v)))
        .map((v) => String(v).trim().toLowerCase())
    ),
    cleanNames: new Set(
      [currentUser.name, currentUser.userName]
        .filter((v): v is string => Boolean(v && !isPlaceholderValue(v)))
        .map((v) => cleanToken(v))
        .filter((t) => t.length >= 2)
    ),
  };

  const woReguStr = String(
    wo.reguName || (wo as any).regu || (wo as any).REGU_ROW || ''
  ).trim();

  return matchesStrictTeamOrOwner(
    woReguStr,
    String(wo.reguId || ''),
    String(wo.petugasId || ''),
    String(wo.petugasName || ''),
    String(wo.ulpName || ''),
    identity
  );
}

export function filterRealisasiForLoggedInUser(
  rawRealisasiList: Realisasi[],
  userWorkOrders: WorkOrder[],
  currentUser: User | null | undefined,
  activeUnitId: string,
  resolvedReguName: string,
  activeUnitName: string = '',
  identityOverride?: StrictUserIdentity
): Realisasi[] {
  if (!isStrictUserRoleAccount(currentUser) || !currentUser) return [];

  const uniqueRel = deduplicateRealisasi(rawRealisasiList);

  const idSet = new Set<string>();
  const nomorSet = new Set<string>();
  userWorkOrders.forEach((wo) => {
    const idVal = String(wo.id || wo.WO_ID || '').trim().toLowerCase();
    const nomorVal = String(wo.nomorWO || wo.Nomor_WO || '').trim().toUpperCase();
    if (idVal) idSet.add(idVal);
    if (nomorVal) nomorSet.add(nomorVal);
  });

  const identity: StrictUserIdentity = identityOverride || {
    reguName: !isPlaceholderValue(resolvedReguName)
      ? resolvedReguName
      : !isPlaceholderValue(currentUser.reguName)
      ? String(currentUser.reguName)
      : '',
    reguId: String(currentUser.reguId || '').trim(),
    ulpName: String(currentUser.ulpName || '').trim(),
    identifiers: new Set(
      [currentUser.id, currentUser.nip, currentUser.userName]
        .filter((v): v is string => Boolean(v && !isPlaceholderValue(v)))
        .map((v) => String(v).trim().toLowerCase())
    ),
    cleanNames: new Set(
      [currentUser.name, currentUser.userName]
        .filter((v): v is string => Boolean(v && !isPlaceholderValue(v)))
        .map((v) => cleanToken(v))
        .filter((t) => t.length >= 2)
    ),
  };

  return uniqueRel.filter((rel) => {
    if (!rel) return false;

    if (
      !matchesActiveUnitAndUlp(
        rel.unitId,
        rel.ulpName,
        activeUnitId,
        activeUnitName || currentUser.unitName || ''
      )
    ) {
      return false;
    }

    const relReguStr = String(
      rel.reguName || (rel as any).REGU_ROW || (rel as any).regu || ''
    ).trim();
    const hasRelRegu = !isPlaceholderValue(relReguStr);

    // If realisasi explicitly belongs to a regu, strictly validate against user's regu
    if (hasRelRegu) {
      return matchesStrictTeamOrOwner(
        relReguStr,
        String((rel as any).reguId || ''),
        String(rel.petugasId || ''),
        String(rel.petugasName || ''),
        String(rel.ulpName || ''),
        identity
      );
    }

    // If reguName on realisasi is blank, allow ONLY if linked to user's own WO or direct owner match
    const relWoId = String(rel.workOrderId || rel.WO_ID || rel.woId || '').trim().toLowerCase();
    const relNomorWo = String(rel.nomorWO || rel.Nomor_WO || '').trim().toUpperCase();
    if (relWoId && idSet.has(relWoId)) return true;
    if (relNomorWo && nomorSet.has(relNomorWo)) return true;

    return matchesStrictTeamOrOwner(
      '',
      String((rel as any).reguId || ''),
      String(rel.petugasId || ''),
      String(rel.petugasName || ''),
      String(rel.ulpName || ''),
      identity
    );
  });
}

export function computeUserTodayMetrics(
  userRealisasi: Realisasi[],
  todayWIB: string = getWIBDateString()
): {
  totalRealisasiHariIni: number;
  totalTebangHariIni: number;
  totalPangkasHariIni: number;
} {
  let totalRealisasiHariIni = 0;
  let totalTebangHariIni = 0;
  let totalPangkasHariIni = 0;

  userRealisasi.forEach((rel) => {
    const relDate = getItemDateISO(rel);
    if (relDate !== todayWIB) return;

    totalRealisasiHariIni += 1;
    const pohonCount = getRealisasiPohonCount(rel);
    const action = classifyRealisasiAction(rel);
    if (action === 'TEBANG') {
      totalTebangHariIni += pohonCount;
    } else {
      totalPangkasHariIni += pohonCount;
    }
  });

  return {
    totalRealisasiHariIni,
    totalTebangHariIni,
    totalPangkasHariIni,
  };
}
