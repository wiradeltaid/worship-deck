package db

import (
	"testing"
)

func TestUUIDv7_FormatAndValidity(t *testing.T) {
	for i := 0; i < 50; i++ {
		id := NewUUIDv7()
		if len(id) != 36 {
			t.Fatalf("expected 36 chars, got %d for %q", len(id), id)
		}
		if !IsValidUUIDv7(id) {
			t.Fatalf("invalid UUIDv7: %q", id)
		}
		if id[14] != '7' {
			t.Fatalf("expected version 7 at index 14, got %c in %s", id[14], id)
		}
	}
}

func TestUUIDv7_MonotonicOrder(t *testing.T) {
	const count = 200
	ids := make([]string, count)
	for i := 0; i < count; i++ {
		ids[i] = NewUUIDv7()
	}

	for i := 1; i < count; i++ {
		if ids[i] <= ids[i-1] {
			t.Fatalf("expected strictly increasing order: ids[%d]=%s <= ids[%d]=%s", i, ids[i], i-1, ids[i-1])
		}
	}
}

func TestUUIDv7_SameMillisecondProgression(t *testing.T) {
	resetUUIDv7State()
	fixedMs := int64(1760000000000)

	const count = 500
	ids := make([]string, count)
	for i := 0; i < count; i++ {
		ids[i] = newUUIDv7At(fixedMs)
	}

	for i := 1; i < count; i++ {
		if ids[i] <= ids[i-1] {
			t.Fatalf("expected strictly increasing in same millisecond: ids[%d]=%s <= ids[%d]=%s", i, ids[i], i-1, ids[i-1])
		}
	}
}

func TestUUIDv7_CounterExhaustionHandling(t *testing.T) {
	resetUUIDv7State()
	fixedMs := int64(1760000000000)

	// 5,000 IDs generated at the exact same physical timestamp
	// Verifies that after 4,096 IDs in the same millisecond, logical timestamp advances monotonically
	const count = 5000
	ids := make([]string, count)
	for i := 0; i < count; i++ {
		ids[i] = newUUIDv7At(fixedMs)
	}

	for i := 1; i < count; i++ {
		if ids[i] <= ids[i-1] {
			t.Fatalf("expected strictly increasing across counter exhaustion: ids[%d]=%s <= ids[%d]=%s", i, ids[i], i-1, ids[i-1])
		}
	}
}

func TestUUIDv7_ClockRollbackHandling(t *testing.T) {
	resetUUIDv7State()

	// 1. Generate at t = 10,000
	id1 := newUUIDv7At(10000)

	// 2. Physical clock steps backward to t = 9,000
	id2 := newUUIDv7At(9000)

	if id2 <= id1 {
		t.Fatalf("clock rollback must maintain monotonic ordering: id2=%s <= id1=%s", id2, id1)
	}
}

func TestUUIDv7_Uniqueness(t *testing.T) {
	const count = 1000
	seen := make(map[string]struct{}, count)
	for i := 0; i < count; i++ {
		id := NewUUIDv7()
		if _, exists := seen[id]; exists {
			t.Fatalf("collision detected on UUIDv7: %s", id)
		}
		seen[id] = struct{}{}
	}
}
