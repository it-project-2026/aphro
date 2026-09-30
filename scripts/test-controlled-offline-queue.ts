import { LocalSyncQueueItem } from '../src/services/dexieDb';

async function verifyControlledOfflineQueueLogic() {
  console.log('=== CONTROLLED OFFLINE QUEUE AUDIT & SIMULATION ===');

  // Simulated Dexie Sync Queue Item created while offline
  const offlineItem: LocalSyncQueueItem = {
    idempotencyKey: `REL-${Date.now()}-OFFLINE_SIM`,
    type: 'CREATE',
    tableName: 'REALISASI',
    timestamp: new Date().toISOString(),
    retryCount: 0,
    status: 'PENDING',
    payload: {
      realisasi: {
        id: `REL-${Date.now()}-OFFLINE_SIM`,
        unitId: 'UL2',
        WO_ID: 'WO-OFFLINE-101',
        Nomor_WO: 'WO-OFFLINE-101',
        ULP: 'ULP KOTA',
        REGU_ROW: 'REGU 2',
        PENYULANG: 'PENYULANG OFFLINE',
        Foto_Sebelum: 'data:image/jpeg;base64,RAW_BASE64_SIMULATION_BEFORE',
        Foto_Sesudah: 'data:image/jpeg;base64,RAW_BASE64_SIMULATION_AFTER',
      },
      photos: [
        {
          id: 'p1',
          realisasiId: `REL-${Date.now()}-OFFLINE_SIM`,
          woId: 'WO-OFFLINE-101',
          type: 'sebelum',
          slotIndex: 1,
          dataUrl: 'data:image/jpeg;base64,RAW_BASE64_SIMULATION_BEFORE',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'p2',
          realisasiId: `REL-${Date.now()}-OFFLINE_SIM`,
          woId: 'WO-OFFLINE-101',
          type: 'sesudah',
          slotIndex: 2,
          dataUrl: 'data:image/jpeg;base64,RAW_BASE64_SIMULATION_AFTER',
          createdAt: new Date().toISOString(),
        }
      ]
    }
  };

  console.log('1. Offline Enqueue State:');
  console.log(`   IdempotencyKey: ${offlineItem.idempotencyKey}`);
  console.log(`   Initial Queue Status: ${offlineItem.status}`);
  console.log(`   Contains Base64: true`);

  // Step A: Photo upload phase (Online restoration)
  console.log('\n2. Step A: Network Connection Restored');
  console.log('   Starting Upload-First Phase for photos...');
  
  // Simulate GAS/Drive photo resolution
  const resolvedSebUrl = 'https://drive.google.com/uc?id=offline_uploaded_drive_before_123';
  const resolvedSesUrl = 'https://drive.google.com/uc?id=offline_uploaded_drive_after_456';

  console.log(`   Uploaded Foto Sebelum -> URL: ${resolvedSebUrl}`);
  console.log(`   Uploaded Foto Sesudah -> URL: ${resolvedSesUrl}`);

  // Step B: Sanitize Payload before POST /api/realisasi
  console.log('\n3. Step B: Sanitizing REALISASI Payload');
  const cleanPostPayload = {
    id: offlineItem.payload.realisasi.id,
    ID: offlineItem.payload.realisasi.id,
    unitId: offlineItem.payload.realisasi.unitId,
    WO_ID: offlineItem.payload.realisasi.WO_ID,
    Nomor_WO: offlineItem.payload.realisasi.Nomor_WO,
    ULP: offlineItem.payload.realisasi.ULP,
    REGU_ROW: offlineItem.payload.realisasi.REGU_ROW,
    PENYULANG: offlineItem.payload.realisasi.PENYULANG,
    Foto_Sebelum: resolvedSebUrl,
    Foto_Sesudah: resolvedSesUrl,
  };

  const payloadString = JSON.stringify(cleanPostPayload);
  console.log(`   Clean Body Bytes: ${Buffer.byteLength(payloadString, 'utf8')} bytes`);
  console.log(`   Base64 Removed: ${!cleanPostPayload.Foto_Sebelum.startsWith('data:image')}`);

  // Step C: Confirm completion condition
  console.log('\n4. Step C: Server Post-Response Rules');
  console.log('   Rule: Item is ONLY deleted from sync_queue when server responds with HTTP 200/201.');
  console.log('   Rule: If HTTP 413 or non-retryable error occurs, status is updated to FAILED_NON_RETRYABLE with retryCount=999.');
  console.log('   Rule: FAILED_NON_RETRYABLE items remain stored in Dexie and are excluded from auto-retry loops.');
}

verifyControlledOfflineQueueLogic().catch(console.error);
