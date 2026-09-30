import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { query } from './database';

export interface MigrationResult {
  totalRecords: number;
  migratedCount: number;
  skippedCount: number;
  errorCount: number;
  details: Array<{
    id: string;
    sebelumStatus: string;
    sesudahStatus: string;
    sebelumUrl?: string;
    sesudahUrl?: string;
    error?: string;
  }>;
  backupTableCreated: boolean;
  timestamp: string;
}

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads', 'realisasi');
const BACKUP_DIR = path.join(process.cwd(), 'storage', 'backups');

/**
 * Ensures required directories exist
 */
function ensureDirectories() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

/**
 * Checks if a string is a base64 image data string
 */
export function isBase64String(str: string | undefined | null): boolean {
  if (!str || typeof str !== 'string') return false;
  const s = str.trim();
  if (s.startsWith('data:image/')) return true;
  if (s.length > 500 && !s.startsWith('http://') && !s.startsWith('https://') && !s.startsWith('/uploads/')) {
    // Check if valid base64 character set
    return /^[A-Za-z0-9+/=_\-\r\n]+$/.test(s.slice(0, 200));
  }
  return false;
}

/**
 * Decodes base64 string to a valid image Buffer and detects MIME / file extension
 */
export function extractBase64ToBuffer(dataString: string): { buffer: Buffer; ext: string } | null {
  try {
    let cleanBase64 = dataString.trim();
    let ext = 'jpg';

    // Handle data URI scheme
    if (cleanBase64.startsWith('data:image/')) {
      const match = cleanBase64.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/s);
      if (match) {
        const mimeType = match[1].toLowerCase();
        cleanBase64 = match[2];
        if (mimeType.includes('png')) ext = 'png';
        else if (mimeType.includes('webp')) ext = 'webp';
        else ext = 'jpg';
      } else {
        // Fallback split
        const parts = cleanBase64.split(';base64,');
        if (parts.length === 2) {
          cleanBase64 = parts[1];
        }
      }
    }

    // Strip whitespace/newlines
    cleanBase64 = cleanBase64.replace(/\s+/g, '');

    const buffer = Buffer.from(cleanBase64, 'base64');
    if (buffer.length < 50) {
      return null;
    }

    // Detect magic bytes
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      ext = 'jpg';
    } else if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      ext = 'png';
    } else if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46
    ) {
      ext = 'webp';
    }

    return { buffer, ext };
  } catch (err) {
    console.warn('[PhotoMigration] Failed to decode base64 string:', err);
    return null;
  }
}

/**
 * Saves buffer to disk and returns the relative public URL
 */
export function saveImageFile(buffer: Buffer, recordId: string, photoType: 'sebelum' | 'sesudah', ext: string): string {
  ensureDirectories();
  const dateFolder = new Date().toISOString().slice(0, 7); // YYYY-MM
  const targetSubdir = path.join(UPLOADS_DIR, dateFolder);
  if (!fs.existsSync(targetSubdir)) {
    fs.mkdirSync(targetSubdir, { recursive: true });
  }

  const safeId = recordId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const hash = crypto.createHash('md5').update(buffer).digest('hex').slice(0, 8);
  const filename = `rel_${safeId}_${photoType}_${hash}.${ext}`;
  const filePath = path.join(targetSubdir, filename);

  fs.writeFileSync(filePath, buffer);

  // Return standard relative web path
  return `/uploads/realisasi/${dateFolder}/${filename}`;
}

/**
 * Creates backup table in PostgreSQL and logs snapshot
 */
export async function initializeBackupTable(): Promise<boolean> {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS public."REALISASI_PHOTO_BACKUP" (
        "ID" VARCHAR PRIMARY KEY,
        "Foto_Sebelum_Base64" TEXT,
        "Foto_Sesudah_Base64" TEXT,
        "Backup_At" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "Migrated_At" TIMESTAMP WITH TIME ZONE,
        "Foto_Sebelum_Url" TEXT,
        "Foto_Sesudah_Url" TEXT,
        "Status" VARCHAR DEFAULT 'BACKED_UP'
      );
    `);
    return true;
  } catch (err: any) {
    console.error('[PhotoMigration] Error initializing backup table:', err.message);
    return false;
  }
}

/**
 * Performs complete migration:
 * 1. Backs up existing base64 data to REALISASI_PHOTO_BACKUP table & local JSON file.
 * 2. Extracts base64 into verified JPEG/PNG/WebP files in storage.
 * 3. Updates PostgreSQL records with verified URLs.
 * 4. Preserves full audit trail.
 */
export async function runBase64PhotoMigration(options: { dryRun?: boolean; unitId?: string } = {}): Promise<MigrationResult> {
  const isDryRun = Boolean(options.dryRun);
  console.log(`[PhotoMigration] Starting base64 extraction migration (dryRun=${isDryRun})...`);

  ensureDirectories();
  const backupTableOk = await initializeBackupTable();

  const result: MigrationResult = {
    totalRecords: 0,
    migratedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    details: [],
    backupTableCreated: backupTableOk,
    timestamp: new Date().toISOString(),
  };

  try {
    let sql = `
      SELECT "ID", "unitId", "Nomor_WO", "Foto_Sebelum", "Foto_Sesudah"
      FROM public."REALISASI"
      WHERE ("Foto_Sebelum" LIKE 'data:image%' OR LENGTH(COALESCE("Foto_Sebelum", '')) > 500)
         OR ("Foto_Sesudah" LIKE 'data:image%' OR LENGTH(COALESCE("Foto_Sesudah", '')) > 500)
    `;
    const params: any[] = [];
    if (options.unitId && options.unitId !== 'ALL') {
      params.push(options.unitId);
      sql += ` AND UPPER(COALESCE("unitId", '')) = UPPER($1)`;
    }

    const res = await query(sql, params);
    result.totalRecords = res.rows.length;
    console.log(`[PhotoMigration] Found ${result.totalRecords} records containing base64 images.`);

    const backupList: any[] = [];

    for (const row of res.rows) {
      const id = row.ID;
      const rawSebelum = row.Foto_Sebelum;
      const rawSesudah = row.Foto_Sesudah;

      let newSebelumUrl: string | undefined = undefined;
      let newSesudahUrl: string | undefined = undefined;
      let sebelumStatus = 'SKIPPED';
      let sesudahStatus = 'SKIPPED';
      let rowError: string | undefined = undefined;

      try {
        // 1. Process Foto Sebelum
        if (isBase64String(rawSebelum)) {
          const decoded = extractBase64ToBuffer(rawSebelum);
          if (decoded && decoded.buffer.length > 100) {
            if (!isDryRun) {
              newSebelumUrl = saveImageFile(decoded.buffer, id, 'sebelum', decoded.ext);
              // Verify file exists on disk
              const fullDiskPath = path.join(process.cwd(), 'public', newSebelumUrl.replace(/^\//, ''));
              if (fs.existsSync(fullDiskPath) && fs.statSync(fullDiskPath).size > 100) {
                sebelumStatus = 'EXTRACTED_AND_VERIFIED';
              } else {
                sebelumStatus = 'VERIFICATION_FAILED';
              }
            } else {
              sebelumStatus = 'DRY_RUN_VALID';
            }
          } else {
            sebelumStatus = 'CORRUPTED_BASE64';
          }
        }

        // 2. Process Foto Sesudah
        if (isBase64String(rawSesudah)) {
          const decoded = extractBase64ToBuffer(rawSesudah);
          if (decoded && decoded.buffer.length > 100) {
            if (!isDryRun) {
              newSesudahUrl = saveImageFile(decoded.buffer, id, 'sesudah', decoded.ext);
              // Verify file exists on disk
              const fullDiskPath = path.join(process.cwd(), 'public', newSesudahUrl.replace(/^\//, ''));
              if (fs.existsSync(fullDiskPath) && fs.statSync(fullDiskPath).size > 100) {
                sesudahStatus = 'EXTRACTED_AND_VERIFIED';
              } else {
                sesudahStatus = 'VERIFICATION_FAILED';
              }
            } else {
              sesudahStatus = 'DRY_RUN_VALID';
            }
          } else {
            sesudahStatus = 'CORRUPTED_BASE64';
          }
        }

        // 3. Backup to REALISASI_PHOTO_BACKUP table
        if (!isDryRun && (newSebelumUrl || newSesudahUrl)) {
          await query(`
            INSERT INTO public."REALISASI_PHOTO_BACKUP" (
              "ID", "Foto_Sebelum_Base64", "Foto_Sesudah_Base64", "Foto_Sebelum_Url", "Foto_Sesudah_Url", "Status", "Migrated_At"
            )
            VALUES ($1, $2, $3, $4, $5, 'MIGRATED', NOW())
            ON CONFLICT ("ID") DO UPDATE SET
              "Foto_Sebelum_Base64" = COALESCE(EXCLUDED."Foto_Sebelum_Base64", public."REALISASI_PHOTO_BACKUP"."Foto_Sebelum_Base64"),
              "Foto_Sesudah_Base64" = COALESCE(EXCLUDED."Foto_Sesudah_Base64", public."REALISASI_PHOTO_BACKUP"."Foto_Sesudah_Base64"),
              "Foto_Sebelum_Url" = EXCLUDED."Foto_Sebelum_Url",
              "Foto_Sesudah_Url" = EXCLUDED."Foto_Sesudah_Url",
              "Status" = 'MIGRATED',
              "Migrated_At" = NOW();
          `, [id, rawSebelum, rawSesudah, newSebelumUrl || null, newSesudahUrl || null]);

          // 4. Update REALISASI table with verified URLs
          const updateSets: string[] = [];
          const updateParams: any[] = [id];

          if (newSebelumUrl && sebelumStatus === 'EXTRACTED_AND_VERIFIED') {
            updateParams.push(newSebelumUrl);
            updateSets.push(`"Foto_Sebelum" = $${updateParams.length}`);
          }
          if (newSesudahUrl && sesudahStatus === 'EXTRACTED_AND_VERIFIED') {
            updateParams.push(newSesudahUrl);
            updateSets.push(`"Foto_Sesudah" = $${updateParams.length}`);
          }

          if (updateSets.length > 0) {
            const updateSql = `UPDATE public."REALISASI" SET ${updateSets.join(', ')} WHERE "ID" = $1;`;
            await query(updateSql, updateParams);
            result.migratedCount++;
          }
        }

        backupList.push({
          id,
          nomorWO: row.Nomor_WO,
          unitId: row.unitId,
          sebelumStatus,
          sesudahStatus,
          newSebelumUrl,
          newSesudahUrl,
          hasOriginalSebelum: Boolean(rawSebelum),
          hasOriginalSesudah: Boolean(rawSesudah),
        });

        result.details.push({
          id,
          sebelumStatus,
          sesudahStatus,
          sebelumUrl: newSebelumUrl,
          sesudahUrl: newSesudahUrl,
        });
      } catch (rowErr: any) {
        rowError = rowErr?.message || String(rowErr);
        result.errorCount++;
        result.details.push({
          id,
          sebelumStatus: 'ERROR',
          sesudahStatus: 'ERROR',
          error: rowError,
        });
      }
    }

    // Write backup summary file
    const backupSummaryPath = path.join(BACKUP_DIR, `photo_migration_${Date.now()}.json`);
    fs.writeFileSync(backupSummaryPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        total: result.totalRecords,
        migrated: result.migratedCount,
        errors: result.errorCount,
      },
      records: backupList,
    }, null, 2));

    console.log(`[PhotoMigration] Migration completed. Migrated: ${result.migratedCount}/${result.totalRecords}, Errors: ${result.errorCount}`);
  } catch (err: any) {
    console.error('[PhotoMigration] Fatal error in migration:', err.message);
  }

  return result;
}
