import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const dbUrl = process.env.HYPERCLOUD_DATABASE_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

async function check() {
  const pool = new pg.Pool({ connectionString: dbUrl });
  try {
    console.log('Checking ABSENSI schema...');
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'ABSENSI';
    `);
    console.log('Columns in ABSENSI:');
    res.rows.forEach(row => {
      console.log(`- ${row.column_name} (${row.data_type})`);
    });

    if (res.rows.length === 0) {
      console.log('Table ABSENSI not found! Checking existing tables:');
      const tables = await pool.query(`
        SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
      `);
      tables.rows.forEach(t => console.log(`- ${t.table_name}`));
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

check();
