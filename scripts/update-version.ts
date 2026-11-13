import fs from 'fs';
import path from 'path';

/**
 * Sync Service Worker cache key with public/version.json before build.
 * Only bumps public/version.json when BUMP_VERSION=true is explicitly passed,
 * preventing dev/workspace and dist/ builds from drifting out of sync.
 */
function computeNextVersion(currentVersion?: string): string {
  const now = new Date();
  const wibDate = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const yyyy = wibDate.getUTCFullYear();
  const mm = String(wibDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(wibDate.getUTCDate()).padStart(2, '0');
  const todayPrefix = `${yyyy}.${mm}.${dd}`;

  if (currentVersion && currentVersion.startsWith(`${todayPrefix}.`)) {
    const parts = currentVersion.split('.');
    const seq = parseInt(parts[3] || '0', 10);
    const nextSeq = Number.isFinite(seq) ? seq + 1 : 1;
    return `${todayPrefix}.${String(nextSeq).padStart(2, '0')}`;
  }

  return `${todayPrefix}.01`;
}

function syncVersionAndSw() {
  const versionPath = path.resolve(process.cwd(), 'public/version.json');
  const swPath = path.resolve(process.cwd(), 'public/sw.js');

  try {
    let versionData: any = {};
    if (fs.existsSync(versionPath)) {
      versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    }

    if (process.env.BUMP_VERSION === 'true' || !versionData.version) {
      const now = new Date();
      const isoDate = now.toISOString();
      const dateStr = isoDate.slice(0, 10).replace(/-/g, '');
      const timeStr = isoDate.slice(11, 16).replace(/:/g, '');
      const nextVersion = computeNextVersion(versionData.version);
      const buildId = `build-${dateStr}-${timeStr}-${Math.random().toString(36).substring(2, 7)}`;

      versionData = {
        version: nextVersion,
        minimumVersion: nextVersion,
        build: `${dateStr}${timeStr}`,
        buildId,
        releaseDate: isoDate,
        updatedAt: isoDate,
      };
      fs.writeFileSync(versionPath, JSON.stringify(versionData, null, 2) + '\n', 'utf8');
      console.log('[VERSION BUILD SCRIPT] Bumped public/version.json:', versionData);
    } else {
      console.log('[VERSION BUILD SCRIPT] Using existing public/version.json:', versionData.version, versionData.buildId);
    }

    if (fs.existsSync(swPath) && versionData.version) {
      const swContent = fs.readFileSync(swPath, 'utf8');
      const nextCacheName = `aphro-${versionData.version}-${versionData.buildId || versionData.build || '1'}`;
      const replaced = swContent.replace(
        /const CACHE_NAME = ['"][^'"]+['"];/,
        `const CACHE_NAME = '${nextCacheName}';`
      );
      if (replaced !== swContent) {
        fs.writeFileSync(swPath, replaced, 'utf8');
        console.log('[VERSION BUILD SCRIPT] Synced public/sw.js CACHE_NAME:', nextCacheName);
      }
    }
  } catch (err) {
    console.warn('[VERSION BUILD SCRIPT] Could not sync version.json/sw.js:', err);
  }
}

syncVersionAndSw();
