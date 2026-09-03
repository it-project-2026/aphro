/**
 * Helper utilities for parsing and formatting execution dates and times
 * specifically tailored for Indonesian date formats (DD-MM-YYYY) and WIB (Asia/Jakarta) timezone.
 */

/**
 * Safely extracts day, month (01-12), year (4-digit) from various input formats.
 * Prefers explicit DD/MM/YYYY or YYYY-MM-DD over timezone conversions to prevent day shifts.
 */
export function parseDateParts(input?: any): { day: string; month: string; year: string } | null {
  if (!input) return null;
  const s = String(input).trim();
  if (!s || s === '-') return null;

  // 1. Common Indonesia/Excel formats first: DD-MM-YYYY, DD/MM/YYYY, or DD.MM.YYYY
  const dmyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return { day, month, year };
  }

  // 2. YYYY-MM-DD, YYYY/MM/DD, or YYYY.MM.DD
  const ymdMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return { day, month, year };
  }

  // 3. Handle ISO strings or Date objects in WIB (Asia/Jakarta)
  try {
    const d = input instanceof Date ? input : new Date(s);
    if (!isNaN(d.getTime())) {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(d);
      const map: Record<string, string> = {};
      parts.forEach(p => { if (p.type !== 'literal') map[p.type] = p.value; });
      if (map.day && map.month && map.year) {
        return { day: map.day.padStart(2, '0'), month: map.month.padStart(2, '0'), year: map.year };
      }
    }
  } catch (e) {}

  return null;
}

/**
 * Extracts HH:mm:ss time string from various inputs in WIB (Asia/Jakarta).
 */
export function parseTimeParts(input?: any): string | null {
  if (!input) return null;
  const s = String(input).trim();
  if (!s || s === '-') return null;

  // 1. Check if string contains explicit time format HH:mm:ss or HH:mm
  const timeMatch = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (timeMatch) {
    const hh = timeMatch[1].padStart(2, '0');
    const mm = timeMatch[2].padStart(2, '0');
    const ss = (timeMatch[3] || '00').padStart(2, '0');
    if (hh !== '00' || mm !== '00' || ss !== '00') {
      return `${hh}:${mm}:${ss}`;
    }
  }

  // 2. Parse ISO string or Date object in Asia/Jakarta timezone
  if (s.includes('T') || s.includes('Z') || input instanceof Date || !isNaN(Number(s))) {
    try {
      const d = input instanceof Date ? input : new Date(s);
      if (!isNaN(d.getTime())) {
        const parts = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).formatToParts(d);
        const map: Record<string, string> = {};
        parts.forEach(p => { if (p.type !== 'literal') map[p.type] = p.value; });
        if (map.hour) {
          const hh = (map.hour === '24' ? '00' : map.hour).padStart(2, '0');
          const mm = (map.minute || '00').padStart(2, '0');
          const ss = (map.second || '00').padStart(2, '0');
          return `${hh}:${mm}:${ss}`;
        }
      }
    } catch (e) {}
  }

  return null;
}

export function formatDateTime(dateInput?: string | Date): string {
  if (!dateInput) return '-';
  const dateParts = parseDateParts(dateInput);
  if (!dateParts) return String(dateInput);
  const timeStr = parseTimeParts(dateInput) || '00:00:00';
  return `${dateParts.day}-${dateParts.month}-${dateParts.year} ${timeStr}`;
}

export function formatDateOnly(dateInput?: string | Date): string {
  if (!dateInput) return '-';
  const dateParts = parseDateParts(dateInput);
  if (!dateParts) return String(dateInput);
  return `${dateParts.day}-${dateParts.month}-${dateParts.year}`;
}

/**
 * Formats "TANGGAL EKSEKUSI" combining the explicit execution date and the true transaction timestamp.
 */
export function formatExecutionDateTime(rel?: any, wo?: any): string {
  if (!rel && !wo) return '-';

  // 1. Determine Date Parts
  // Prioritize explicit tanggalRealisasi/tanggal first, then photo/createdAt candidates
  const dateCandidates = [
    rel?.tanggalRealisasi,
    rel?.tanggal,
    wo?.tanggal,
    rel?.photosSebelum?.[0]?.timestamp,
    rel?.photosSesudah?.[0]?.timestamp,
    rel?.createdAt,
    wo?.createdAt,
  ];

  let dateParts: { day: string; month: string; year: string } | null = null;
  for (const cand of dateCandidates) {
    dateParts = parseDateParts(cand);
    if (dateParts) break;
  }

  if (!dateParts) return '-';

  // 2. Determine Time Parts
  const timeCandidates = [
    rel?.photosSebelum?.[0]?.timestamp,
    rel?.photosSesudah?.[0]?.timestamp,
    rel?.createdAt,
    wo?.createdAt,
    rel?.tanggalRealisasi,
    rel?.tanggal,
    wo?.tanggal,
  ];

  let timeStr: string | null = null;
  for (const cand of timeCandidates) {
    timeStr = parseTimeParts(cand);
    if (timeStr && timeStr !== '00:00:00') break;
  }

  if (!timeStr) {
    timeStr = '00:00:00';
  }

  return `${dateParts.day}-${dateParts.month}-${dateParts.year} ${timeStr}`;
}

