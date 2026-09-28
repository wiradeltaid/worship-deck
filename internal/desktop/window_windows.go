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
	kernel32                          = windows.NewLazySystemDLL("kernel32.dll")
	user32                            = windows.NewLazySystemDLL("user32.dll")
	procFindWindowW                   = user32.NewProc("FindWindowW")
	procShowWindow                    = user32.NewProc("ShowWindow")
	procSetForegroundWindow           = user32.NewProc("SetForegroundWindow")
	procFlashWindowEx                 = user32.NewProc("FlashWindowEx")
	procSetProcessDpiAwarenessContext = user32.NewProc("SetProcessDpiAwarenessContext")
	procSendMessageW                  = user32.NewProc("SendMessageW")
	procLoadIconW                     = user32.NewProc("LoadIconW")
	procGetModuleHandleW              = kernel32.NewProc("GetModuleHandleW")
)

const (
	SW_RESTORE       = 9
	FLASHW_ALL       = 0x00000003
	FLASHW_TIMERNOFG = 0x0000000C

	WM_SETICON = 0x0080
	ICON_SMALL = 0
	ICON_BIG   = 1

	// DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 is ((DPI_AWARENESS_CONTEXT)-4) in Windows user32.
	DpiAwarenessContextPerMonitorAwareV2 = ^uintptr(3)
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

// SetProcessDpiAwarenessPerMonitorV2 configures Per-Monitor V2 DPI awareness for the process.
func SetProcessDpiAwarenessPerMonitorV2() error {
	if procSetProcessDpiAwarenessContext.Find() != nil {
		return fmt.Errorf("SetProcessDpiAwarenessContext not supported on this Windows release")
	}
	ret, _, err := procSetProcessDpiAwarenessContext.Call(DpiAwarenessContextPerMonitorAwareV2)
	if ret == 0 && err != nil && err != windows.ERROR_SUCCESS {
		return fmt.Errorf("SetProcessDpiAwarenessContext failed: %w", err)
	}
	return nil
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
		// Set Per-Monitor V2 DPI awareness if supported (Windows 10 1703+)
		if dpiErr := SetProcessDpiAwarenessPerMonitorV2(); dpiErr != nil {
			log.Printf("[desktop] SetProcessDpiAwarenessPerMonitorV2 notice: %v", dpiErr)
		}
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

	// Bind embedded icon resource (ID 1 from rsrc_windows_amd64.syso) to Win32 window HWND
	if hwnd := uintptr(w.Window()); hwnd != 0 {
		hInst, _, _ := procGetModuleHandleW.Call(0)
		hIcon, _, _ := procLoadIconW.Call(hInst, 1)
		if hIcon != 0 {
			procSendMessageW.Call(hwnd, WM_SETICON, uintptr(ICON_SMALL), hIcon)
			procSendMessageW.Call(hwnd, WM_SETICON, uintptr(ICON_BIG), hIcon)
		}
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
