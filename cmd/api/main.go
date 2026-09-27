package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"syscall"
	"time"

	"github.com/wiradeltaid/worship-deck/internal/auth"
	"github.com/wiradeltaid/worship-deck/internal/db"
	"github.com/wiradeltaid/worship-deck/internal/desktop"
	"github.com/wiradeltaid/worship-deck/internal/httpapi"
)

func main() {
	dataDirFlag := flag.String("data-dir", "", "path to mutable application data directory")
	portFlag := flag.Int("port", 0, "HTTP port to bind (default 3000)")
	hostFlag := flag.String("host", "", "HTTP host to bind (default 127.0.0.1)")
	desktopFlag := flag.Bool("desktop", false, "run in standalone desktop mode with single-instance mutex and browser launch")
	openBrowserFlag := flag.Bool("open-browser", false, "force open browser on startup")
	noBrowserFlag := flag.Bool("no-browser", false, "suppress automatic browser launch")
	flag.Parse()

	isDesktop := *desktopFlag || os.Getenv("DESKTOP") == "1"

	// 1. Resolve root directory (assets, catalogs, worker scripts)
	root, err := os.Getwd()
	if err != nil {
		log.Fatal(err)
	}
	if env := os.Getenv("REPO_ROOT"); env != "" {
		root = env
	} else if isDesktop {
		// In desktop mode, if REPO_ROOT is unset, check whether data/ exists adjacent to executable
		if exe, err := os.Executable(); err == nil {
			exeDir := filepath.Dir(exe)
			if stat, err := os.Stat(filepath.Join(exeDir, "data")); err == nil && stat.IsDir() {
				root = exeDir
			}
		}
	}
	root, err = filepath.Abs(root)
	if err != nil {
		log.Fatal(err)
	}

	// 2. Resolve mutable application data directory
	dataDir, err := desktop.ResolveDataDir(*dataDirFlag, isDesktop)
	if err != nil {
		log.Fatalf("resolving data directory: %v", err)
	}
	if dataDir != "" {
		if err := desktop.EnsureDataDir(dataDir); err != nil {
			log.Fatalf("initializing data directory: %v", err)
		}
		log.Printf("using data directory: %s", dataDir)

		if isDesktop {
			logFilePath := filepath.Join(dataDir, "desktop.log")
			logFile, lErr := os.OpenFile(logFilePath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
			if lErr == nil {
				defer logFile.Close()
				log.SetOutput(io.MultiWriter(os.Stderr, logFile))
			}
		}

		if os.Getenv("UPLOADS_DIR") == "" {
			_ = os.Setenv("UPLOADS_DIR", filepath.Join(dataDir, "uploads"))
		}
	}

	// Validate that startup secrets (AUTH_SECRET, JWT_SECRET) are not using insecure placeholders
	if err := auth.ValidateStartupSecrets(); err != nil {
		log.Fatalf("invalid authentication configuration: %v", err)
	}

	// 3. Single-instance mutex enforcement in desktop mode
	var mutexLock desktop.SingleInstanceLock
	if isDesktop {
		var alreadyRunning bool
		mutexLock, alreadyRunning, err = desktop.AcquireMutex("")
		if err != nil {
			log.Fatalf("acquiring single-instance mutex: %v", err)
		} else if alreadyRunning {
			log.Printf("another instance is already running; focusing existing window and exiting")
			if !desktop.FocusExistingWindow(desktop.DefaultWindowTitle) {
				if dataDir != "" {
					if info, rErr := desktop.ReadRuntimeInfo(dataDir); rErr == nil && info.URL != "" && desktop.IsValidLoopbackURL(info.URL) {
						_ = desktop.OpenBrowser(info.URL)
					}
				}
			}
			os.Exit(0)
		}
		if mutexLock != nil {
			defer mutexLock.Release()
		}

		// Under protection of the single-instance mutex, initialize or auto-generate auth-secret.dat
		if dataDir != "" {
			if _, err := auth.InitDesktopAuthSecret(dataDir); err != nil {
				log.Fatalf("initializing desktop auth secret: %v", err)
			}
		}
	}

	// 4. Resolve Database handle
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" && dataDir != "" {
		dbPath = filepath.Join(dataDir, "data.db")
	}
	handle, err := db.Open(dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer handle.Close()

	if err := db.Bootstrap(handle, root); err != nil {
		log.Fatal(err)
	}

	srv := &httpapi.Server{DB: handle, Root: root, IsDesktop: isDesktop}

	// 5. Resolve host and port listener
	preferredPort := 3000
	if *portFlag > 0 {
		preferredPort = *portFlag
	} else if p := os.Getenv("PORT"); p != "" {
		if val, err := strconv.Atoi(p); err == nil && val > 0 {
			preferredPort = val
		}
	}

	bindHost := "127.0.0.1"
	if *hostFlag != "" {
		bindHost = *hostFlag
	} else if h := os.Getenv("LISTEN_HOST"); h != "" {
		bindHost = h
	}

	if err := desktop.ValidateBindHost(bindHost, isDesktop); err != nil {
		log.Fatalf("invalid bind host: %v", err)
	}

	ln, boundPort, err := desktop.FindAvailablePort(bindHost, preferredPort, 10)
	if err != nil {
		log.Fatalf("binding port: %v", err)
	}
	defer ln.Close()

	serverAddr := net.JoinHostPort(bindHost, strconv.Itoa(boundPort))
	serverURL := fmt.Sprintf("http://%s/", serverAddr)
	log.Printf("api listening on %s", serverURL)

	// Record active runtime info
	if dataDir != "" {
		if err := desktop.WriteRuntimeInfo(dataDir, serverURL, boundPort); err != nil {
			log.Printf("warning: recording runtime info: %v", err)
		}
		defer func() {
			_ = desktop.RemoveRuntimeInfo(dataDir)
		}()
	}

	rootCtx, rootCancel := context.WithCancel(context.Background())
	defer rootCancel()

	// Graceful shutdown handling on OS signals
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	go func() {
		select {
		case sig := <-sigChan:
			log.Printf("received signal %v; shutting down...", sig)
			rootCancel()
		case <-rootCtx.Done():
		}
	}()

	httpServer := &http.Server{
		Handler: srv.Handler(),
	}

	serverErrChan := make(chan error, 1)
	go func() {
		if err := httpServer.Serve(ln); err != nil && err != http.ErrServerClosed {
			serverErrChan <- err
			rootCancel()
		}
	}()

	// 6. Native Desktop Window or Browser Launch
	shouldOpenWindow := isDesktop && !*noBrowserFlag
	shouldOpenBrowser := (*openBrowserFlag || isDesktop) && !*noBrowserFlag

	if shouldOpenWindow {
		winOpts := desktop.WindowOptions{
			Title:   desktop.DefaultWindowTitle,
			Width:   desktop.DefaultWindowWidth,
			Height:  desktop.DefaultWindowHeight,
			DataDir: dataDir,
		}
		winErr := desktop.RunDesktopWindow(rootCtx, serverURL, winOpts, rootCancel)
		if winErr != nil {
			log.Printf("[desktop] native window error: %v; running until signal", winErr)
			select {
			case err := <-serverErrChan:
				log.Fatalf("server error: %v", err)
			case <-rootCtx.Done():
			}
		}
	} else {
		if shouldOpenBrowser {
			go func() {
				time.Sleep(150 * time.Millisecond)
				_ = desktop.OpenBrowser(serverURL)
			}()
		}
		select {
		case err := <-serverErrChan:
			log.Fatalf("server error: %v", err)
		case <-rootCtx.Done():
		}
	}

	log.Printf("shutting down HTTP server...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Printf("HTTP server shutdown error: %v", err)
	}

	if dataDir != "" {
		_ = desktop.RemoveRuntimeInfo(dataDir)
	}
	if mutexLock != nil {
		_ = mutexLock.Release()
	}
	log.Printf("worship-deck stopped cleanly")
}
