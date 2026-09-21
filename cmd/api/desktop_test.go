package main

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/wiradeltaid/worship-deck/internal/desktop"
)

func TestDesktopDataDirResolution(t *testing.T) {
	tempDir := t.TempDir()
	customPath := filepath.Join(tempDir, "custom-data")

	resolved, err := desktop.ResolveDataDir(customPath, false)
	if err != nil {
		t.Fatalf("ResolveDataDir failed: %v", err)
	}
	if resolved != customPath {
		t.Fatalf("got %q, want %q", resolved, customPath)
	}

	if err := desktop.EnsureDataDir(resolved); err != nil {
		t.Fatalf("EnsureDataDir failed: %v", err)
	}

	uploadsDir := filepath.Join(resolved, "uploads")
	st, err := os.Stat(uploadsDir)
	if err != nil || !st.IsDir() {
		t.Fatalf("expected uploads dir %s to exist", uploadsDir)
	}
}

func TestDesktopPortFallback(t *testing.T) {
	ln1, port1, err := desktop.FindAvailablePort("127.0.0.1", 3850, 5)
	if err != nil {
		t.Fatalf("ln1 failed: %v", err)
	}
	defer ln1.Close()

	ln2, port2, err := desktop.FindAvailablePort("127.0.0.1", 3850, 5)
	if err != nil {
		t.Fatalf("ln2 failed: %v", err)
	}
	defer ln2.Close()

	if port2 <= port1 {
		t.Fatalf("expected port2 > port1, got port1=%d, port2=%d", port1, port2)
	}
}

func TestDesktopRuntimeLifecycle(t *testing.T) {
	dataDir := t.TempDir()
	testURL := "http://127.0.0.1:3888/"
	testPort := 3888

	if err := desktop.WriteRuntimeInfo(dataDir, testURL, testPort); err != nil {
		t.Fatalf("WriteRuntimeInfo failed: %v", err)
	}

	info, err := desktop.ReadRuntimeInfo(dataDir)
	if err != nil {
		t.Fatalf("ReadRuntimeInfo failed: %v", err)
	}
	if info.URL != testURL || info.Port != testPort || info.PID != os.Getpid() {
		t.Fatalf("unexpected runtime info: %+v", info)
	}

	if err := desktop.RemoveRuntimeInfo(dataDir); err != nil {
		t.Fatalf("RemoveRuntimeInfo failed: %v", err)
	}

	if _, err := desktop.ReadRuntimeInfo(dataDir); !os.IsNotExist(err) {
		t.Fatalf("expected os.ErrNotExist, got %v", err)
	}
}
