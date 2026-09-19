//go:build !windows

package desktop

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"syscall"
)

type fileMutexLock struct {
	file *os.File
}

func (m *fileMutexLock) Release() error {
	if m == nil || m.file == nil {
		return nil
	}
	_ = syscall.Flock(int(m.file.Fd()), syscall.LOCK_UN)
	err := m.file.Close()
	m.file = nil
	return err
}

// AcquireMutex uses a file-based advisory flock on non-Windows systems.
func AcquireMutex(name string) (SingleInstanceLock, bool, error) {
	if name == "" {
		name = DefaultMutexName
	}
	hash := sha256.Sum256([]byte(name))
	lockFilename := fmt.Sprintf("wpw-lock-%s.lock", hex.EncodeToString(hash[:8]))
	lockPath := filepath.Join(os.TempDir(), lockFilename)

	f, err := os.OpenFile(lockPath, os.O_CREATE|os.O_RDWR, 0600)
	if err != nil {
		return nil, false, fmt.Errorf("opening lock file %s: %w", lockPath, err)
	}

	err = syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB)
	if err != nil {
		_ = f.Close()
		if errors.Is(err, syscall.EWOULDBLOCK) || errors.Is(err, syscall.EAGAIN) {
			return nil, true, nil
		}
		return nil, false, fmt.Errorf("flock lock file %s: %w", lockPath, err)
	}

	return &fileMutexLock{file: f}, false, nil
}
