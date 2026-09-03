/**
 * Helper to normalize and format dates for display, 
 * especially to handle ISO strings from Google Apps Script.
 */
export const formatDateDisplay = (dateVal: any): string => {
  if (!dateVal) return '-';
  const s = String(dateVal).trim();
  if (!s || s === 'null' || s === 'undefined') return '-';

  // If it's already YYYY-MM-DD
  const ymdMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
  }

  // Handle common Indonesia formats: DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }

  // If ISO string or date
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return getWIBDateString(d);
    }
  } catch (e) {
    // fallback
  }
  
  return s.slice(0, 10);
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

  // Handle common Indonesia/Excel formats first: DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Handle YYYY-MM-DD plain string pattern (possibly with time, without T)
  const ymdMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch && !s.includes('T')) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Handle ISO strings or numeric timestamps
  try {
    const d = new Date(s);
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

