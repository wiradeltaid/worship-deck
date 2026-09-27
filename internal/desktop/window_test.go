package desktop

import (
	"context"
	"os"
	"testing"
	"time"
)

func TestWindowOptionsDefaults(t *testing.T) {
	opts := WindowOptions{}
	if opts.Title != "" {
		t.Errorf("expected empty initial title, got %q", opts.Title)
	}
	if DefaultWindowTitle != "WorshipDeck" {
		t.Errorf("expected DefaultWindowTitle WorshipDeck, got %q", DefaultWindowTitle)
	}
	if DefaultWindowWidth != 1440 || DefaultWindowHeight != 900 {
		t.Errorf("unexpected default window dimensions: %dx%d", DefaultWindowWidth, DefaultWindowHeight)
	}
	if MinWindowWidth != 1024 || MinWindowHeight != 768 {
		t.Errorf("unexpected min window dimensions: %dx%d", MinWindowWidth, MinWindowHeight)
	}
}

func TestFocusExistingWindow_NonExistentReturnsFalse(t *testing.T) {
	focused := FocusExistingWindow("NonExistentWindow_SPEC89_Test_XYZ_12345")
	if focused {
		t.Errorf("expected FocusExistingWindow to return false for non-existent window title, got true")
	}
}

func TestRunDesktopWindow_CancelledContext(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // pre-cancel context

	// Calling RunDesktopWindow with cancelled context should terminate cleanly without deadlock
	tempDir, err := os.MkdirTemp("", "wd-wv2-cancel-*")
	if err != nil {
		t.Fatalf("mkdirtemp: %v", err)
	}
	t.Cleanup(func() {
		_ = os.RemoveAll(tempDir)
	})
	opts := WindowOptions{
		Title:   "TestCancel",
		Width:   800,
		Height:  600,
		DataDir: tempDir,
	}

	done := make(chan error, 1)
	go func() {
		done <- RunDesktopWindow(ctx, "http://127.0.0.1:3000/", opts, nil)
	}()

	select {
	case err := <-done:
		if err == nil {
			t.Fatalf("expected cancelled context to return error, got nil")
		}
	case <-time.After(3 * time.Second):
		t.Fatalf("RunDesktopWindow timed out on pre-cancelled context")
	}
}

func TestRunDesktopWindow_ContextCancellationCallsOnExit(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	tempDir, err := os.MkdirTemp("", "wd-wv2-exit-*")
	if err != nil {
		t.Fatalf("mkdirtemp: %v", err)
	}
	t.Cleanup(func() {
		go func() {
			time.Sleep(1 * time.Second)
			_ = os.RemoveAll(tempDir)
		}()
	})
	opts := WindowOptions{
		Title:   "TestCancelOnExit",
		Width:   800,
		Height:  600,
		DataDir: tempDir,
	}

	exitCalled := make(chan bool, 1)
	onExit := func() {
		exitCalled <- true
	}

	done := make(chan error, 1)
	go func() {
		done <- RunDesktopWindow(ctx, "http://127.0.0.1:3000/", opts, onExit)
	}()

	// Let it enter execution loop, then cancel context
	time.Sleep(100 * time.Millisecond)
	cancel()

	select {
	case <-exitCalled:
		// onExit cleanly called on cancellation
	case <-time.After(5 * time.Second):
		t.Fatalf("timed out waiting for onExit to be called on context cancellation")
	}

	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatalf("timed out waiting for RunDesktopWindow to return after cancellation")
	}
}
