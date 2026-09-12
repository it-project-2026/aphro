import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://npeeobcpffmlyiknszhh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZWVvYmNwZmZtbHlpa25zemhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MzQ0MzAsImV4cCI6MjEwNDQxMDQzMH0.-48iDwqMfKHBfVcJx6A_McxWl2StzFjzyHFPaKMZq98'
);

async function testSelectAndInsert() {
  const tables = ['INISIASI', 'WORK_ORDER', 'REALISASI', 'ABSENSI', 'USERS', 'ULP', 'PENYULANG', 'REGU_ROW', 'PETUGAS'];
  for (const t of tables) {
    const s = await supabase.from(t).select('*');
    console.log(`SELECT ${t}: error = ${s.error ? s.error.message : 'none'}, count = ${s.data?.length}`);
  }
}

testSelectAndInsert();
