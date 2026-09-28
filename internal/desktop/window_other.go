//go:build !windows

package desktop

import (
	"context"
	"log"
)

// FocusExistingWindow is a stub on non-Windows platforms.
func FocusExistingWindow(title string) bool {
	return false
}

// SetProcessDpiAwarenessPerMonitorV2 is a no-op on non-Windows platforms.
func SetProcessDpiAwarenessPerMonitorV2() error {
	return nil
}

// IsWindowsSystemDarkMode returns false on non-Windows platforms.
func IsWindowsSystemDarkMode() bool {
	return false
}

// SetWindowImmersiveDarkMode is a no-op on non-Windows platforms.
func SetWindowImmersiveDarkMode(hwnd uintptr, darkMode bool) error {
	return nil
}

// RunDesktopWindow on non-Windows platforms falls back to OpenBrowser and blocks until context cancellation.
func RunDesktopWindow(ctx context.Context, serverURL string, options WindowOptions, onExit func()) error {
	if ctx != nil && ctx.Err() != nil {
		if onExit != nil {
			onExit()
		}
		return ctx.Err()
	}

	log.Printf("[desktop] native WebView2 is Windows-only; opening default browser")
	if err := OpenBrowser(serverURL); err != nil {
		log.Printf("[desktop] browser launch error: %v", err)
	}

	if ctx != nil {
		<-ctx.Done()
	}
	if onExit != nil {
		onExit()
	}
	if ctx != nil && ctx.Err() != nil {
		return ctx.Err()
	}
	return nil
}
