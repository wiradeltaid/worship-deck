import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const srcUrl = (...parts) => pathToFileURL(path.join(ROOT, 'src', ...parts)).href;

test('SPEC-111-01: Storage ladder capability detection & hierarchy', async () => {
  const {
    detectStorageCapabilities,
    resolveActiveStorageTier,
    requestStoragePersistence,
    assertNoDownloadAnchorUsed,
  } = await import(
    srcUrl('operator', 'present', 'media-player', 'storage-ladder.ts')
  );

  // 1. Full capability environment (Chromium / WebView2)
  const fullMockWindow = {
    showDirectoryPicker: async () => ({}),
    showOpenFilePicker: async () => [{}],
    navigator: {
      storage: {
        getDirectory: async () => ({}),
        persist: async () => true,
        persisted: async () => true,
      },
    },
  };

  const capsFull = await detectStorageCapabilities(fullMockWindow);
  assert.equal(capsFull.hasDirectoryPicker, true);
  assert.equal(capsFull.hasFilePicker, true);
  assert.equal(capsFull.hasOPFS, true);
  assert.equal(capsFull.hasPersistence, true);
  assert.equal(capsFull.isPersisted, true);
  assert.equal(capsFull.recommendedTier, 'directory-picker');

  const tierFull = await resolveActiveStorageTier({ capabilities: capsFull });
  assert.equal(tierFull, 'directory-picker');

  // 2. OPFS-only environment (directory picker unavailable or restricted)
  const opfsMockWindow = {
    navigator: {
      storage: {
        getDirectory: async () => ({}),
        persist: async () => false,
        persisted: async () => false,
      },
    },
  };

  const capsOpfs = await detectStorageCapabilities(opfsMockWindow);
  assert.equal(capsOpfs.hasDirectoryPicker, false);
  assert.equal(capsOpfs.hasOPFS, true);
  assert.equal(capsOpfs.recommendedTier, 'opfs');

  const tierOpfs = await resolveActiveStorageTier({ capabilities: capsOpfs });
  assert.equal(tierOpfs, 'opfs');

  // 3. Fallback when user requested directory picker but environment lacks it
  const fallbackTier = await resolveActiveStorageTier({
    requestedTier: 'directory-picker',
    capabilities: capsOpfs,
  });
  assert.equal(fallbackTier, 'opfs', 'Graceful fallback to OPFS when directory-picker is missing');

  // 4. Memory-only fallback environment (no directory picker, no OPFS)
  const memoryMockWindow = {
    navigator: {},
  };

  const capsMemory = await detectStorageCapabilities(memoryMockWindow);
  assert.equal(capsMemory.hasDirectoryPicker, false);
  assert.equal(capsMemory.hasOPFS, false);
  assert.equal(capsMemory.recommendedTier, 'memory-fallback');

  const tierMemory = await resolveActiveStorageTier({ capabilities: capsMemory });
  assert.equal(tierMemory, 'memory-fallback');

  // 5. Persistence request
  const persisted = await requestStoragePersistence(fullMockWindow.navigator);
  assert.equal(persisted, true);

  const persistDenied = await requestStoragePersistence(opfsMockWindow.navigator);
  assert.equal(persistDenied, false);

  const persistMissing = await requestStoragePersistence({});
  assert.equal(persistMissing, false);

  // 6. Absence Guard: <a download> is strictly forbidden as a media storage mechanism
  assert.doesNotThrow(() => {
    assertNoDownloadAnchorUsed('<a href="/normal-link">Normal Link</a>');
  });

  assert.throws(
    () => {
      assertNoDownloadAnchorUsed('<a href="/api/media/1.mp4" download="video.mp4">Download Media</a>');
    },
    /INVARIANT_VIOLATION/,
    'Absence guard: <a download> for media files must throw an invariant violation'
  );
});
