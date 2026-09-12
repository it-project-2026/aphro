import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://npeeobcpffmlyiknszhh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZWVvYmNwZmZtbHlpa25zemhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MzQ0MzAsImV4cCI6MjEwNDQxMDQzMH0.-48iDwqMfKHBfVcJx6A_McxWl2StzFjzyHFPaKMZq98'
);

async function checkAll() {
  const tableVariations = [
    'INISIASI', 'inisiasi', '"INISIASI"', '"inisiasi"',
    'WORK_ORDER', 'work_order', 'work_orders', '"WORK_ORDER"',
    'REALISASI', 'realisasi', '"REALISASI"',
    'ABSENSI', 'absensi', '"ABSENSI"',
    'USERS', 'users', '"USERS"',
    'ULP', 'ulp', '"ULP"',
    'PENYULANG', 'penyulang', '"PENYULANG"',
    'REGU_ROW', 'regu_row', '"REGU_ROW"',
    'PETUGAS', 'petugas', '"PETUGAS"'
  ];

  for (const t of tableVariations) {
    const { data, error, count } = await supabase.from(t).select('*', { count: 'exact' });
    if (!error) {
      console.log(`Table [${t}] -> status: OK, count: ${count}, rows:`, data?.length);
      if (data && data.length > 0) {
        console.log(`Sample row for [${t}]:`, data[0]);
      }
    } else {
      console.log(`Table [${t}] -> error: ${error.message} (code: ${error.code})`);
    }
  }
}

checkAll();
