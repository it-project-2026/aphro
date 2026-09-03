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

  // 1. Indonesian format DD-MM-YYYY HH:mm:ss or DD/MM/YYYY HH:mm:ss
  const dmyTimeMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:\s+(\d{1,2}:\d{1,2}(?::\d{1,2})?))?/);
  if (dmyTimeMatch) {
    const day = dmyTimeMatch[1].padStart(2, '0');
    const month = dmyTimeMatch[2].padStart(2, '0');
    const year = dmyTimeMatch[3];
    const time = dmyTimeMatch[4] || '00:00:00';
    const fullTime = time.length === 5 ? `${time}:00` : time;
    return `${day}-${month}-${year} ${fullTime}`;
  }

  // 2. YYYY-MM-DD HH:mm:ss or YYYY-MM-DD HH:mm (Plain string without 'T')
  const ymdTimeMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\s+(\d{1,2}:\d{1,2}(?::\d{1,2})?))?/);
  if (ymdTimeMatch && !s.includes('T')) {
    const year = ymdTimeMatch[1];
    const month = ymdTimeMatch[2].padStart(2, '0');
    const day = ymdTimeMatch[3].padStart(2, '0');
    const time = ymdTimeMatch[4] || '00:00:00';
    const fullTime = time.length === 5 ? `${time}:00` : time;
    return `${day}-${month}-${year} ${fullTime}`;
  }

  // 3. ISO format or numeric timestamp
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

  // 1. Prefer rel.timestamp or rel.tanggalRealisasi if it contains a full datetime
  const relTime = rel?.timestamp || rel?.tanggalRealisasi;
  if (relTime) {
    const formatted = formatDateTime(relTime);
    if (formatted !== '-' && !formatted.endsWith('00:00:00')) {
      return formatted;
    }
  }

  // 2. Check createdAt
  const createdAtVal = rel?.createdAt || wo?.createdAt;
  if (createdAtVal) {
    const formatted = formatDateTime(createdAtVal);
    if (formatted !== '-' && !formatted.endsWith('00:00:00')) {
      return formatted;
    }
  }

  // 3. Check photo timestamps
  const photoTs = rel?.photosSebelum?.[0]?.timestamp || rel?.photosSesudah?.[0]?.timestamp;
  if (photoTs) {
    const formatted = formatDateTime(photoTs);
    if (formatted !== '-' && !formatted.endsWith('00:00:00')) {
      return formatted;
    }
  }

  // 4. Fallback to any base date
  const dateBase = rel?.tanggalRealisasi || rel?.timestamp || wo?.tanggal || rel?.createdAt || wo?.createdAt;
  if (!dateBase) return '-';

  return formatDateTime(dateBase);
}
