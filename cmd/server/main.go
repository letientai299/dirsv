// Package main is the entry point for the dirsv server.
package main

import (
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	dirsv "github.com/tai/dirsv"
	"github.com/tai/dirsv/internal/server"
	"github.com/tai/dirsv/internal/watcher"
)

func main() {
	addr := flag.String("addr", ":8080", "listen address")
	root := flag.String("root", ".", "root directory to serve")
	dev := flag.Bool("dev", false, "proxy frontend to Vite dev server")
	flag.Parse()

	w, err := watcher.New(*root)
	if err != nil {
		log.Fatal(err)
	}

	var appFS fs.FS
	if *dev {
		appFS = nil // SPA handled by dev proxy below.
	} else {
		appFS = dirsv.AppDist
	}

	srv, err := server.New(*root, appFS, w)
	if err != nil {
		_ = w.Close()
		log.Fatal(err)
	}

	handler := http.Handler(srv)
	if *dev {
		handler = devProxy(srv)
	}

	fmt.Printf("serving %s on %s\n", *root, *addr)
	if *dev {
		fmt.Println("dev mode: proxying frontend to http://localhost:5173")
	}

	// ListenAndServe blocks until error; clean up watcher afterward.
	err = http.ListenAndServe(*addr, handler)
	_ = w.Close()
	if err != nil {
		log.Fatal(err)
	}
}

// devProxy wraps the server so that non-API requests are proxied to Vite.
func devProxy(srv *server.Server) http.Handler {
	viteURL, _ := url.Parse("http://localhost:5173")
	proxy := httputil.NewSingleHostReverseProxy(viteURL)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if isAPIPath(r.URL.Path) {
			srv.ServeHTTP(w, r)
			return
		}
		proxy.ServeHTTP(w, r)
	})
}

func isAPIPath(p string) bool {
	return p == "/api" || strings.HasPrefix(p, "/api/")
}
