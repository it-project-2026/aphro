import fs from 'fs';
import path from 'path';

/**
 * Update version.json automatically before build
 * Generates unique build ID and timestamp for every production build.
 */
function updateVersionJson() {
  const versionPath = path.resolve(process.cwd(), 'public/version.json');
  try {
    let currentData: any = {};
    if (fs.existsSync(versionPath)) {
      currentData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    }

    const now = new Date();
    const isoDate = now.toISOString();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 5).replace(/:/g, '');
    const buildId = `build-${dateStr}-${timeStr}-${Math.random().toString(36).substring(2, 7)}`;

    const updated = {
      version: currentData.version || '2026.11.12.01',
      minimumVersion: currentData.minimumVersion || '2026.09.30.01',
      build: `${dateStr}${timeStr}`,
      buildId: buildId,
      releaseDate: isoDate,
      updatedAt: isoDate
    };

    fs.writeFileSync(versionPath, JSON.stringify(updated, null, 2) + '\n', 'utf8');
    console.log('[VERSION UPDATE BUILD SCRIPT] Successfully updated public/version.json:', updated);
  } catch (err) {
    console.warn('[VERSION UPDATE BUILD SCRIPT] Could not update version.json automatically:', err);
  }
}

updateVersionJson();
