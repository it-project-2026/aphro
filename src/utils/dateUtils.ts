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

  // 1. Handle full ISO strings (contains 'T')
  // We MUST use local parts for these absolute times to correctly interpret the day
  // relative to the user's timezone (e.g. 17:00 UTC 19th -> 00:00 WIB 20th)
  if (s.includes('T')) {
    try {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch (e) {}
  }

  // 2. Check for YYYY-MM-DD plain string pattern
  // Prioritize this for naive strings to avoid any timezone shifts
  const ymdMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2]}-${ymdMatch[3]}`;
  }
  
  // 3. Check for DD-MM-YYYY or DD/MM/YYYY (Common Indonesian format)
  const dmyMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
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
