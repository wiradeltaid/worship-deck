package desktop

import (
	"fmt"
	"net"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestResolveDataDir_ExplicitFlag(t *testing.T) {
	custom := filepath.Join(t.TempDir(), "my-custom-data")
	resolved, err := ResolveDataDir(custom, false)
	if err != nil {
		t.Fatalf("ResolveDataDir: %v", err)
	}
	expected, _ := filepath.Abs(custom)
	if resolved != expected {
		t.Fatalf("got %q, want %q", resolved, expected)
	}
}

func TestResolveDataDir_EnvVar(t *testing.T) {
	custom := filepath.Join(t.TempDir(), "env-data")
	t.Setenv("DATA_DIR", custom)
	resolved, err := ResolveDataDir("", false)
	if err != nil {
		t.Fatalf("ResolveDataDir: %v", err)
	}
	expected, _ := filepath.Abs(custom)
	if resolved != expected {
		t.Fatalf("got %q, want %q", resolved, expected)
	}
}

func TestResolveDataDir_DesktopDefault(t *testing.T) {
	t.Setenv("DATA_DIR", "")
	resolved, err := ResolveDataDir("", true)
	if err != nil {
		t.Fatalf("ResolveDataDir: %v", err)
	}
	if resolved == "" {
		t.Fatal("expected non-empty desktop data directory")
	}
	if runtime.GOOS == "windows" {
		if !filepath.IsAbs(resolved) || filepath.Base(resolved) != "WorshipDeck" {
			t.Fatalf("unexpected windows desktop data dir: %s", resolved)
		}
	}
}

func TestEnsureDataDir(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "ensure-test")
	if err := EnsureDataDir(dir); err != nil {
		t.Fatalf("EnsureDataDir failed: %v", err)
	}
	for _, sub := range []string{"uploads", "logs"} {
		path := filepath.Join(dir, sub)
		st, err := os.Stat(path)
		if err != nil || !st.IsDir() {
			t.Fatalf("expected directory %s to exist", path)
		}
	}
}

func TestFindAvailablePort(t *testing.T) {
	// Bind port on localhost temporarily to simulate occupied port
	listener1, port1, err := FindAvailablePort("127.0.0.1", 3800, 5)
	if err != nil {
		t.Fatalf("first FindAvailablePort failed: %v", err)
	}
	defer listener1.Close()

	if port1 < 3800 || port1 > 3805 {
		t.Fatalf("unexpected port: %d", port1)
	}

	// Now try again starting at port1, it should find next port
	listener2, port2, err := FindAvailablePort("127.0.0.1", port1, 5)
	if err != nil {
		t.Fatalf("second FindAvailablePort failed: %v", err)
	}
	defer listener2.Close()

	if port2 == port1 {
		t.Fatalf("expected different port, got %d for both", port1)
	}
}

func TestRuntimeInfoRoundTrip(t *testing.T) {
	tmpDir := t.TempDir()
	testURL := "http://127.0.0.1:3005"
	testPort := 3005

	if err := WriteRuntimeInfo(tmpDir, testURL, testPort); err != nil {
		t.Fatalf("WriteRuntimeInfo failed: %v", err)
	}

	info, err := ReadRuntimeInfo(tmpDir)
	if err != nil {
		t.Fatalf("ReadRuntimeInfo failed: %v", err)
	}
	if info.URL != testURL || info.Port != testPort || info.PID != os.Getpid() {
		t.Fatalf("unexpected runtime info: %+v", info)
	}

	if err := RemoveRuntimeInfo(tmpDir); err != nil {
		t.Fatalf("RemoveRuntimeInfo failed: %v", err)
	}
	if _, err := ReadRuntimeInfo(tmpDir); !os.IsNotExist(err) {
		t.Fatalf("expected NotExist error after removal, got %v", err)
	}
}

func TestAcquireMutex_SingleAndSecondary(t *testing.T) {
	mutexName := fmt.Sprintf("Local\\TestWorshipDeck_%d", os.Getpid())

	lock1, alreadyRunning, err := AcquireMutex(mutexName)
	if err != nil {
		t.Fatalf("AcquireMutex lock1 failed: %v", err)
	}
	if alreadyRunning {
		t.Fatal("expected first lock not to be already running")
	}
	defer lock1.Release()

	// Second acquisition with same name must detect already running
	lock2, alreadyRunning2, err := AcquireMutex(mutexName)
	if err != nil {
		t.Fatalf("AcquireMutex lock2 failed: %v", err)
	}
	if !alreadyRunning2 {
		t.Fatal("expected second lock to report already running")
	}
	if lock2 != nil {
		_ = lock2.Release()
	}

	// Release first lock
	_ = lock1.Release()

	// Now third acquisition should succeed
	lock3, alreadyRunning3, err := AcquireMutex(mutexName)
	if err != nil {
		t.Fatalf("AcquireMutex lock3 failed: %v", err)
	}
	if alreadyRunning3 {
		t.Fatal("expected lock3 not to be already running after release")
	}
	if lock3 != nil {
		_ = lock3.Release()
	}
}

func TestFindAvailablePort_AllOccupied(t *testing.T) {
	basePort := 3900
	var listeners []net.Listener
	for i := 0; i <= 2; i++ {
		ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", basePort+i))
		if err != nil {
			t.Skipf("cannot bind test port %d: %v", basePort+i, err)
		}
		listeners = append(listeners, ln)
	}
	defer func() {
		for _, ln := range listeners {
			ln.Close()
		}
	}()

	// Ask for maxAttempts = 2 -> will fail because ports 3900, 3901, 3902 are occupied
	_, _, err := FindAvailablePort("127.0.0.1", basePort, 2)
	if err == nil {
		t.Fatal("expected error when all ports are occupied")
	}
}

func TestValidateBindHost(t *testing.T) {
	// Non-desktop mode: allows anything
	for _, h := range []string{"0.0.0.0", "192.168.1.1", "127.0.0.1", ""} {
		if err := ValidateBindHost(h, false); err != nil {
			t.Fatalf("unexpected error in non-desktop mode for host %q: %v", h, err)
		}
	}

	// Desktop mode: allows only loopback
	validLoopbacks := []string{"127.0.0.1", "localhost", "::1", ""}
	for _, h := range validLoopbacks {
		if err := ValidateBindHost(h, true); err != nil {
			t.Fatalf("expected loopback %q to be valid in desktop mode, got %v", h, err)
		}
	}

	// Desktop mode: strictly rejects non-loopback
	invalidHosts := []string{"0.0.0.0", "192.168.1.50", "::", "example.com"}
	for _, h := range invalidHosts {
		if err := ValidateBindHost(h, true); err == nil {
			t.Fatalf("expected host %q to be rejected in desktop mode", h)
		}
	}
}
