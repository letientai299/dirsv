// Package main is the entry point for the dirsv server.
package main

import (
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os/exec"
	"runtime"
	"strings"

	flag "github.com/spf13/pflag"
	dirsv "github.com/tai/dirsv"
	"github.com/tai/dirsv/internal/server"
	"github.com/tai/dirsv/internal/watcher"
)

func main() {
	addr := flag.StringP("addr", "a", ":8080", "listen address")
	root := flag.StringP("root", "r", ".", "root directory to serve")
	browser := flag.StringP(
		"browser",
		"b",
		"",
		"browser to open (default: system default)",
	)
	dev := flag.Bool("dev", false, "proxy frontend to Vite dev server")
	noOpen := flag.Bool("no-open", false, "don't auto-open browser")
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

	ln, err := net.Listen("tcp", *addr)
	if err != nil {
		_ = w.Close()
		log.Fatal(err)
	}

	fmt.Printf("serving %s on %s\n", *root, ln.Addr())
	if *dev {
		fmt.Println("dev mode: proxying frontend to http://localhost:5173")
	}

	if !*noOpen {
		openBrowser(browserURL(ln.Addr().String()), *browser)
	}

	// Serve blocks until error; clean up watcher afterward.
	err = http.Serve(ln, handler)
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

// browserURL turns a listen address like ":8080" or "0.0.0.0:8080" into
// an http://localhost:port URL suitable for opening in a browser.
func browserURL(addr string) string {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return "http://" + addr
	}
	if host == "" || host == "0.0.0.0" || host == "::" {
		host = "localhost"
	}
	return "http://" + net.JoinHostPort(host, port)
}

func openBrowser(target, browser string) {
	var cmd *exec.Cmd
	if browser != "" {
		cmd = exec.Command(browser, target)
	} else {
		switch runtime.GOOS {
		case "darwin":
			cmd = exec.Command("open", target)
		case "linux":
			cmd = exec.Command("xdg-open", target)
		case "windows":
			cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", target)
		default:
			return
		}
	}
	// Best-effort — don't fail the server if the browser doesn't open.
	_ = cmd.Start()
}
