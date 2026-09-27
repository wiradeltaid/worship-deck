//go:build windows

package desktop

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"unsafe"

	"github.com/jchv/go-webview2"
	"golang.org/x/sys/windows"
)

var (
	user32                  = windows.NewLazySystemDLL("user32.dll")
	procFindWindowW         = user32.NewProc("FindWindowW")
	procShowWindow          = user32.NewProc("ShowWindow")
	procSetForegroundWindow = user32.NewProc("SetForegroundWindow")
	procFlashWindowEx       = user32.NewProc("FlashWindowEx")
)

const (
	SW_RESTORE       = 9
	FLASHW_ALL       = 0x00000003
	FLASHW_TIMERNOFG = 0x0000000C
)

type flashWInfo struct {
	cbSize    uint32
	hwnd      uintptr
	dwFlags   uint32
	uCount    uint32
	dwTimeout uint32
}

// FocusExistingWindow finds an existing top-level window by title and brings it to foreground.
// If foreground lock policy prevents activation, it flashes the taskbar icon and returns false.
func FocusExistingWindow(title string) bool {
	if title == "" {
		title = DefaultWindowTitle
	}
	titleUTF16, err := windows.UTF16PtrFromString(title)
	if err != nil {
		return false
	}
	hwnd, _, _ := procFindWindowW.Call(0, uintptr(unsafe.Pointer(titleUTF16)))
	if hwnd == 0 {
		return false
	}
	procShowWindow.Call(hwnd, uintptr(SW_RESTORE))
	ret, _, _ := procSetForegroundWindow.Call(hwnd)
	if ret == 0 {
		// Flash window icon on taskbar until brought to foreground
		var fwi flashWInfo
		fwi.cbSize = uint32(unsafe.Sizeof(fwi))
		fwi.hwnd = hwnd
		fwi.dwFlags = FLASHW_ALL | FLASHW_TIMERNOFG
		fwi.uCount = 5
		procFlashWindowEx.Call(uintptr(unsafe.Pointer(&fwi)))
		return false
	}
	return true
}

// RunDesktopWindow creates and runs a native Win32 window hosting Microsoft Edge WebView2.
func RunDesktopWindow(ctx context.Context, serverURL string, options WindowOptions, onExit func()) error {
	if ctx != nil && ctx.Err() != nil {
		if onExit != nil {
			onExit()
		}
		return ctx.Err()
	}

	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	if options.Title == "" {
		options.Title = DefaultWindowTitle
	}
	if options.Width <= 0 {
		options.Width = DefaultWindowWidth
	}
	if options.Height <= 0 {
		options.Height = DefaultWindowHeight
	}

	dataPath := ""
	if options.DataDir != "" {
		dataPath = filepath.Join(options.DataDir, "webview2")
		_ = os.MkdirAll(dataPath, 0700)
	}

	var w webview2.WebView
	initErr := func() (err error) {
		defer func() {
			if r := recover(); r != nil {
				err = fmt.Errorf("webview2 runtime panic: %v", r)
			}
		}()
		w = webview2.NewWithOptions(webview2.WebViewOptions{
			Debug:     false,
			DataPath:  dataPath,
			AutoFocus: true,
			WindowOptions: webview2.WindowOptions{
				Title:  options.Title,
				Width:  uint(options.Width),
				Height: uint(options.Height),
				Center: true,
			},
		})
		if w == nil {
			return fmt.Errorf("webview2 runtime initialization failed")
		}
		return nil
	}()

	if initErr != nil {
		log.Printf("[desktop] %v; falling back to default browser", initErr)
		if bErr := OpenBrowser(serverURL); bErr != nil {
			log.Printf("[desktop] browser fallback failed: %v", bErr)
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
		return initErr
	}

	var (
		mu         sync.Mutex
		terminated bool
	)
	stopWatch := make(chan struct{})
	watchDone := make(chan struct{})
	var stopOnce sync.Once
	stopWatcher := func() {
		stopOnce.Do(func() {
			close(stopWatch)
		})
	}

	if ctx != nil {
		go func() {
			defer close(watchDone)
			select {
			case <-ctx.Done():
				mu.Lock()
				if !terminated {
					// Post termination directly to the UI thread's message loop
					w.Dispatch(func() {
						w.Terminate()
					})
				}
				mu.Unlock()
			case <-stopWatch:
			}
		}()
	} else {
		close(watchDone)
	}

	w.SetSize(MinWindowWidth, MinWindowHeight, webview2.HintMin)
	w.Navigate(serverURL)
	w.Run()

	// Signal watcher to stop and wait for it to complete before destroying w
	mu.Lock()
	terminated = true
	mu.Unlock()
	if ctx != nil {
		stopWatcher()
		<-watchDone
	}

	// Clean up WebView and native window on the locked OS thread
	w.Destroy()
	if onExit != nil {
		onExit()
	}
	if ctx != nil && ctx.Err() != nil {
		return ctx.Err()
	}
	return nil
}
