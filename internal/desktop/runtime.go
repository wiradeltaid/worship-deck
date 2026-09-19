package desktop

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// RuntimeInfo captures details of an actively running desktop instance.
type RuntimeInfo struct {
	PID       int       `json:"pid"`
	URL       string    `json:"url"`
	Port      int       `json:"port"`
	StartedAt time.Time `json:"started_at"`
}

const runtimeFilename = "runtime.json"

// WriteRuntimeInfo records the active runtime info to runtime.json in dataDir.
func WriteRuntimeInfo(dataDir, rawURL string, port int) error {
	if dataDir == "" {
		return nil
	}
	info := RuntimeInfo{
		PID:       os.Getpid(),
		URL:       rawURL,
		Port:      port,
		StartedAt: time.Now().UTC(),
	}
	data, err := json.MarshalIndent(info, "", "  ")
	if err != nil {
		return fmt.Errorf("serializing runtime info: %w", err)
	}

	target := filepath.Join(dataDir, runtimeFilename)
	if err := os.WriteFile(target, data, 0600); err != nil {
		return fmt.Errorf("writing runtime info to %q: %w", target, err)
	}
	return nil
}

// ReadRuntimeInfo reads the existing runtime info from runtime.json in dataDir.
func ReadRuntimeInfo(dataDir string) (*RuntimeInfo, error) {
	if dataDir == "" {
		return nil, os.ErrNotExist
	}
	target := filepath.Join(dataDir, runtimeFilename)
	data, err := os.ReadFile(target)
	if err != nil {
		return nil, err
	}

	var info RuntimeInfo
	if err := json.Unmarshal(data, &info); err != nil {
		return nil, fmt.Errorf("parsing runtime info: %w", err)
	}
	return &info, nil
}

// RemoveRuntimeInfo removes the runtime.json file on clean shutdown.
func RemoveRuntimeInfo(dataDir string) error {
	if dataDir == "" {
		return nil
	}
	target := filepath.Join(dataDir, runtimeFilename)
	if err := os.Remove(target); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}
