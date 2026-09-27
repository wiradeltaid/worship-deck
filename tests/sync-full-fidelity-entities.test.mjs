/**
 * SPEC-91-01: Full-Fidelity Bidirectional Cloud Sync Entity Protocol & Service Attribute Parity Test Suite
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnGoApi, stopProcess, json } from './helpers/go-api.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-fidelity-'));
const dbPath = path.join(tmp, 'test_sync_fidelity.db');
const AUTH_SECRET = createHash('sha256').update('sync-fidelity-secret').digest('hex');
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin-secret-pass-91';

let instance;
let adminToken = '';

before(async () => {
  instance = await spawnGoApi({
    dbPath,
    root,
    env: {
      AUTH_SECRET,
      AUTH_BOOTSTRAP_USER: ADMIN_USER,
      AUTH_BOOTSTRAP_PASSWORD: ADMIN_PASS,
      SYNC_ALLOWED_ORIGINS: 'http://localhost:*,http://127.0.0.1:*',
    },
  });

  const loginRes = await json(`${instance.base}/api/auth/login`, 'POST', {
    username: ADMIN_USER,
    password: ADMIN_PASS,
  });
  assert.equal(loginRes.status, 200);
  assert.ok(loginRes.body.token);
  adminToken = loginRes.body.token;
});

after(() => {
  if (instance?.child) {
    stopProcess(instance.child);
  }
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    // cleanup
  }
});

test('SPEC-91-01: Push and pull full-fidelity presentation entities with service attribute preservation', async () => {
  const serviceGlobalId = 'svc-spec91-001';
  const annSetGlobalId = 'ann-set-spec91-001';
  const annSlideGlobalId = 'ann-slide-spec91-001';
  const templateId = 'tmpl-spec91-001';

  // 1. Push payload containing modern entities and preserved service state
  const pushPayload = {
    client_device_id: 'client-device-spec91',
    mutation_id: 'mutation-spec91-001',
    mutations: {
      services: [
        {
          global_id: serviceGlobalId,
          date: '2026-10-04',
          raw_payload: 'Service raw content for SPEC-91 test',
          parsed_data: { sermon: { title: 'Grace' } },
          images_payload: { background: '/api/uploads/bg1.png' },
          afternoon_program: 'Fellowship',
          hidden_slide_ids: ['slide-h-1', 'slide-h-2'],
          emergency_patches: [{ op: 'replace', path: '/1', value: 'Live emergency text' }],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      announcement_sets: [
        {
          global_id: annSetGlobalId,
          label: 'Youth & Missions Announcement Set',
          updated_at: new Date().toISOString(),
        },
      ],
      announcement_set_slides: [
        {
          global_id: annSlideGlobalId,
          ann_set_global_id: annSetGlobalId,
          label: 'Youth Camp Retreat 2026',
          payload: JSON.stringify({ title: 'Camp', date: 'Dec 2026' }),
          position: 0,
          updated_at: new Date().toISOString(),
          seed_hash: 'seedhash-1234',
        },
      ],
      artifact_templates: [
        {
          id: templateId,
          label: 'Custom Announcement Slot',
          base_type: 'announcement',
          payload: JSON.stringify({ elements: [] }),
          position: 1,
          updated_at: new Date().toISOString(),
          variable_name: 'custom_ann',
          ann_set_global_id: annSetGlobalId,
        },
      ],
      service_registry_snapshots: [
        {
          service_global_id: serviceGlobalId,
          template_id: templateId,
          position: 0,
          label: 'Custom Announcement Slot',
          base_type: 'announcement',
          payload: JSON.stringify({ elements: [{ id: 'e1' }] }),
          updated_at: new Date().toISOString(),
          variable_name: 'custom_ann',
          ann_set_global_id: annSetGlobalId,
        },
      ],
      song_set_layouts: [
        {
          role: 'title',
          payload: JSON.stringify({ font: 'Inter', size: 36 }),
          updated_at: new Date().toISOString(),
          seed_hash: 'layout-seed-title',
        },
      ],
      service_song_set_layouts: [
        {
          service_global_id: serviceGlobalId,
          role: 'verse',
          payload: JSON.stringify({ font: 'Inter', size: 28 }),
          updated_at: new Date().toISOString(),
        },
      ],
    },
  };

  const pushRes = await json(
    `${instance.base}/api/sync/push`,
    'POST',
    pushPayload,
    {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    }
  );

  assert.equal(pushRes.status, 200, `Push failed: ${JSON.stringify(pushRes.body)}`);
  assert.equal(pushRes.body.ok, true);
  assert.ok(pushRes.body.applied_count >= 7, 'Must apply all 7 entity types');

  // 2. Pull from server and assert full-fidelity roundtrip
  const pullRes = await json(
    `${instance.base}/api/sync/pull`,
    'GET',
    undefined,
    {
      Authorization: `Bearer ${adminToken}`,
    }
  );

  assert.equal(pullRes.status, 200, `Pull failed: ${JSON.stringify(pullRes.body)}`);
  const changes = pullRes.body.changes;
  assert.ok(changes, 'Pull response must contain changes');

  // Assert service attributes
  const pulledSvc = changes.services.find((s) => s.global_id === serviceGlobalId);
  assert.ok(pulledSvc, 'Service must be present in pull response');
  assert.deepEqual(pulledSvc.hidden_slide_ids, ['slide-h-1', 'slide-h-2'], 'hidden_slide_ids must roundtrip exactly');
  assert.deepEqual(
    pulledSvc.emergency_patches,
    [{ op: 'replace', path: '/1', value: 'Live emergency text' }],
    'emergency_patches must roundtrip exactly'
  );

  // Assert announcement sets
  const pulledSet = changes.announcement_sets.find((s) => s.global_id === annSetGlobalId);
  assert.ok(pulledSet, 'Announcement set must be present in pull response');
  assert.equal(pulledSet.label, 'Youth & Missions Announcement Set');

  // Assert announcement set slides
  const pulledSlide = changes.announcement_set_slides.find((s) => s.global_id === annSlideGlobalId);
  assert.ok(pulledSlide, 'Announcement set slide must be present in pull response');
  assert.equal(pulledSlide.ann_set_global_id, annSetGlobalId);
  assert.equal(pulledSlide.label, 'Youth Camp Retreat 2026');

  // Assert artifact templates
  const pulledTmpl = changes.artifact_templates.find((t) => t.id === templateId);
  assert.ok(pulledTmpl, 'Artifact template must be present in pull response');
  assert.equal(pulledTmpl.ann_set_global_id, annSetGlobalId);

  // Assert service registry snapshots
  const pulledSnap = changes.service_registry_snapshots.find((s) => s.template_id === templateId);
  assert.ok(pulledSnap, 'Service snapshot must be present in pull response');
  assert.equal(pulledSnap.service_global_id, serviceGlobalId);

  // Assert layouts
  const pulledLayout = changes.song_set_layouts.find((l) => l.role === 'title');
  assert.ok(pulledLayout, 'Song set layout must be present in pull response');
  const pulledSvcLayout = changes.service_song_set_layouts.find((l) => l.role === 'verse');
  assert.ok(pulledSvcLayout, 'Service song set layout must be present in pull response');
  assert.equal(pulledSvcLayout.service_global_id, serviceGlobalId);
});

test('SPEC-91-01 guard proof: parent-first ordering returns 409 on unresolved relational references', async () => {
  // Defect: Slide references non-existent announcement set
  const orphanSlidePayload = {
    client_device_id: 'client-device-spec91-guard',
    mutation_id: 'mutation-spec91-orphan-slide',
    mutations: {
      announcement_set_slides: [
        {
          global_id: 'orphan-slide-001',
          ann_set_global_id: 'non-existent-ann-set-9999',
          label: 'Orphan Slide',
          payload: '{}',
          position: 0,
        },
      ],
    },
  };

  const res = await json(
    `${instance.base}/api/sync/push`,
    'POST',
    orphanSlidePayload,
    {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    }
  );

  assert.equal(res.status, 409, 'Must refuse unresolved announcement set reference with HTTP 409');
  assert.equal(res.body.error, 'unresolved_announcement_set_reference');
});

test('SPEC-91-01 guard proof: snapshot returns 409 on unresolved service reference', async () => {
  // Defect: Snapshot references non-existent service
  const orphanSnapshotPayload = {
    client_device_id: 'client-device-spec91-guard',
    mutation_id: 'mutation-spec91-orphan-snapshot',
    mutations: {
      service_registry_snapshots: [
        {
          service_global_id: 'non-existent-svc-8888',
          template_id: 'some-tmpl',
          position: 0,
          label: 'Orphan',
          base_type: 'custom',
        },
      ],
    },
  };

  const res = await json(
    `${instance.base}/api/sync/push`,
    'POST',
    orphanSnapshotPayload,
    {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    }
  );

  assert.equal(res.status, 409, 'Must refuse unresolved service reference with HTTP 409');
  assert.equal(res.body.error, 'unresolved_service_reference');
});

test('SPEC-91-01: Tombstones prevent deletion resurrection and delete snapshots/layouts', async () => {
  const deadGid = 'svc-spec91-to-delete';

  // 1. Create service
  await json(
    `${instance.base}/api/sync/push`,
    'POST',
    {
      client_device_id: 'client-tombstone-test',
      mutation_id: 'mut-tombstone-prep',
      mutations: {
        services: [
          {
            global_id: deadGid,
            date: '2026-10-18',
            raw_payload: 'Service to delete',
          },
        ],
      },
    },
    {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    }
  );

  // 2. Post tombstone deleting the service
  const tbRes = await json(
    `${instance.base}/api/sync/push`,
    'POST',
    {
      client_device_id: 'client-tombstone-test',
      mutation_id: 'mut-tombstone-exec',
      mutations: {},
      tombstones: [
        {
          global_id: deadGid,
          entity_type: 'service',
          deleted_at: new Date().toISOString(),
        },
      ],
    },
    {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    }
  );
  assert.equal(tbRes.status, 200);

  // 3. Attempt to resurrect the service via a stale mutation
  const res = await json(
    `${instance.base}/api/sync/push`,
    'POST',
    {
      client_device_id: 'client-stale-node',
      mutation_id: 'mut-tombstone-resurrect-attempt',
      mutations: {
        services: [
          {
            global_id: deadGid,
            date: '2026-10-18',
            raw_payload: 'Resurrected payload (must be ignored)',
          },
        ],
      },
    },
    {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    }
  );
  assert.equal(res.status, 200);

  // 4. Pull and confirm entity was NOT resurrected
  const pullRes = await json(`${instance.base}/api/sync/pull`, 'GET', undefined, {
    Authorization: `Bearer ${adminToken}`,
  });
  const found = pullRes.body.changes.services.find((s) => s.global_id === deadGid);
  assert.equal(found, undefined, 'Tombstoned service must not be resurrected by stale mutation');
});
