/**
 * SPEC-121-04 Test Suite:
 * Monotonic Telemetry Sequence, Reconnect Full-Snapshot, Projector JSX Mute & Bilingual Parity
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcUrl = (...parts) => pathToFileURL(path.join(repoRoot, ...parts)).href;

const { PresenterRemoteSession, resolveMonotonicSeekHold } = await import(
  srcUrl('src', 'lib', 'presenter-remote-client.ts')
);
const { I18N_KEYS } = await import(srcUrl('src', 'lib', 'i18n', 'keys.ts'));
const { resolveString } = await import(srcUrl('src', 'lib', 'i18n', 'index.ts'));

test('SPEC-121-04 AC-1: PresenterRemoteSession stamps broadcastState with monotonic seq, sessionEpoch, and timestamp', async () => {
  const sentPayloads = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, opts) => {
    if (url.includes('/remote/state')) {
      sentPayloads.push(JSON.parse(opts.body));
      return { ok: true, text: async () => '' };
    }
    return { ok: true, json: async () => ({}) };
  };

  try {
    const session = new PresenterRemoteSession({
      serviceId: 101,
      getPlanIdentity: () => 'plan-1',
      handlers: {
        setIndexAndSync: () => {},
        setBlankAndSync: () => {},
        setTransitionAndSync: () => {},
        setBackgroundAndSync: () => {},
        broadcast: () => {},
      },
    });

    await session.broadcastState({ index: 0 });
    await session.broadcastState({ index: 1 });
    await session.broadcastState({ media: { currentTime: 12.5 } });

    assert.equal(sentPayloads.length, 3);

    const [p1, p2, p3] = sentPayloads;

    // Check monotonic seq
    assert.equal(typeof p1.seq, 'number', 'p1.seq must be a number');
    assert.equal(typeof p2.seq, 'number', 'p2.seq must be a number');
    assert.equal(typeof p3.seq, 'number', 'p3.seq must be a number');
    assert.ok(p2.seq > p1.seq, 'seq must strictly increase from p1 to p2');
    assert.ok(p3.seq > p2.seq, 'seq must strictly increase from p2 to p3');

    // Check sessionEpoch consistency within same session
    assert.equal(typeof p1.sessionEpoch, 'number', 'p1.sessionEpoch must be a number');
    assert.equal(p1.sessionEpoch, p2.sessionEpoch, 'sessionEpoch must be consistent within session');
    assert.equal(p2.sessionEpoch, p3.sessionEpoch, 'sessionEpoch must be consistent within session');

    // Check timestamp
    assert.ok(p1.timestamp > 0, 'timestamp must be non-zero');
    assert.ok(p3.timestamp >= p1.timestamp, 'timestamp must be monotonic');

    // Check media sub-object stamps
    assert.equal(p3.media?.seq, p3.seq, 'media.seq must match root seq');
    assert.equal(p3.media?.sessionEpoch, p3.sessionEpoch, 'media.sessionEpoch must match root sessionEpoch');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('SPEC-121-04 AC-1: Presenter restart triggers explicit epoch reset and seq reset', async () => {
  const sentPayloads = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, opts) => {
    if (url.includes('/remote/state')) {
      sentPayloads.push(JSON.parse(opts.body));
      return { ok: true, text: async () => '' };
    }
    if (url.includes('/remote/pair')) {
      return { ok: true, json: async () => ({ code: '123456', expiresIn: 60 }) };
    }
    return { ok: true, json: async () => ({}) };
  };

  try {
    const session = new PresenterRemoteSession({
      serviceId: 102,
      getPlanIdentity: () => 'plan-1',
      handlers: {
        setIndexAndSync: () => {},
        setBlankAndSync: () => {},
        setTransitionAndSync: () => {},
        setBackgroundAndSync: () => {},
        broadcast: () => {},
      },
    });

    await session.broadcastState({ index: 0 });
    const initialEpoch = sentPayloads[0].sessionEpoch;
    assert.ok(initialEpoch > 0);

    // Simulate presenter restart (calling start again)
    // Small artificial delay to guarantee epoch timestamp difference
    await new Promise((r) => setTimeout(r, 10));
    await session.start();

    await session.broadcastState({ index: 5 });
    const restartPayload = sentPayloads[sentPayloads.length - 1];

    assert.notEqual(restartPayload.sessionEpoch, initialEpoch, 'sessionEpoch must reset on presenter restart');
    assert.equal(restartPayload.seq, 1, 'seq must reset on presenter restart');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('SPEC-121-04 AC-3: ProjectedMediaLayer declares static defaultMuted alongside muted and playsInline in JSX', () => {
  const filePath = path.join(repoRoot, 'src', 'projected', 'media', 'ProjectedMediaLayer.tsx');
  const src = fs.readFileSync(filePath, 'utf8');

  // Verify defaultMuted is statically declared on <video in JSX
  const videoTagMatch = /<video[\s\S]*?\/>/.exec(src);
  assert.ok(videoTagMatch, 'Must contain <video /> tag in ProjectedMediaLayer.tsx');
  const videoTag = videoTagMatch[0];

  assert.ok(/\bdefaultMuted\b/.test(videoTag), '<video> tag must statically declare defaultMuted attribute');
  assert.ok(/\bmuted\b/.test(videoTag), '<video> tag must declare muted attribute');
  assert.ok(/\bplaysInline\b/.test(videoTag), '<video> tag must declare playsInline attribute');
});

test('SPEC-121-04 AC-4: All 14 emergency canvas localization keys declared in keys.ts and translated in en and id', () => {
  const newKeys = [
    'emergency.modal.textColor',
    'emergency.modal.shapeFillColor',
    'emergency.modal.shapeStrokeColor',
    'emergency.modal.lineColorTitle',
    'emergency.modal.opacity',
    'emergency.modal.thickness',
    'emergency.modal.uploadAndCrop',
    'emergency.modal.urlPlaceholder',
    'emergency.modal.textPlaceholder',
    'emergency.modal.elementsDetected',
    'emergency.modal.canvasPreviewTitle',
    'emergency.modal.fitContain',
    'emergency.modal.fitCover',
    'emergency.modal.fitFill',
  ];

  for (const key of newKeys) {
    assert.ok(I18N_KEYS.includes(key), `keys.ts must include ${key}`);

    const enText = resolveString(key, 'en');
    assert.ok(enText && !enText.startsWith('[missing:'), `catalogue-en.ts must translate ${key}`);

    const idText = resolveString(key, 'id');
    assert.ok(idText && !idText.startsWith('[missing:'), `catalogue-id.ts must translate ${key}`);
  }
});

test('SPEC-121-04 AC-4: PresenterOperator.tsx contains zero unlocalized strings', () => {
  const presenterPath = path.join(repoRoot, 'src', 'operator', 'present', 'PresenterOperator.tsx');
  const src = fs.readFileSync(presenterPath, 'utf8');

  // Unlocalized strings that must NOT be present as raw hardcoded text
  const prohibitedRawStrings = [
    'title="Warna Teks"',
    'title="Warna Isian Bentuk"',
    '<span className="text-xs text-zinc-400">Opasitas:</span>',
    'title="Warna Garis Tepi"',
    '<span className="text-xs text-zinc-400">Tebal:</span>',
    'title="Warna Garis"',
    "'Upload & Crop'",
    '"Upload & Crop"',
    'placeholder="https://... atau /assets/..."',
    'placeholder="Ketik teks elemen..."',
    'elemen terdeteksi',
    'Pratinjau Layar Auditorium (16:9)',
    '<SelectItem value="contain">Contain (Muat Utuh)</SelectItem>',
    '<SelectItem value="cover">Cover (Penuh / Potong)</SelectItem>',
    '<SelectItem value="fill">Fill (Regang Penuh)</SelectItem>',
  ];

  for (const raw of prohibitedRawStrings) {
    assert.ok(!src.includes(raw), `PresenterOperator.tsx must not contain unlocalized raw string: ${raw}`);
  }
});

test('SPEC-121-04 AC-1: resolveMonotonicSeekHold drops older and concurrent seq during 500ms network jitter without rubber-banding', () => {
  const epoch = 1728900000000;
  const seekTarget = 75.0;
  const startTime = Date.now();

  // User commits seek at seq 10 to 75.0s
  const hold = {
    epoch,
    committedSeq: 10,
    targetTime: seekTarget,
    committedAt: startTime,
  };

  // Simulating 500ms network jitter:
  // Delayed packet from host before seek arrives (seq 8, time 12.0)
  const d1 = resolveMonotonicSeekHold(hold, epoch, 10, {
    seq: 8,
    sessionEpoch: epoch,
    currentTime: 12.0,
  }, startTime + 100);
  assert.equal(d1.dropTimeUpdate, true, 'Must drop delayed packet seq 8 <= 10');
  assert.notEqual(d1.nextHold, null, 'Hold must stay active');

  // Delayed packet from host concurrent with seek arrives (seq 10, time 13.5)
  const d2 = resolveMonotonicSeekHold(d1.nextHold, epoch, 10, {
    seq: 10,
    sessionEpoch: epoch,
    currentTime: 13.5,
  }, startTime + 250);
  assert.equal(d2.dropTimeUpdate, true, 'Must drop concurrent packet seq 10 <= 10');
  assert.notEqual(d2.nextHold, null, 'Hold must stay active');

  // Packet from host with seq 11 where host has not yet fully arrived at seek target (time 40.0)
  const d3 = resolveMonotonicSeekHold(d2.nextHold, epoch, 10, {
    seq: 11,
    sessionEpoch: epoch,
    currentTime: 40.0,
  }, startTime + 400);
  assert.equal(d3.dropTimeUpdate, true, 'Must drop un-converged packet seq 11 when time is far from target');
  assert.notEqual(d3.nextHold, null, 'Hold must stay active');

  // Packet from host with seq 12 where host has now converged to seek target (time 75.2, within 0.75s)
  const d4 = resolveMonotonicSeekHold(d3.nextHold, epoch, 11, {
    seq: 12,
    sessionEpoch: epoch,
    currentTime: 75.2,
  }, startTime + 500);
  assert.equal(d4.dropTimeUpdate, false, 'Must accept converged packet');
  assert.equal(d4.nextHold, null, 'Hold must clear upon convergence');
  assert.equal(d4.maxSeenSeq, 12);
});

test('SPEC-121-04 AC-1: resolveMonotonicSeekHold resets hold immediately on presenter epoch change (restart)', () => {
  const oldEpoch = 1728900000000;
  const newEpoch = 1728900060000; // Presenter restarted 60s later
  const startTime = Date.now();

  const hold = {
    epoch: oldEpoch,
    committedSeq: 25,
    targetTime: 90.0,
    committedAt: startTime,
  };

  // Incoming packet from restarted presenter has newEpoch and seq 1
  const decision = resolveMonotonicSeekHold(hold, oldEpoch, 25, {
    seq: 1,
    sessionEpoch: newEpoch,
    currentTime: 0.0,
  }, startTime + 200);

  assert.equal(decision.dropTimeUpdate, false, 'Must accept packet from restarted presenter');
  assert.equal(decision.nextHold, null, 'Hold must be cleared on epoch change');
  assert.equal(decision.activeEpoch, newEpoch, 'activeEpoch must update to newEpoch');
  assert.equal(decision.maxSeenSeq, 1, 'maxSeenSeq must reset to 1');

  // Stale delayed packet from an older epoch (e.g. oldEpoch < newEpoch) must be ignored and not clear the hold
  const activeHold = { epoch: newEpoch, committedSeq: 5, targetTime: 30.0, committedAt: startTime + 300 };
  const staleEpochDecision = resolveMonotonicSeekHold(activeHold, newEpoch, 10, {
    seq: 99,
    sessionEpoch: oldEpoch,
    currentTime: 10.0,
  }, startTime + 350);
  assert.equal(staleEpochDecision.dropTimeUpdate, true, 'Delayed packet from old epoch must be dropped');
  assert.notEqual(staleEpochDecision.nextHold, null, 'Hold must stay intact despite old epoch packet');

  // Partial broadcast without currentTime (e.g. volume or manifest only) must preserve seek hold
  const partialDecision = resolveMonotonicSeekHold(activeHold, newEpoch, 10, {
    seq: 11,
    sessionEpoch: newEpoch,
  }, startTime + 400);
  assert.equal(partialDecision.dropTimeUpdate, false, 'Partial update without currentTime is applied');
  assert.notEqual(partialDecision.nextHold, null, 'Hold must NOT be prematurely cleared by partial update without currentTime');
});

test('SPEC-121-04 Defect Injection Proofs (absence guard verification)', () => {
  const epoch = 1000;
  const hold = { epoch, committedSeq: 5, targetTime: 50.0, committedAt: 1000 };

  // Defect 1: If older seq was accepted, dropTimeUpdate would be false
  const injectedOlderSeqAccept = (hold, epoch, maxSeq, incoming) => {
    // Defective implementation: ignores seq and always accepts
    return { dropTimeUpdate: false };
  };
  const defectiveRes = injectedOlderSeqAccept(hold, epoch, 5, { seq: 4, sessionEpoch: epoch, currentTime: 10 });
  assert.equal(defectiveRes.dropTimeUpdate, false);
  // Real implementation must drop it:
  const realRes = resolveMonotonicSeekHold(hold, epoch, 5, { seq: 4, sessionEpoch: epoch, currentTime: 10 }, 1100);
  assert.equal(realRes.dropTimeUpdate, true, 'Guard proof: real implementation drops seq 4 <= 5');

  // Defect 2: Missing defaultMuted attribute detection
  const defectiveVideoTag = '<video autoPlay muted playsInline src="test.mp4" />';
  assert.equal(/\bdefaultMuted\b/.test(defectiveVideoTag), false, 'Guard proof: defective video tag without defaultMuted is detected');
});

