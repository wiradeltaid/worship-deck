package desktop

import (
	"os"
	"os/exec"
	"runtime"
)

// OpenBrowser attempts to open the specified URL in the user's default web browser.
// Can be suppressed via NO_BROWSER=1 or OPEN_BROWSER=0 environment variables.
func OpenBrowser(rawURL string) error {
	if os.Getenv("NO_BROWSER") == "1" || os.Getenv("OPEN_BROWSER") == "0" {
		return nil
	}

	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", rawURL)
	case "darwin":
		cmd = exec.Command("open", rawURL)
	default: // linux, freebsd, etc.
		cmd = exec.Command("xdg-open", rawURL)
	}

	return cmd.Start()
}
