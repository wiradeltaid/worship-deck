package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/wiradeltaid/worship-presenter-web/internal/db"
	"github.com/wiradeltaid/worship-presenter-web/internal/httpapi"
)

func main() {
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
	handle, err := db.Open(os.Getenv("DB_PATH"))
	if err != nil {
		log.Fatal(err)
	}
	defer handle.Close()
	if err := db.Bootstrap(handle, root); err != nil {
		log.Fatal(err)
	}
	srv := &httpapi.Server{DB: handle, Root: root}
	addr := listenAddr()
	log.Printf("api listening on http://%s", addr)
	log.Fatal(http.ListenAndServe(addr, srv.Handler()))
}
