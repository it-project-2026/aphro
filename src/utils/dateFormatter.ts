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

  // 1. Google Visualization JSON date format: Date(yyyy, m, d, h, m, s) or Date(ms)
  const gvisMatch = s.match(/^Date\((\d+)(?:,\s*(\d+))?(?:,\s*(\d+))?(?:,\s*(\d+))?(?:,\s*(\d+))?(?:,\s*(\d+))?\)/i);
  if (gvisMatch) {
    const [, yStr, mStr, dStr, hStr, minStr, secStr] = gvisMatch;
    if (mStr !== undefined) {
      const year = yStr;
      const month = String(parseInt(mStr, 10) + 1).padStart(2, '0');
      const day = String(parseInt(dStr || '1', 10)).padStart(2, '0');
      const hh = String(parseInt(hStr || '0', 10)).padStart(2, '0');
      const mm = String(parseInt(minStr || '0', 10)).padStart(2, '0');
      const ss = String(parseInt(secStr || '0', 10)).padStart(2, '0');
      return `${day}-${month}-${year} ${hh}:${mm}:${ss}`;
    } else {
      const ms = parseInt(yStr, 10);
      const d = new Date(ms);
      if (!isNaN(d.getTime())) {
        const loc = getLocalDateTimeString(d);
        const [datePart, timePart] = loc.split(' ');
        const [y, m, day] = datePart.split('-');
        return `${day}-${m}-${y} ${timePart}`;
      }
    }
  }

  // 2. ISO string WITH explicit UTC marker ('Z') or explicit offset (+07:00, -05:00)
  if (s.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(s)) {
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
  }

  // 3. Indonesian format DD-MM-YYYY HH:mm:ss or DD/MM/YYYY HH:mm:ss
  const dmyTimeMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[\sT]+(\d{1,2}:\d{1,2}(?::\d{1,2})?))?/);
  if (dmyTimeMatch) {
    const day = dmyTimeMatch[1].padStart(2, '0');
    const month = dmyTimeMatch[2].padStart(2, '0');
    const year = dmyTimeMatch[3];
    const time = dmyTimeMatch[4] || '00:00:00';
    const fullTime = time.length === 5 ? `${time}:00` : time;
    return `${day}-${month}-${year} ${fullTime}`;
  }

  // 4. Plain ISO/standard YYYY-MM-DD HH:mm:ss or YYYY-MM-DDTHH:mm:ss without Z/offset (ALREADY local WIB)
  const ymdTimeMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[\sT]+(\d{1,2}:\d{1,2}(?::\d{1,2})?))?/);
  if (ymdTimeMatch) {
    const year = ymdTimeMatch[1];
    const month = ymdTimeMatch[2].padStart(2, '0');
    const day = ymdTimeMatch[3].padStart(2, '0');
    const time = ymdTimeMatch[4] || '00:00:00';
    const fullTime = time.length === 5 ? `${time}:00` : time;
    return `${day}-${month}-${year} ${fullTime}`;
  }

  // 5. Fallback for pure numeric timestamp
  if (/^\d{10,13}$/.test(s)) {
    const d = new Date(parseInt(s, 10));
    if (!isNaN(d.getTime())) {
      const loc = getLocalDateTimeString(d);
      const [datePart, timePart] = loc.split(' ');
      const [y, m, day] = datePart.split('-');
      return `${day}-${m}-${y} ${timePart}`;
    }
  }

  // 6. Generic Date fallback
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
  const relTime =
    rel?.timestamp ||
    rel?.Timestamp ||
    rel?.createdAt ||
    rel?.CREATED_AT ||
    rel?.Created_At ||
    rel?.tanggalRealisasi ||
    rel?.TANGGAL;

  if (relTime) {
    const formatted = formatDateTime(relTime);
    if (formatted !== '-' && !formatted.endsWith('00:00:00')) {
      return formatted;
    }
  }

  // 2. Check photo timestamps
  const photoTs =
    rel?.photosSebelum?.[0]?.timestamp ||
    rel?.photosSesudah?.[0]?.timestamp ||
    rel?.fotoSebelumTimestamp ||
    rel?.fotoSesudahTimestamp;

  if (photoTs) {
    const formatted = formatDateTime(photoTs);
    if (formatted !== '-' && !formatted.endsWith('00:00:00')) {
      return formatted;
    }
  }

  // 3. Check wo.createdAt
  const woTime = wo?.createdAt || wo?.CREATED_AT || wo?.Created_At;
  if (woTime) {
    const formatted = formatDateTime(woTime);
    if (formatted !== '-' && !formatted.endsWith('00:00:00')) {
      return formatted;
    }
  }

  // 4. Fallback to any base date
  const dateBase =
    rel?.tanggalRealisasi ||
    rel?.TANGGAL ||
    rel?.timestamp ||
    rel?.Timestamp ||
    wo?.tanggal ||
    wo?.TANGGAL ||
    rel?.createdAt ||
    wo?.createdAt;

  if (!dateBase) return '-';

  return formatDateTime(dateBase);
}

