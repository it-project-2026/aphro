import { getLocalDateTimeString } from './dateUtils';

export function formatDateTime(dateInput?: string | Date): string {
  if (!dateInput) return '-';

  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return '-';
    const loc = getLocalDateTimeString(dateInput);
    const [datePart, timePart] = loc.split(' ');
    const [y, m, d] = datePart.split('-');
    return `${d}-${m}-${y} ${timePart}`;
  }

  const s = String(dateInput).trim();
  if (!s || s === 'null' || s === 'undefined') return '-';

  // 1. Handle ISO strings containing 'T' (e.g. YYYY-MM-DDTHH:mm:ss, ISO UTC)
  if (s.includes('T')) {
    try {
      const isoStr = (s.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(s)) ? s : `${s}Z`;
      const d = new Date(isoStr);
      if (!isNaN(d.getTime())) {
        const loc = getLocalDateTimeString(d);
        const [datePart, timePart] = loc.split(' ');
        const [y, m, day] = datePart.split('-');
        return `${day}-${m}-${y} ${timePart}`;
      }
    } catch {
      // fallback
    }
  }

  // 2. Indonesian format DD-MM-YYYY HH:mm:ss or DD/MM/YYYY HH:mm:ss
  const dmyTimeMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:\s+(\d{1,2}:\d{1,2}(?::\d{1,2})?))?/);
  if (dmyTimeMatch) {
    const day = dmyTimeMatch[1].padStart(2, '0');
    const month = dmyTimeMatch[2].padStart(2, '0');
    const year = dmyTimeMatch[3];
    const time = dmyTimeMatch[4] || '00:00:00';
    const fullTime = time.length === 5 ? `${time}:00` : time;
    return `${day}-${month}-${year} ${fullTime}`;
  }

  // 3. YYYY-MM-DD HH:mm:ss or YYYY-MM-DDTHH:mm:ss (Plain local string without Z)
  const ymdTimeMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[\sT]+(\d{1,2}:\d{1,2}(?::\d{1,2})?))?/);
  if (ymdTimeMatch) {
    const year = ymdTimeMatch[1];
    const month = ymdTimeMatch[2].padStart(2, '0');
    const day = ymdTimeMatch[3].padStart(2, '0');
    const time = ymdTimeMatch[4] || '00:00:00';
    const fullTime = time.length === 5 ? `${time}:00` : time;
    return `${day}-${month}-${year} ${fullTime}`;
  }

  // 3. Fallback for numeric timestamps
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const loc = getLocalDateTimeString(d);
      const [datePart, timePart] = loc.split(' ');
      const [y, m, day] = datePart.split('-');
      return `${day}-${m}-${y} ${timePart}`;
    }
  } catch {
    // fallback
  }

  return s;
}

export function formatDateOnly(dateInput?: string | Date): string {
  if (!dateInput) return '-';
  const full = formatDateTime(dateInput);
  if (full === '-') return '-';
  return full.split(' ')[0];
}

export function formatExecutionDateTime(rel?: any, wo?: any): string {
  if (!rel && !wo) return '-';

  // 1. Prefer rel.timestamp, rel.createdAt, or rel.tanggalRealisasi if it contains a full datetime
  const relTime = rel?.timestamp || rel?.createdAt || rel?.tanggalRealisasi;
  if (relTime) {
    const formatted = formatDateTime(relTime);
    if (formatted !== '-' && !formatted.endsWith('00:00:00')) {
      return formatted;
    }
  }

  // 2. Check photo timestamps
  const photoTs = rel?.photosSebelum?.[0]?.timestamp || rel?.photosSesudah?.[0]?.timestamp;
  if (photoTs) {
    const formatted = formatDateTime(photoTs);
    if (formatted !== '-' && !formatted.endsWith('00:00:00')) {
      return formatted;
    }
  }

  // 3. Check wo.createdAt
  if (wo?.createdAt) {
    const formatted = formatDateTime(wo.createdAt);
    if (formatted !== '-' && !formatted.endsWith('00:00:00')) {
      return formatted;
    }
  }

  // 4. Fallback to any base date
  const dateBase = rel?.tanggalRealisasi || rel?.timestamp || wo?.tanggal || rel?.createdAt || wo?.createdAt;
  if (!dateBase) return '-';

  return formatDateTime(dateBase);
}
