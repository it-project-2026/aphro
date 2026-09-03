/**
 * Helper to normalize and format dates for display, 
 * especially to handle ISO strings from Google Apps Script.
 */
export const formatDateDisplay = (dateVal: any): string => {
  if (!dateVal) return '-';
  const s = String(dateVal);
  
  // If it's an ISO string (e.g., 2026-08-19T17:00:00.000Z)
  if (s.includes('T') && (s.endsWith('Z') || s.includes('+'))) {
    try {
      const d = new Date(s);
      // We know these dates usually represent local midnight but were shifted to UTC
      // If it's 17:00 of the previous day, it means it was midnight of the next day in WIB (+7)
      
      // We can use a trick: if hours are > 12, it's likely a previous day shift
      if (d.getUTCHours() >= 12) {
         const nextDay = new Date(d);
         nextDay.setUTCDate(d.getUTCDate() + 1);
         return nextDay.toISOString().slice(0, 10);
      }
      
      return d.toISOString().slice(0, 10);
    } catch (e) {
      return s.slice(0, 10);
    }
  }
  
  // If it's already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }

  return s;
};

export const getLocalDateTimeString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

/**
 * Normalizes various date string formats (ISO, DD-MM-YYYY, DD/MM/YYYY, or Numbers)
 * into a standard YYYY-MM-DD string for comparison.
 * Optimized for accuracy in local timezones (like WIB).
 */
export const normalizeDateISO = (dateVal: any): string => {
  if (!dateVal) return '';

  // If it's already a Date object, use local parts
  if (dateVal instanceof Date) {
    const year = dateVal.getFullYear();
    const month = String(dateVal.getMonth() + 1).padStart(2, '0');
    const day = String(dateVal.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const s = String(dateVal).trim();
  if (!s) return '';

  // Handle common Indonesia/Excel formats first: DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // 1. Handle full ISO strings (contains 'T')
  if (s.includes('T')) {
    try {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        // If it's a Zulu time at 17:00, it's usually meant to be midnight of the NEXT day in WIB
        if (s.endsWith('Z') && d.getUTCHours() >= 12) {
          const nextDay = new Date(d.getTime() + 12 * 60 * 60 * 1000);
          const year = nextDay.getFullYear();
          const month = String(nextDay.getMonth() + 1).padStart(2, '0');
          const day = String(nextDay.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch (e) {}
  }

  // 2. Check for YYYY-MM-DD plain string pattern (possibly with time)
  const ymdMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 4. Handle numerical timestamps (milliseconds)
  if (/^\d{10,}$/.test(s)) {
    const d = new Date(Number(s));
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  
  // 5. Final fallback attempt with native parsing
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
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

