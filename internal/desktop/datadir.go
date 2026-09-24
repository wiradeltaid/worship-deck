package desktop

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
)

// ResolveDataDir determines the mutable application data directory.
// Priority:
// 1. Explicit CLI flag `--data-dir`
// 2. Environment variable `DATA_DIR`
// 3. If in desktop mode:
//    - Windows: %LocalAppData%\WorshipDeck
//    - Linux: $XDG_DATA_HOME/worship-deck (or ~/.local/share/worship-deck)
//    - macOS: ~/Library/Application Support/WorshipDeck
// 4. Default: empty string (falls back to repository root / local dev data path)
func ResolveDataDir(flagVal string, isDesktop bool) (string, error) {
	if flagVal != "" {
		return filepath.Abs(flagVal)
	}
	if env := os.Getenv("DATA_DIR"); env != "" {
		return filepath.Abs(env)
	}
	if !isDesktop {
		return "", nil
	}

	switch runtime.GOOS {
	case "windows":
		localAppData := os.Getenv("LOCALAPPDATA")
		if localAppData == "" {
			home, err := os.UserHomeDir()
			if err != nil {
				return "", fmt.Errorf("resolving user home directory: %w", err)
			}
			localAppData = filepath.Join(home, "AppData", "Local")
		}
		return filepath.Join(localAppData, "WorshipDeck"), nil

	case "darwin":
		home, err := os.UserHomeDir()
		if err != nil {
			return "", fmt.Errorf("resolving user home directory: %w", err)
		}
		return filepath.Join(home, "Library", "Application Support", "WorshipDeck"), nil

	default: // Linux / BSD
		if xdg := os.Getenv("XDG_DATA_HOME"); xdg != "" && filepath.IsAbs(xdg) {
			return filepath.Join(xdg, "worship-deck"), nil
		}
		home, err := os.UserHomeDir()
		if err != nil {
			return "", fmt.Errorf("resolving user home directory: %w", err)
		}
		return filepath.Join(home, ".local", "share", "worship-deck"), nil
	}
}

// EnsureDataDir creates the data directory structure including subdirectories for uploads and logs.
func EnsureDataDir(dataDir string) error {
	if dataDir == "" {
		return nil
	}
	dirs := []string{
		dataDir,
		filepath.Join(dataDir, "uploads"),
		filepath.Join(dataDir, "logs"),
	}
	for _, d := range dirs {
		if err := os.MkdirAll(d, 0700); err != nil {
			return fmt.Errorf("creating data directory %q: %w", d, err)
		}
	}
	return nil
}
