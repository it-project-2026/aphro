/**
 * Utility Hari Libur Nasional Indonesia dan Deteksi Hari Kerja / Libur / Akhir Pekan
 */

export interface HolidayInfo {
  dateStr: string; // YYYY-MM-DD
  name: string;
}

// Daftar Hari Libur Nasional Resmi Indonesia (2024 - 2027)
export const INDONESIAN_HOLIDAYS: Record<string, string> = {
  // 2024
  '2024-01-01': 'Tahun Baru 2024 Masehi',
  '2024-02-08': 'Isra Mi\'raj Nabi Muhammad SAW',
  '2024-02-09': 'Cuti Bersama Tahun Baru Imlek',
  '2024-02-10': 'Tahun Baru Imlek 2575 Kongzili',
  '2024-03-11': 'Hari Suci Nyepi Tahun Baru Saka 1946',
  '2024-03-29': 'Wafat Isa Al Masih',
  '2024-03-31': 'Hari Paskah',
  '2024-04-10': 'Hari Raya Idul Fitri 1445 H',
  '2024-04-11': 'Hari Raya Idul Fitri 1445 H',
  '2024-05-01': 'Hari Buruh Internasional',
  '2024-05-09': 'Kenaikan Isa Al Masih',
  '2024-05-23': 'Hari Raya Waisak 2568 BE',
  '2024-06-01': 'Hari Lahir Pancasila',
  '2024-06-17': 'Hari Raya Idul Adha 1445 H',
  '2024-07-07': 'Tahun Baru Islam 1446 H',
  '2024-08-17': 'Hari Kemerdekaan Republik Indonesia',
  '2024-09-16': 'Maulid Nabi Muhammad SAW',
  '2024-12-25': 'Hari Raya Natal',

  // 2025
  '2025-01-01': 'Tahun Baru 2025 Masehi',
  '2025-01-27': 'Isra Mi\'raj Nabi Muhammad SAW',
  '2025-01-29': 'Tahun Baru Imlek 2576 Kongzili',
  '2025-03-29': 'Hari Suci Nyepi Tahun Baru Saka 1947',
  '2025-03-31': 'Hari Raya Idul Fitri 1446 H',
  '2025-04-01': 'Hari Raya Idul Fitri 1446 H',
  '2025-04-18': 'Wafat Yesus Kristus',
  '2025-04-20': 'Kebangkitan Yesus Kristus (Paskah)',
  '2025-05-01': 'Hari Buruh Internasional',
  '2025-05-12': 'Hari Raya Waisak 2569 BE',
  '2025-05-29': 'Kenaikan Yesus Kristus',
  '2025-06-01': 'Hari Lahir Pancasila',
  '2025-06-06': 'Hari Raya Idul Adha 1446 H',
  '2025-06-27': 'Tahun Baru Islam 1447 H',
  '2025-08-17': 'Hari Kemerdekaan Republik Indonesia',
  '2025-09-05': 'Maulid Nabi Muhammad SAW',
  '2025-12-25': 'Hari Raya Natal',

  // 2026
  '2026-01-01': 'Tahun Baru 2026 Masehi',
  '2026-01-16': 'Isra Mi\'raj Nabi Muhammad SAW',
  '2026-02-17': 'Tahun Baru Imlek 2577 Kongzili',
  '2026-03-19': 'Hari Suci Nyepi Tahun Baru Saka 1948',
  '2026-03-20': 'Hari Raya Idul Fitri 1447 H',
  '2026-03-21': 'Hari Raya Idul Fitri 1447 H',
  '2026-04-03': 'Wafat Yesus Kristus',
  '2026-04-05': 'Kebangkitan Yesus Kristus (Paskah)',
  '2026-05-01': 'Hari Buruh Internasional',
  '2026-05-14': 'Kenaikan Yesus Kristus',
  '2026-05-27': 'Hari Raya Idul Adha 1447 H',
  '2026-05-31': 'Hari Raya Waisak 2570 BE',
  '2026-06-01': 'Hari Lahir Pancasila',
  '2026-06-02': 'Cuti Bersama Hari Lahir Pancasila',
  '2026-06-16': 'Tahun Baru Islam 1448 H',
  '2026-08-17': 'Hari Kemerdekaan Republik Indonesia',
  '2026-08-25': 'Maulid Nabi Muhammad SAW',
  '2026-12-25': 'Hari Raya Natal',

  // 2027
  '2027-01-01': 'Tahun Baru 2027 Masehi',
  '2027-01-06': 'Isra Mi\'raj Nabi Muhammad SAW',
  '2027-02-06': 'Tahun Baru Imlek 2578 Kongzili',
  '2027-03-08': 'Hari Suci Nyepi Tahun Baru Saka 1949',
  '2027-03-10': 'Hari Raya Idul Fitri 1448 H',
  '2027-03-11': 'Hari Raya Idul Fitri 1448 H',
  '2027-03-26': 'Wafat Yesus Kristus',
  '2027-03-28': 'Kebangkitan Yesus Kristus (Paskah)',
  '2027-05-01': 'Hari Buruh Internasional',
  '2027-05-06': 'Kenaikan Yesus Kristus',
  '2027-05-16': 'Hari Raya Idul Adha 1448 H',
  '2027-05-20': 'Hari Raya Waisak 2571 BE',
  '2027-06-01': 'Hari Lahir Pancasila',
  '2027-06-06': 'Tahun Baru Islam 1449 H',
  '2027-08-17': 'Hari Kemerdekaan Republik Indonesia',
  '2027-08-15': 'Maulid Nabi Muhammad SAW',
  '2027-12-25': 'Hari Raya Natal',
};

export const INDONESIAN_MONTHS = [
  'JANUARI',
  'FEBRUARI',
  'MARET',
  'APRIL',
  'MEI',
  'JUNI',
  'JULI',
  'AGUSTUS',
  'SEPTEMBER',
  'OKTOBER',
  'NOVEMBER',
  'DESEMBER',
];

export const INDONESIAN_DAYS_SHORT = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const INDONESIAN_DAYS_UPPER = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];

export interface DayDetail {
  dayNumber: number; // 1 - 31
  dayFormatted: string; // '01', '02', ...
  dayName: string; // 'Senin', 'Selasa', ...
  dayNameUpper: string; // 'SENIN', 'SELASA', ...
  dateStr: string; // 'YYYY-MM-DD'
  isWeekend: boolean;
  isSaturday: boolean;
  isSunday: boolean;
  isHoliday: boolean;
  holidayName?: string;
  isRedDay: boolean; // True jika Sabtu, Minggu, atau Libur Nasional
}

/**
 * Menghasilkan array hari dalam satu bulan beserta status libur/merah
 */
export function getDaysInMonth(year: number, monthIndex: number): DayDetail[] {
  // monthIndex: 0 = Januari, 5 = Juni, etc.
  const daysInMonthCount = new Date(year, monthIndex + 1, 0).getDate();
  const result: DayDetail[] = [];

  for (let d = 1; d <= daysInMonthCount; d++) {
    const dateObj = new Date(year, monthIndex, d);
    const dayOfWeek = dateObj.getDay(); // 0 = Minggu, 6 = Sabtu

    const monthPadded = String(monthIndex + 1).padStart(2, '0');
    const dayPadded = String(d).padStart(2, '0');
    const dateStr = `${year}-${monthPadded}-${dayPadded}`;

    const isSunday = dayOfWeek === 0;
    const isSaturday = dayOfWeek === 6;
    const isWeekend = isSunday || isSaturday;

    const holidayName = INDONESIAN_HOLIDAYS[dateStr];
    const isHoliday = Boolean(holidayName);
    const isRedDay = isWeekend || isHoliday;

    result.push({
      dayNumber: d,
      dayFormatted: dayPadded,
      dayName: INDONESIAN_DAYS_SHORT[dayOfWeek],
      dayNameUpper: INDONESIAN_DAYS_UPPER[dayOfWeek],
      dateStr,
      isWeekend,
      isSaturday,
      isSunday,
      isHoliday,
      holidayName,
      isRedDay,
    });
  }

  return result;
}
