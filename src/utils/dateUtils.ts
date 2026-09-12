/**
 * Helper to normalize and format dates for display, 
 * especially to handle ISO strings from Google Apps Script and Supabase.
 */
export const formatDateDisplay = (dateVal: any): string => {
  if (!dateVal) return '-';
  const s = String(dateVal).trim();
  if (!s || s === 'null' || s === 'undefined') return '-';

  try {
    // 1. If it has T or ends with Z, parse directly with Date in Asia/Jakarta timezone
    if (s.includes('T') || s.endsWith('Z')) {
      const dateObj = new Date(s);
      if (!isNaN(dateObj.getTime())) {
        return new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Jakarta',
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).format(dateObj);
      }
    }

    let dateObj: Date;

    // 2. Handle DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
    const dmyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (dmyMatch) {
      dateObj = new Date(
        parseInt(dmyMatch[3], 10),
        parseInt(dmyMatch[2], 10) - 1,
        parseInt(dmyMatch[1], 10),
        12,
        0,
        0
      );
    } else {
      // 3. Handle YYYY-MM-DD
      const ymdMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
      if (ymdMatch) {
        dateObj = new Date(
          parseInt(ymdMatch[1], 10),
          parseInt(ymdMatch[2], 10) - 1,
          parseInt(ymdMatch[3], 10),
          12,
          0,
          0
        );
      } else {
        // Fallback for timestamps
        dateObj = new Date(s);
      }
    }

    if (isNaN(dateObj.getTime())) {
      return s;
    }

    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(dateObj);

  } catch (e) {
    return s;
  }
};

export const getLocalDateTimeString = (dateInput = new Date()): string => {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(dateInput);

    const map: Record<string, string> = {};
    parts.forEach((p) => {
      if (p.type !== 'literal') map[p.type] = p.value;
    });

    const hh = map.hour === '24' ? '00' : (map.hour || '00');
    return `${map.year}-${map.month}-${map.day} ${hh}:${map.minute}:${map.second}`;
  } catch (e) {
    const wibDate = new Date(dateInput.getTime() + (7 * 60 * 60 * 1000));
    return wibDate.toISOString().replace('T', ' ').slice(0, 19);
  }
};

const INDO_MONTH_MAP: Record<string, string> = {
  'JANUARI': '01', 'JANUARY': '01',
  'FEBRUARI': '02', 'FEBRUARY': '02',
  'MARET': '03', 'MARCH': '03',
  'APRIL': '04',
  'MEI': '05', 'MAY': '05',
  'JUNI': '06', 'JUNE': '06',
  'JULI': '07', 'JULY': '07',
  'AGUSTUS': '08', 'AUGUST': '08',
  'SEPTEMBER': '09',
  'OKTOBER': '10', 'OCTOBER': '10',
  'NOVEMBER': '11',
  'DESEMBER': '12', 'DECEMBER': '12'
};

/**
 * Normalizes various date string formats (ISO, DD-MM-YYYY, DD/MM/YYYY, or Numbers)
 * into a standard YYYY-MM-DD string for comparison.
 * Optimized for accuracy in local timezones (like WIB).
 */
export const normalizeDateISO = (dateVal: any): string => {
  if (!dateVal) return '';

  if (dateVal instanceof Date) {
    return getWIBDateString(dateVal);
  }

  const s = String(dateVal).trim();
  if (!s || s === 'null' || s === 'undefined') return '';

  // 1. Handle ISO strings with time or UTC indicator (e.g. "2026-09-09T17:00:00.000Z" or strings containing 'T' or ending with 'Z')
  // This correctly shifts midnight UTC to the actual calendar day in WIB (+7)
  if (s.includes('T') || s.endsWith('Z')) {
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) {
      return getWIBDateString(dt);
    }
  }

  const upperStr = s.toUpperCase();

  // 2. Try to parse Indonesian/English textual date containing month names (e.g., "Selasa, 08 September 2026")
  for (const [monthName, monthCode] of Object.entries(INDO_MONTH_MAP)) {
    if (upperStr.includes(monthName)) {
      const patternComma = new RegExp(`(\\d{1,2})\\s*,?\\s*${monthName}\\s*,?\\s*(20\\d{2})`);
      const matchComma = upperStr.match(patternComma);
      if (matchComma) {
        const d = matchComma[1].padStart(2, '0');
        const y = matchComma[2];
        return `${y}-${monthCode}-${d}`;
      }
    }
  }

  // 3. Check for literal YYYY-MM-DD prefix (e.g., "2026-09-08" or "2026-09-08 14:30:00")
  const ymdMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 4. Handle common Indonesia/Excel formats first: DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // 5. Fallback to full JS Date parsing if it's not matched by literal extractors
  try {
    const d = new Date(isNaN(Number(s)) ? s : Number(s));
    if (!isNaN(d.getTime())) {
      return getWIBDateString(d);
    }
  } catch (e) {}

  return s.slice(0, 10);
};

/**
 * Returns current date string formatted in WIB (UTC+7, Asia/Jakarta) as "YYYY-MM-DD"
 */
export const getWIBDateString = (date = new Date()): string => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch (e) {
    const wibDate = new Date(date.getTime() + (7 * 60 * 60 * 1000));
    return wibDate.toISOString().split('T')[0];
  }
};

/**
 * Calculates milliseconds remaining until 00:00:00 WIB (UTC+7)
 */
export const getMsUntilNextWIBMidnight = (): number => {
  const now = new Date();
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
      hour12: false,
    }).formatToParts(now);

    const map: Record<string, number> = {};
    parts.forEach((p) => {
      if (p.type !== 'literal') map[p.type] = parseInt(p.value, 10);
    });

    const currentHour = map.hour === 24 ? 0 : (map.hour || 0);
    const currentMinute = map.minute || 0;
    const currentSecond = map.second || 0;

    const secondsPastMidnightWIB = (currentHour * 3600) + (currentMinute * 60) + currentSecond;
    const secondsToMidnight = 86400 - secondsPastMidnightWIB;
    return Math.max(secondsToMidnight * 1000, 2000);
  } catch (e) {
    return 3600000; // 1 hour fallback
  }
};

/**
 * Extracts and parses correct date YYYY-MM-DD from nomorWO
 * format: M[Week]/[Day]/[MonthName]/[Year]/[ULP]/[Team]
 */
export const parseDateFromNomorWO = (nomorWO: string): string | null => {
  if (!nomorWO) return null;
  const s = String(nomorWO).trim().toUpperCase();

  // Check if nomorWO contains an ISO date e.g. 2026-09-10 or 2026-09-09
  const isoMatch = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const yyyy = isoMatch[1];
    const mm = isoMatch[2].padStart(2, '0');
    const dd = isoMatch[3].padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // Check for DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const dd = dmyMatch[1].padStart(2, '0');
    const mm = dmyMatch[2].padStart(2, '0');
    const yyyy = dmyMatch[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  const parts = s.split('/');
  if (parts.length < 4) return null;

  let dayNum: number = NaN;
  let monthNumStr: string | null = null;
  let yearNum: number = NaN;

  // Pattern A: [Prefix]/[Day]/[Month]/[Year]/...
  const p1Num = parseInt(parts[1].trim(), 10);
  const p2Month = INDO_MONTH_MAP[parts[2].trim()] || (parseInt(parts[2].trim(), 10) >= 1 && parseInt(parts[2].trim(), 10) <= 12 ? parts[2].trim().padStart(2, '0') : null);

  if (!isNaN(p1Num) && p1Num >= 1 && p1Num <= 31 && p2Month) {
    dayNum = p1Num;
    monthNumStr = p2Month;
    yearNum = parseInt(parts[3].trim(), 10);
  } else {
    // Pattern B: [Prefix]/[Month]/[Day]/[Year]/...
    const p1Month = INDO_MONTH_MAP[parts[1].trim()] || (parseInt(parts[1].trim(), 10) >= 1 && parseInt(parts[1].trim(), 10) <= 12 ? parts[1].trim().padStart(2, '0') : null);
    const p2Num = parseInt(parts[2].trim(), 10);
    if (p1Month && !isNaN(p2Num) && p2Num >= 1 && p2Num <= 31) {
      dayNum = p2Num;
      monthNumStr = p1Month;
      yearNum = parseInt(parts[3].trim(), 10);
    }
  }

  if (isNaN(dayNum) || !monthNumStr || isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
    return null;
  }

  const dd = String(dayNum).padStart(2, '0');
  const mm = monthNumStr;
  const yyyy = String(yearNum);

  return `${yyyy}-${mm}-${dd}`;
};

/**
 * Resolves the canonical YYYY-MM-DD date from an entity (WorkOrder, Realisasi, or generic item).
 * Prioritizes explicit date fields, falls back to parsing Nomor WO, then createdAt/timestamp.
 */
export const getItemDateISO = (item: any): string => {
  if (!item) return '';
  
  // 1. Direct explicit date fields
  const directDate = item.tanggal ?? item.tanggalRealisasi ?? item.Tanggal ?? item.TANGGAL;
  const directIso = normalizeDateISO(directDate);
  if (directIso) return directIso;

  // 2. Derive from nomorWO if present
  const noWo = item.nomorWO || item.Nomor_WO || item.nomor_wo;
  if (noWo) {
    const fromWo = parseDateFromNomorWO(noWo);
    if (fromWo) return fromWo;
  }

  // 3. Fallback to createdAt or timestamp
  const fallbackDate = item.createdAt || item.Created_At || item.timestamp || item.Timestamp;
  if (fallbackDate) {
    const fallbackIso = normalizeDateISO(fallbackDate);
    if (fallbackIso) return fallbackIso;
  }

  return '';
};

