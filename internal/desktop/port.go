package desktop

import (
	"fmt"
	"net"
	"strings"
)

const (
	DefaultPort        = 3000
	DefaultMaxAttempts = 10
	DefaultHost        = "127.0.0.1"
)

// ValidateBindHost verifies that desktop mode strictly binds to loopback.
func ValidateBindHost(host string, isDesktop bool) error {
	trimmed := strings.TrimSpace(host)
	if !isDesktop {
		return nil
	}
	if trimmed == "" || trimmed == "127.0.0.1" || trimmed == "localhost" || trimmed == "::1" {
		return nil
	}
	return fmt.Errorf("desktop mode requires loopback binding (127.0.0.1); rejected unsafe host %q", host)
}

// FindAvailablePort scans starting from preferredPort up to preferredPort + maxAttempts
// on the given host (defaulting to 127.0.0.1 loopback) to find an unbound port.
// It returns the open net.Listener and the chosen port number.
func FindAvailablePort(host string, preferredPort int, maxAttempts int) (net.Listener, int, error) {
	if host == "" {
		host = DefaultHost
	}
	if preferredPort <= 0 {
		preferredPort = DefaultPort
	}
	if maxAttempts <= 0 {
		maxAttempts = DefaultMaxAttempts
	}

	for p := preferredPort; p <= preferredPort+maxAttempts; p++ {
		addr := net.JoinHostPort(host, fmt.Sprintf("%d", p))
		ln, err := net.Listen("tcp", addr)
		if err == nil {
			return ln, p, nil
		}
	}

	return nil, 0, fmt.Errorf("no available port found in range %d-%d on host %s", preferredPort, preferredPort+maxAttempts, host)
}
