package main

import (
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"syscall"
	"time"

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

		if os.Getenv("UPLOADS_DIR") == "" {
			_ = os.Setenv("UPLOADS_DIR", filepath.Join(dataDir, "uploads"))
		}
	}

	// 3. Single-instance mutex enforcement in desktop mode
	var mutexLock desktop.SingleInstanceLock
	if isDesktop {
		var alreadyRunning bool
		mutexLock, alreadyRunning, err = desktop.AcquireMutex("")
		if err != nil {
			log.Fatalf("acquiring single-instance mutex: %v", err)
		} else if alreadyRunning {
			if dataDir != "" {
				if info, rErr := desktop.ReadRuntimeInfo(dataDir); rErr == nil && info.URL != "" && desktop.IsValidLoopbackURL(info.URL) {
					log.Printf("another instance is already running at %s; focusing browser and exiting", info.URL)
					_ = desktop.OpenBrowser(info.URL)
					os.Exit(0)
				}
			}
			log.Printf("another instance is already running; exiting")
			os.Exit(0)
		}
		if mutexLock != nil {
			defer mutexLock.Release()
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

	srv := &httpapi.Server{DB: handle, Root: root}

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

	// Graceful shutdown handling
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sigChan
		log.Printf("shutting down...")
		if dataDir != "" {
			_ = desktop.RemoveRuntimeInfo(dataDir)
		}
		if mutexLock != nil {
			_ = mutexLock.Release()
		}
		os.Exit(0)
	}()

	// 6. Launch browser if requested or in desktop mode
	shouldOpenBrowser := (*openBrowserFlag || isDesktop) && !*noBrowserFlag
	if shouldOpenBrowser {
		go func() {
			time.Sleep(150 * time.Millisecond)
			_ = desktop.OpenBrowser(serverURL)
		}()
	}

	// 7. Serve HTTP requests
	log.Fatal(http.Serve(ln, srv.Handler()))
}
