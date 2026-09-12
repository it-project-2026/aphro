import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://npeeobcpffmlyiknszhh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZWVvYmNwZmZtbHlpa25zemhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MzQ0MzAsImV4cCI6MjEwNDQxMDQzMH0.-48iDwqMfKHBfVcJx6A_McxWl2StzFjzyHFPaKMZq98'
);

async function inspectColumns() {
  const tables = ['INISIASI', 'WORK_ORDER', 'REALISASI', 'ABSENSI', 'USERS', 'ULP', 'PENYULANG', 'REGU_ROW', 'PETUGAS'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    console.log(`Table [${t}] select error:`, error ? error.message : 'NONE');
    if (data && data.length > 0) {
      console.log(`Table [${t}] columns:`, Object.keys(data[0]));
    }
  }
}

inspectColumns();
