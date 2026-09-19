//go:build windows

package desktop

import (
	"errors"
	"fmt"
	"syscall"

	"golang.org/x/sys/windows"
)

type windowsMutexLock struct {
	handle windows.Handle
}

func (m *windowsMutexLock) Release() error {
	if m == nil || m.handle == 0 {
		return nil
	}
	err := windows.CloseHandle(m.handle)
	m.handle = 0
	return err
}

// AcquireMutex attempts to create or open a Windows Named Mutex.
// Returns:
// - lock: handle to release on exit
// - alreadyRunning: true if another instance already holds the mutex
// - err: any operating system error
func AcquireMutex(name string) (SingleInstanceLock, bool, error) {
	if name == "" {
		name = DefaultMutexName
	}
	nameUTF16, err := windows.UTF16PtrFromString(name)
	if err != nil {
		return nil, false, err
	}

	handle, err := windows.CreateMutex(nil, false, nameUTF16)
	if err != nil {
		if errors.Is(err, windows.ERROR_ALREADY_EXISTS) || errors.Is(err, syscall.Errno(183)) {
			return &windowsMutexLock{handle: handle}, true, nil
		}
		return nil, false, fmt.Errorf("creating named mutex %s: %w", name, err)
	}

	if windows.GetLastError() == windows.ERROR_ALREADY_EXISTS {
		return &windowsMutexLock{handle: handle}, true, nil
	}

	return &windowsMutexLock{handle: handle}, false, nil
}
