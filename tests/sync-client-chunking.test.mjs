/**
 * Tests for SPEC-61: Sync Client Chunking and 50MB Payload Cap
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const clientUrl = pathToFileURL(path.join(root, 'src', 'lib', 'sync', 'client.ts')).href;

const {
  chunkSyncPushPayload,
  pushSyncChunked,
  MAX_SYNC_PUSH_BYTES,
} = await import(clientUrl);

test('SPEC-61: Single request under cap is not chunked and keeps original mutation_id', () => {
  const payload = {
    client_device_id: 'client-1',
    mutation_id: 'mut-orig-123',
    mutations: {
      services: [
        {
          global_id: 'svc-1',
          date: '2026-10-01',
          raw_payload: 'Service 1',
        },
      ],
      hymns: [
        {
          global_id: 'hymn-1',
          book_code: 'SDAH',
          number: 1,
          title: 'Hymn 1',
          lyrics: 'Lyrics 1',
        },
      ],
    },
  };

  const { chunks, skippedRecords } = chunkSyncPushPayload(payload, 50 * 1024 * 1024);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].mutation_id, 'mut-orig-123');
  assert.equal(skippedRecords.length, 0);
  assert.equal(chunks[0].mutations.services.length, 1);
  assert.equal(chunks[0].mutations.hymns.length, 1);
});

test('SPEC-61: Oversized payload is split into multiple chunks under byte cap', () => {
  // Use a small maxBytes threshold to test exact chunking mechanics
  const maxBytes = 400;

  const payload = {
    client_device_id: 'client-1',
    mutation_id: 'batch-abc',
    mutations: {
      services: [
        { global_id: 'svc-001', date: '2026-10-01', raw_payload: 'Payload 1' },
        { global_id: 'svc-002', date: '2026-10-02', raw_payload: 'Payload 2' },
        { global_id: 'svc-003', date: '2026-10-03', raw_payload: 'Payload 3' },
      ],
      hymns: [
        { global_id: 'hymn-001', book_code: 'SDAH', number: 1, title: 'H1', lyrics: 'L1' },
        { global_id: 'hymn-002', book_code: 'SDAH', number: 2, title: 'H2', lyrics: 'L2' },
      ],
    },
  };

  const encoder = new TextEncoder();
  assert.ok(encoder.encode(JSON.stringify(payload)).length > maxBytes);

  const { chunks, skippedRecords } = chunkSyncPushPayload(payload, maxBytes);
  assert.ok(chunks.length > 1, `expected >1 chunks, got ${chunks.length}`);
  assert.equal(skippedRecords.length, 0);

  // Every chunk serialized size must strictly be <= maxBytes
  for (let i = 0; i < chunks.length; i++) {
    const chunkBytes = encoder.encode(JSON.stringify(chunks[i])).length;
    assert.ok(
      chunkBytes <= maxBytes,
      `chunk ${i} byte size ${chunkBytes} exceeds maxBytes ${maxBytes}`
    );
    // Deterministic mutation_id
    assert.equal(chunks[i].mutation_id, `batch-abc:chunk-${i}`);
  }

  // All records are preserved across chunks
  const allServices = chunks.flatMap((c) => c.mutations.services || []);
  const allHymns = chunks.flatMap((c) => c.mutations.hymns || []);
  assert.equal(allServices.length, 3);
  assert.equal(allHymns.length, 2);
});

test('SPEC-61: Dependency ordering is strictly preserved across chunks', () => {
  const maxBytes = 350;

  const payload = {
    client_device_id: 'client-1',
    mutation_id: 'dep-test',
    mutations: {
      services: [
        { global_id: 'svc-parent', date: '2026-10-01', raw_payload: 'Parent Service' },
      ],
      announcement_items: [
        {
          global_id: 'ann-child',
          image_url: 'https://example.com/flyer.jpg',
          service_global_id: 'svc-parent',
        },
      ],
    },
    tombstones: [
      {
        global_id: 'tombstone-svc',
        entity_type: 'service',
        deleted_at: '2026-10-01T12:00:00Z',
      },
    ],
  };

  const { chunks } = chunkSyncPushPayload(payload, maxBytes);
  assert.ok(chunks.length >= 2, `expected at least 2 chunks, got ${chunks.length}`);

  let serviceChunkIdx = -1;
  let announcementChunkIdx = -1;
  let tombstoneChunkIdx = -1;

  for (let i = 0; i < chunks.length; i++) {
    if (chunks[i].mutations?.services?.some((s) => s.global_id === 'svc-parent')) {
      serviceChunkIdx = i;
    }
    if (chunks[i].mutations?.announcement_items?.some((a) => a.global_id === 'ann-child')) {
      announcementChunkIdx = i;
    }
    if (chunks[i].tombstones?.some((t) => t.global_id === 'tombstone-svc')) {
      tombstoneChunkIdx = i;
    }
  }

  // Invariant 1: Service is in same or earlier chunk than child Announcement Item
  assert.ok(serviceChunkIdx !== -1 && announcementChunkIdx !== -1);
  assert.ok(
    serviceChunkIdx <= announcementChunkIdx,
    `serviceChunkIdx (${serviceChunkIdx}) must be <= announcementChunkIdx (${announcementChunkIdx})`
  );

  // Invariant 2: Tombstones appear after live mutations
  assert.ok(tombstoneChunkIdx !== -1);
  assert.ok(
    tombstoneChunkIdx >= serviceChunkIdx && tombstoneChunkIdx >= announcementChunkIdx,
    `tombstoneChunkIdx (${tombstoneChunkIdx}) must appear after live mutation chunks`
  );
});

test('SPEC-61: Single oversized record is skipped with reason while surrounding records succeed', () => {
  const maxBytes = 300;

  const payload = {
    client_device_id: 'client-1',
    mutation_id: 'oversized-test',
    mutations: {
      services: [
        { global_id: 'svc-normal-1', date: '2026-10-01', raw_payload: 'Normal 1' },
        {
          global_id: 'svc-huge-oversized',
          date: '2026-10-02',
          raw_payload: 'A'.repeat(500), // Alone exceeds 300 bytes!
        },
        { global_id: 'svc-normal-2', date: '2026-10-03', raw_payload: 'Normal 2' },
      ],
    },
  };

  const { chunks, skippedRecords } = chunkSyncPushPayload(payload, maxBytes);

  // Huge record was recorded in skippedRecords
  assert.equal(skippedRecords.length, 1);
  assert.equal(skippedRecords[0].id, 'svc-huge-oversized');
  assert.ok(skippedRecords[0].reason.includes('exceeds'));

  // The two normal records were successfully chunked
  const remainingServices = chunks.flatMap((c) => c.mutations.services || []);
  assert.equal(remainingServices.length, 2);
  assert.ok(remainingServices.some((s) => s.global_id === 'svc-normal-1'));
  assert.ok(remainingServices.some((s) => s.global_id === 'svc-normal-2'));
});

test('SPEC-61: Deterministic chunking across retries', () => {
  const maxBytes = 400;
  const payload = {
    client_device_id: 'client-retry',
    mutation_id: 'mut-deterministic-999',
    mutations: {
      services: [
        { global_id: 'svc-1', date: '2026-10-01', raw_payload: 'P1' },
        { global_id: 'svc-2', date: '2026-10-02', raw_payload: 'P2' },
      ],
      hymns: [
        { global_id: 'h-1', book_code: 'SDAH', number: 10, title: 'H10', lyrics: 'L10' },
      ],
    },
  };

  const run1 = chunkSyncPushPayload(payload, maxBytes);
  const run2 = chunkSyncPushPayload(payload, maxBytes);

  assert.equal(run1.chunks.length, run2.chunks.length);
  for (let i = 0; i < run1.chunks.length; i++) {
    assert.equal(run1.chunks[i].mutation_id, run2.chunks[i].mutation_id);
    assert.deepEqual(run1.chunks[i], run2.chunks[i]);
  }
});
