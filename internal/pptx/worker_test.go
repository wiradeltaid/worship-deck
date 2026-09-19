package pptx

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestDrawWithTimeoutExceeded(t *testing.T) {
	wd, err := os.Getwd()
	if err != nil {
		t.Fatalf("failed to get working dir: %v", err)
	}
	// Locate repository root (two levels up from internal/pptx)
	root := filepath.Clean(filepath.Join(wd, "..", ".."))

	// 1 millisecond timeout should guarantee DeadlineExceeded when invoking node
	_, err = DrawWithTimeout(root, []byte(`{}`), 1*time.Millisecond)
	if err == nil {
		t.Fatalf("expected error from DrawWithTimeout, got nil")
	}
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("expected context.DeadlineExceeded in error chain, got: %v", err)
	}
}

func TestDrawWithContextCancellation(t *testing.T) {
	wd, err := os.Getwd()
	if err != nil {
		t.Fatalf("failed to get working dir: %v", err)
	}
	root := filepath.Clean(filepath.Join(wd, "..", ".."))

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel immediately

	_, err = DrawWithContext(ctx, root, []byte(`{}`))
	if err == nil {
		t.Fatalf("expected error from cancelled context, got nil")
	}
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context.Canceled in error chain, got: %v", err)
	}
}

func TestResolveNodeBinary_ExplicitEnv(t *testing.T) {
	customNode := "D:\\custom\\bin\\node.exe"
	t.Setenv("NODE_BIN", customNode)
	got := ResolveNodeBinary("D:\\some\\root")
	if got != customNode {
		t.Fatalf("got %q, want %q", got, customNode)
	}
}

func TestResolveNodeBinary_BundledCandidate(t *testing.T) {
	t.Setenv("NODE_BIN", "")
	tmpRoot := t.TempDir()
	runtimeDir := filepath.Join(tmpRoot, "runtime")
	if err := os.MkdirAll(runtimeDir, 0755); err != nil {
		t.Fatal(err)
	}

	bundledExe := filepath.Join(runtimeDir, "node.exe")
	if err := os.WriteFile(bundledExe, []byte("fake-node-binary"), 0755); err != nil {
		t.Fatal(err)
	}

	got := ResolveNodeBinary(tmpRoot)
	if got != bundledExe {
		t.Fatalf("got %q, want %q", got, bundledExe)
	}
}

func TestResolveNodeBinary_DefaultFallback(t *testing.T) {
	t.Setenv("NODE_BIN", "")
	tmpRoot := t.TempDir()
	got := ResolveNodeBinary(tmpRoot)
	if got != "node" {
		t.Fatalf("got %q, want 'node'", got)
	}
}

func TestResolveNodeBinary_POSIXCandidate(t *testing.T) {
	t.Setenv("NODE_BIN", "")
	tmpRoot := t.TempDir()
	runtimeDir := filepath.Join(tmpRoot, "runtime")
	if err := os.MkdirAll(runtimeDir, 0755); err != nil {
		t.Fatal(err)
	}

	bundledPosix := filepath.Join(runtimeDir, "node")
	if err := os.WriteFile(bundledPosix, []byte("fake-posix-node"), 0755); err != nil {
		t.Fatal(err)
	}

	got := ResolveNodeBinary(tmpRoot)
	if got != bundledPosix {
		t.Fatalf("got %q, want %q", got, bundledPosix)
	}
}

func TestResolveNodeBinary_Precedence(t *testing.T) {
	t.Setenv("NODE_BIN", "")
	tmpRoot := t.TempDir()
	runtimeDir := filepath.Join(tmpRoot, "runtime")
	if err := os.MkdirAll(runtimeDir, 0755); err != nil {
		t.Fatal(err)
	}

	// Create both node.exe and node
	bundledExe := filepath.Join(runtimeDir, "node.exe")
	bundledPosix := filepath.Join(runtimeDir, "node")
	_ = os.WriteFile(bundledExe, []byte("fake-exe"), 0755)
	_ = os.WriteFile(bundledPosix, []byte("fake-posix"), 0755)

	// node.exe must take precedence over node
	got := ResolveNodeBinary(tmpRoot)
	if got != bundledExe {
		t.Fatalf("got %q, want %q (node.exe must have higher precedence)", got, bundledExe)
	}
}
