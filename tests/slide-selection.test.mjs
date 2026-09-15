import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRangeSelection,
  selectAllSlides,
  reconcileSlideSelection,
  resolveMultiSelectClick,
  moveSelectedBlock,
  resolveNextActiveSlide,
  runBulkDelete,
} from '../src/lib/registry/slide-selection.ts';

test('computeRangeSelection: inclusive ordered range in both directions and fallback semantics', () => {
  const deck = ['s1', 's2', 's3', 's4', 's5'];

  // Downward range
  assert.deepEqual(computeRangeSelection('s2', 's4', deck), ['s2', 's3', 's4']);

  // Upward range (must preserve deck order)
  assert.deepEqual(computeRangeSelection('s4', 's2', deck), ['s2', 's3', 's4']);

  // Same anchor and target
  assert.deepEqual(computeRangeSelection('s3', 's3', deck), ['s3']);

  // Missing target returns empty
  assert.deepEqual(computeRangeSelection('s1', 'unknown', deck), []);

  // Null anchor falls back to target
  assert.deepEqual(computeRangeSelection(null, 's3', deck), ['s3']);

  // Stale anchor (not in list) falls back to target
  assert.deepEqual(computeRangeSelection('stale-id', 's3', deck), ['s3']);
});

test('selectAllSlides: returns all IDs in deck order', () => {
  const deck = ['a', 'b', 'c'];
  assert.deepEqual(selectAllSlides(deck), ['a', 'b', 'c']);
  assert.deepEqual(selectAllSlides([]), []);
});

test('reconcileSlideSelection: prunes stale IDs and ensures activeId invariant', () => {
  const deck = ['s1', 's2', 's3'];

  // Stale IDs pruned
  const r1 = reconcileSlideSelection(['s1', 'old1', 's3'], 'old1', 's3', deck);
  assert.deepEqual(r1.selectedIds, ['s1', 's3']);
  assert.equal(r1.activeId, 's3');
  assert.equal(r1.anchorId, 's3');

  // Active excluded from selection falls back to first selected in deck order
  const r2 = reconcileSlideSelection(['s2', 's3'], 's2', 's1', deck);
  assert.deepEqual(r2.selectedIds, ['s2', 's3']);
  assert.equal(r2.activeId, 's2');
  assert.equal(r2.anchorId, 's2');

  // Empty selection clears everything
  const r3 = reconcileSlideSelection(['ghost'], 'ghost', 'ghost', deck);
  assert.deepEqual(r3.selectedIds, []);
  assert.equal(r3.activeId, null);
  assert.equal(r3.anchorId, null);
});

test('resolveMultiSelectClick: plain click selects single target and guards active change', () => {
  const deck = ['s1', 's2', 's3'];

  // Switch from s1 to s2 requires discard confirmation
  const res1 = resolveMultiSelectClick({
    clickedId: 's2',
    isCtrlOrCmd: false,
    isShift: false,
    currentSelectedIds: ['s1'],
    currentAnchorId: 's1',
    currentActiveId: 's1',
    orderedIds: deck,
  });
  assert.deepEqual(res1.selectedIds, ['s2']);
  assert.equal(res1.anchorId, 's2');
  assert.equal(res1.activeId, 's2');
  assert.equal(res1.requiresDiscardConfirmation, true);

  // Click on already active slide requires no confirmation
  const res2 = resolveMultiSelectClick({
    clickedId: 's1',
    isCtrlOrCmd: false,
    isShift: false,
    currentSelectedIds: ['s1'],
    currentAnchorId: 's1',
    currentActiveId: 's1',
    orderedIds: deck,
  });
  assert.deepEqual(res2.selectedIds, ['s1']);
  assert.equal(res2.requiresDiscardConfirmation, false);
});

test('resolveMultiSelectClick: Ctrl/Cmd toggle semantics', () => {
  const deck = ['s1', 's2', 's3', 's4'];

  // Add non-active item (preserves active slide & dirty state)
  const addRes = resolveMultiSelectClick({
    clickedId: 's3',
    isCtrlOrCmd: true,
    isShift: false,
    currentSelectedIds: ['s1'],
    currentAnchorId: 's1',
    currentActiveId: 's1',
    orderedIds: deck,
  });
  assert.deepEqual(addRes.selectedIds, ['s1', 's3']);
  assert.equal(addRes.activeId, 's1');
  assert.equal(addRes.requiresDiscardConfirmation, false);

  // Remove non-active item (preserves active slide & dirty state)
  const removeNonActive = resolveMultiSelectClick({
    clickedId: 's3',
    isCtrlOrCmd: true,
    isShift: false,
    currentSelectedIds: ['s1', 's3'],
    currentAnchorId: 's3',
    currentActiveId: 's1',
    orderedIds: deck,
  });
  assert.deepEqual(removeNonActive.selectedIds, ['s1']);
  assert.equal(removeNonActive.activeId, 's1');
  assert.equal(removeNonActive.requiresDiscardConfirmation, false);

  // Remove active item when others remain -> chooses first remaining selected in deck order
  const removeActive = resolveMultiSelectClick({
    clickedId: 's1',
    isCtrlOrCmd: true,
    isShift: false,
    currentSelectedIds: ['s1', 's3'],
    currentAnchorId: 's1',
    currentActiveId: 's1',
    orderedIds: deck,
  });
  assert.deepEqual(removeActive.selectedIds, ['s3']);
  assert.equal(removeActive.activeId, 's3');
  assert.equal(removeActive.requiresDiscardConfirmation, true);

  // Remove final item -> clears selection and active slide
  const removeFinal = resolveMultiSelectClick({
    clickedId: 's1',
    isCtrlOrCmd: true,
    isShift: false,
    currentSelectedIds: ['s1'],
    currentAnchorId: 's1',
    currentActiveId: 's1',
    orderedIds: deck,
  });
  assert.deepEqual(removeFinal.selectedIds, []);
  assert.equal(removeFinal.activeId, null);
  assert.equal(removeFinal.requiresDiscardConfirmation, true);
});

test('resolveMultiSelectClick: Shift and Ctrl+Shift range selection', () => {
  const deck = ['s1', 's2', 's3', 's4', 's5'];

  // Shift range replaces selection, keeps valid anchor
  const shiftRes = resolveMultiSelectClick({
    clickedId: 's4',
    isCtrlOrCmd: false,
    isShift: true,
    currentSelectedIds: ['s2'],
    currentAnchorId: 's2',
    currentActiveId: 's2',
    orderedIds: deck,
  });
  assert.deepEqual(shiftRes.selectedIds, ['s2', 's3', 's4']);
  assert.equal(shiftRes.anchorId, 's2');
  assert.equal(shiftRes.activeId, 's2');
  assert.equal(shiftRes.requiresDiscardConfirmation, false);

  // Shift range that excludes active slide makes target candidate active and requires confirmation
  const shiftExclude = resolveMultiSelectClick({
    clickedId: 's5',
    isCtrlOrCmd: false,
    isShift: true,
    currentSelectedIds: ['s1', 's4'],
    currentAnchorId: 's4',
    currentActiveId: 's1',
    orderedIds: deck,
  });
  assert.deepEqual(shiftExclude.selectedIds, ['s4', 's5']);
  assert.equal(shiftExclude.anchorId, 's4');
  assert.equal(shiftExclude.activeId, 's5');
  assert.equal(shiftExclude.requiresDiscardConfirmation, true);

  // Ctrl+Shift unions range with existing selection
  const ctrlShift = resolveMultiSelectClick({
    clickedId: 's4',
    isCtrlOrCmd: true,
    isShift: true,
    currentSelectedIds: ['s1'],
    currentAnchorId: 's3',
    currentActiveId: 's1',
    orderedIds: deck,
  });
  assert.deepEqual(ctrlShift.selectedIds, ['s1', 's3', 's4']);
  assert.equal(ctrlShift.anchorId, 's3');
  assert.equal(ctrlShift.activeId, 's1');
  assert.equal(ctrlShift.requiresDiscardConfirmation, false);
});

test('moveSelectedBlock: moves contiguous block or unselected items safely', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }];

  // 1. Dragging unselected item moves only it
  const unsel = moveSelectedBlock({
    orderedItems: items,
    selectedIds: ['b', 'c'],
    draggedId: 'e',
    targetIndex: 0,
  });
  assert.deepEqual(
    unsel.map((x) => x.id),
    ['e', 'a', 'b', 'c', 'd']
  );

  // 2. Dragging a selected item moves entire block together
  const blockDown = moveSelectedBlock({
    orderedItems: items,
    selectedIds: ['a', 'c'],
    draggedId: 'a',
    targetIndex: 4, // Drop after 'e'
  });
  // Remaining unselected: b, d, e. Inserting a, c after e:
  assert.deepEqual(
    blockDown.map((x) => x.id),
    ['b', 'd', 'e', 'a', 'c']
  );

  // 3. Drop inside the selected block is a no-op
  const noop = moveSelectedBlock({
    orderedItems: items,
    selectedIds: ['b', 'c', 'd'],
    draggedId: 'c',
    targetIndex: 2, // drop on 'c' itself
  });
  assert.deepEqual(
    noop.map((x) => x.id),
    ['a', 'b', 'c', 'd', 'e']
  );
});

test('resolveNextActiveSlide: selects nearest survivor or null', () => {
  const items = [{ id: 's1' }, { id: 's2' }, { id: 's3' }, { id: 's4' }];

  // Active survived
  assert.equal(resolveNextActiveSlide(['s1', 's3'], 's2', items), 's2');

  // Active s2 deleted: survivor at former index 1 in [s1, s3, s4] is s3
  assert.equal(resolveNextActiveSlide(['s2'], 's2', items), 's3');

  // Last item s4 deleted: clamps to last survivor s3 in [s1, s2, s3]
  assert.equal(resolveNextActiveSlide(['s4'], 's4', items), 's3');

  // First item s1 deleted: survivor at former index 0 in [s2, s3, s4] is s2
  assert.equal(resolveNextActiveSlide(['s1'], 's1', items), 's2');

  // Multiple deleted including active: s2 & s3 deleted; former index 1 in [s1, s4] is s4
  assert.equal(resolveNextActiveSlide(['s2', 's3'], 's2', items), 's4');

  // All deleted -> null
  assert.equal(resolveNextActiveSlide(['s1', 's2', 's3', 's4'], 's2', items), null);
});

test('runBulkDelete: consumes fresh updatedAt tokens and halts on 409/404', async () => {
  // Setup fake store where deleting any item bumps updatedAt of all remaining items
  let store = [
    { id: 's1', updatedAt: 100 },
    { id: 's2', updatedAt: 100 },
    { id: 's3', updatedAt: 100 },
    { id: 's4', updatedAt: 100 },
  ];

  const receivedTokens = [];

  const deleteFn = async (id, token) => {
    receivedTokens.push({ id, token });
    const current = store.find((x) => x.id === id);
    if (!current || current.updatedAt !== token) {
      return { ok: false, status: 409, error: 'Token conflict' };
    }
    // Delete item and bump survivors
    store = store
      .filter((x) => x.id !== id)
      .map((x) => ({ ...x, updatedAt: x.updatedAt + 10 }));
    return { ok: true, templates: store };
  };

  const listFn = async () => [...store];

  // 1. Successful bulk delete of s1 and s3
  const res = await runBulkDelete({
    selectedIds: ['s1', 's3'],
    orderedSummaries: store,
    deleteFn,
    listFn,
  });

  assert.equal(res.completed, true);
  assert.equal(res.deletedCount, 2);
  assert.deepEqual(res.deletedIds, ['s1', 's3']);
  assert.deepEqual(
    res.survivors.map((x) => x.id),
    ['s2', 's4']
  );

  // Verify second call used refreshed token (110) instead of initial token (100)
  assert.deepEqual(receivedTokens, [
    { id: 's1', token: 100 },
    { id: 's3', token: 110 },
  ]);

  // 2. Conflict test: store changes externally during batch
  const store2 = [
    { id: 'a1', updatedAt: 50 },
    { id: 'a2', updatedAt: 50 },
    { id: 'a3', updatedAt: 50 },
  ];
  let callCount = 0;
  const conflictDelete = async (id, token) => {
    callCount++;
    if (id === 'a2') {
      return { ok: false, status: 409, error: 'Simulated conflict' };
    }
    return {
      ok: true,
      templates: store2.filter((x) => x.id !== id),
    };
  };

  const conflictRes = await runBulkDelete({
    selectedIds: ['a1', 'a2', 'a3'],
    orderedSummaries: store2,
    deleteFn: conflictDelete,
    listFn: async () => store2,
  });

  assert.equal(conflictRes.completed, false);
  assert.equal(conflictRes.deletedCount, 1);
  assert.deepEqual(conflictRes.deletedIds, ['a1']);
  assert.equal(conflictRes.failedId, 'a2');
  assert.equal(conflictRes.status, 409);
  // Assert no third call was attempted after conflict
  assert.equal(callCount, 2);

  // 3. 404 Missing row after partial success: m1 deleted, m2 returns 404, halts batch without attempting m3
  const store3 = [
    { id: 'm1', updatedAt: 10 },
    { id: 'm2', updatedAt: 10 },
    { id: 'm3', updatedAt: 10 },
  ];
  let missingCallCount = 0;
  const missingDelete = async (id, token) => {
    missingCallCount++;
    if (id === 'm1') {
      return { ok: true, templates: store3.filter((x) => x.id !== 'm1') };
    }
    return { ok: false, status: 404, error: 'Slide missing' };
  };

  const missingRes = await runBulkDelete({
    selectedIds: ['m1', 'm2', 'm3'],
    orderedSummaries: store3,
    deleteFn: missingDelete,
    listFn: async () => store3.filter((x) => x.id !== 'm1'),
  });

  assert.equal(missingRes.completed, false);
  assert.equal(missingRes.deletedCount, 1);
  assert.deepEqual(missingRes.deletedIds, ['m1']);
  assert.equal(missingRes.failedId, 'm2');
  assert.equal(missingRes.status, 404);
  assert.equal(missingCallCount, 2);

  // 4. Thrown network exception during deleteFn after partial success
  let thrownCallCount = 0;
  const throwingDelete = async (id, token) => {
    thrownCallCount++;
    if (id === 'm1') {
      return { ok: true, templates: [{ id: 'm2', updatedAt: 20 }, { id: 'm3', updatedAt: 20 }] };
    }
    throw new Error('Connection reset by peer');
  };

  const thrownRes = await runBulkDelete({
    selectedIds: ['m1', 'm2', 'm3'],
    orderedSummaries: store3,
    deleteFn: throwingDelete,
    listFn: async () => [{ id: 'm2', updatedAt: 20 }, { id: 'm3', updatedAt: 20 }],
  });

  assert.equal(thrownRes.completed, false);
  assert.equal(thrownRes.deletedCount, 1);
  assert.deepEqual(thrownRes.deletedIds, ['m1']);
  assert.equal(thrownRes.failedId, 'm2');
  assert.equal(thrownRes.status, 500);
  assert.match(thrownRes.error, /Connection reset/);
  assert.equal(thrownCallCount, 2);
  assert.equal(thrownRes.survivors.length, 2);
});

test('resolveNextActiveSlide: preserves active slide and canvas dirty state when only siblings are deleted', () => {
  const items = [{ id: 's1' }, { id: 's2' }, { id: 's3' }];

  // Active s2 is dirty, co-selected siblings s1 and s3 are deleted
  const nextActive = resolveNextActiveSlide(['s1', 's3'], 's2', items);
  assert.equal(nextActive, 's2', 'Active slide s2 must be strictly preserved');

  // Reconcile selection ensures active survivor is selected
  const rec = reconcileSlideSelection(['s2'], 's2', nextActive, ['s2']);
  assert.deepEqual(rec.selectedIds, ['s2']);
  assert.equal(rec.activeId, 's2');
});

