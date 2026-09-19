package pptx

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

var DefaultDrawTimeout = 45 * time.Second

// ResolveNodeBinary determines the Node.js executable path with desktop portable isolation.
// Priority:
// 1. Explicit NODE_BIN environment variable
// 2. Bundled portable node in {root}/runtime/node.exe (Windows) or {root}/runtime/node (POSIX)
// 3. Fallback to system "node" on PATH
func ResolveNodeBinary(root string) string {
	if env := strings.TrimSpace(os.Getenv("NODE_BIN")); env != "" {
		return env
	}
	if root != "" {
		candidates := []string{
			filepath.Join(root, "runtime", "node.exe"),
			filepath.Join(root, "runtime", "node"),
			filepath.Join(root, "runtime", "bin", "node"),
		}
		for _, c := range candidates {
			if st, err := os.Stat(c); err == nil && !st.IsDir() {
				return c
			}
		}
	}
	return "node"
}

func Draw(root string, payload []byte) ([]byte, error) {
	return DrawWithTimeout(root, payload, DefaultDrawTimeout)
}

func DrawWithTimeout(root string, payload []byte, timeout time.Duration) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	return DrawWithContext(ctx, root, payload)
}

func DrawWithContext(ctx context.Context, root string, payload []byte) ([]byte, error) {
	absRoot, err := filepath.Abs(root)
	if err != nil {
		absRoot = root
	}
	node := ResolveNodeBinary(absRoot)

	// Relative paths: Node's --import treats a Windows "D:\..." path as a URL scheme.
	cmd := exec.CommandContext(
		ctx,
		node,
		"--import", "./workers/pptx/register.mjs",
		"--experimental-strip-types",
		"./workers/pptx/draw.mjs",
	)
	cmd.Dir = absRoot
	cmd.Stdin = bytes.NewReader(payload)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return nil, fmt.Errorf("pptx worker timed out (node: %s): %w", node, ctx.Err())
		}
		if ctx.Err() != nil {
			return nil, fmt.Errorf("pptx worker cancelled: %w", ctx.Err())
		}
		return nil, fmt.Errorf("pptx worker (node: %s): %w: %s", node, err, stderr.String())
	}
	return stdout.Bytes(), nil
}

