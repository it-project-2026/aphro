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
