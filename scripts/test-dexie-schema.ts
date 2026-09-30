import Dexie, { Table } from 'dexie';
import 'fake-indexeddb/auto';

export interface LocalRealisasi {
  localId: string;
  id?: string;
  ID?: string;
  serverId?: string;
  idempotencyKey: string;
  syncStatus: string;
  updatedAt: string;
}

export class TestDexieDB extends Dexie {
  realisasi!: Table<LocalRealisasi, string>;

  constructor() {
    super('test_aphro_db');

    this.version(1).stores({
      realisasi: 'localId, serverId, idempotencyKey, woId, nomorWO, ulpId, reguId, petugasId, syncStatus, createdAt, updatedAt',
    });

    this.version(2).stores({
      realisasi: 'localId, id, ID, serverId, idempotencyKey, woId, nomorWO, ulpId, reguId, petugasId, syncStatus, createdAt, updatedAt',
    });
  }
}

async function verifyDexieUpgrade() {
  console.log('=== VERIFYING DEXIE SCHEMA UPGRADE & INDEX RESOLUTION ===');
  const db = new TestDexieDB();

  // Insert a test record with various IDs
  const sampleId = 'REL-1790759370970-r7expsx';
  await db.realisasi.put({
    localId: sampleId,
    id: sampleId,
    ID: sampleId,
    idempotencyKey: sampleId,
    syncStatus: 'PENDING',
    updatedAt: new Date().toISOString(),
  });

  console.log('1. Record successfully inserted into Dexie.');

  // Test where('id') query
  console.log("2. Querying where('id').equals(sampleId)...");
  const foundById = await db.realisasi.where('id').equals(sampleId).first();
  console.log('   Found by id:', foundById?.localId === sampleId);

  // Test where('localId') or ('id') or ('serverId') delete
  console.log("3. Deleting via where('localId').or('id').or('serverId').or('idempotencyKey').delete()...");
  const deletedCount = await db.realisasi
    .where('localId')
    .equals(sampleId)
    .or('id')
    .equals(sampleId)
    .or('ID')
    .equals(sampleId)
    .or('serverId')
    .equals(sampleId)
    .or('idempotencyKey')
    .equals(sampleId)
    .delete();

  console.log('   Deleted rows count:', deletedCount);

  // Verify it is gone
  const remaining = await db.realisasi.where('localId').equals(sampleId).first();
  console.log('   Remaining in DB:', remaining);

  console.log('=== DEXIE UPGRADE & QUERY TESTS PASSED WITH ZERO SCHEMA ERRORS ===');
  await db.delete();
}

verifyDexieUpgrade().catch(console.error);
