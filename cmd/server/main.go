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
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	dirsv "github.com/letientai299/dirsv"
	"github.com/letientai299/dirsv/internal/appinfo"
	"github.com/letientai299/dirsv/internal/server"
	"github.com/letientai299/dirsv/internal/watcher"
	flag "github.com/spf13/pflag"
)

func main() {
	showVersion := flag.BoolP("version", "v", false, "print version and exit")
	host := flag.String("host", "localhost", "listen address")
	port := flag.IntP("port", "p", 8080, "listen port")
	browser := flag.StringP(
		"browser",
		"b",
		"",
		"browser to open (default: system default)",
	)
	dev := flag.Bool("dev", false, "proxy frontend to Vite dev server")
	noOpen := flag.Bool("no-open", false, "don't auto-open browser")
	debug := flag.BoolP("debug", "d", false, "enable verbose watcher logs")
	_ = flag.CommandLine.MarkHidden("dev")

	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, "dirsv %s\n\n", appinfo.String())
		fmt.Fprintln(
			os.Stderr,
			"Local directory browser with live reload. Single binary, embedded web UI.",
		)
		fmt.Fprintln(os.Stderr)
		fmt.Fprintln(
			os.Stderr,
			"  Directories    table view with file icons, sizes, and dates",
		)
		fmt.Fprintln(
			os.Stderr,
			"  Markdown       GFM, syntax highlighting, KaTeX math, diagrams",
		)
		fmt.Fprintln(os.Stderr, "  Code           100+ languages with line numbers")
		fmt.Fprintln(
			os.Stderr,
			"  JSON/YAML      collapsible tree with path filtering",
		)
		fmt.Fprintln(os.Stderr, "  Images/Video   gallery navigation, HTML5 player")
		fmt.Fprintln(os.Stderr, "  Live reload    file changes reflected instantly")
		fmt.Fprintln(os.Stderr)
		fmt.Fprintf(os.Stderr, "Usage: dirsv [flags] [path]\n\n")
		flag.PrintDefaults()
	}

	flag.Parse()

	if *showVersion {
		fmt.Println(appinfo.String())
		return
	}

	// Determine target: no args → CWD; first positional arg → dir or file.
	target := "."
	if flag.NArg() > 0 {
		target = flag.Arg(0)
	}

	absTarget, err := filepath.Abs(target)
	if err != nil {
		log.Fatal(err)
	}
	info, err := os.Stat(absTarget)
	if err != nil {
		log.Fatal(err)
	}

	var root string
	var singleFile string
	if info.IsDir() {
		root = absTarget
	} else {
		root = filepath.Dir(absTarget)
		singleFile = info.Name()
	}

	// Resolve listen port: explicit -p > $PORT > default with auto-find.
	listenPort := *port
	portExplicit := flag.CommandLine.Changed("port")
	if !portExplicit {
		if envPort := os.Getenv("PORT"); envPort != "" {
			p, parseErr := strconv.Atoi(envPort)
			if parseErr != nil {
				log.Fatalf("invalid PORT env: %s", envPort)
			}
			listenPort = p
			portExplicit = true
		}
	}

	var watcherOpts []watcher.Option
	if *debug {
		watcherOpts = append(watcherOpts, watcher.Debug)
	}
	watcherOpts = append(watcherOpts,
		watcher.WithOriginPatterns(originPatternsFor(*host)...))
	w, err := watcher.New(root, watcherOpts...)
	if err != nil {
		log.Fatal(err)
	}

	var appFS fs.FS
	if *dev {
		appFS = nil // SPA handled by dev proxy below.
	} else {
		appFS = dirsv.AppDist
	}

	var opts []server.Option
	if singleFile != "" {
		opts = append(opts, server.WithSingleFile(singleFile))
	}
	opts = append(opts, server.WithAllowedHosts(allowedHostsFor(*host)...))

	srv, err := server.New(root, appFS, w, opts...)
	if err != nil {
		_ = w.Close()
		log.Fatal(err)
	}

	handler := http.Handler(srv)
	if *dev {
		handler = devProxy(srv)
	}

	var ln net.Listener
	if portExplicit {
		addr := net.JoinHostPort(*host, strconv.Itoa(listenPort))
		ln, err = net.Listen("tcp", addr)
		if err != nil {
			_ = w.Close()
			log.Fatal(err)
		}
	} else {
		ln, err = listenAutoPort(*host, listenPort)
		if err != nil {
			_ = w.Close()
			log.Fatal(err)
		}
	}

	fmt.Printf("serving %s on http://%s\n", target, ln.Addr())
	if *dev {
		fmt.Println("dev mode: proxying frontend to http://localhost:5173")
	}
	if !isLocalhostHost(*host) {
		fmt.Fprintln(os.Stderr,
			"WARNING: binding to a non-localhost address exposes all files "+
				"in the served directory to the network without authentication.")
	}

	if !*noOpen {
		u := browserURL(ln.Addr().String())
		if singleFile != "" {
			u += "/" + singleFile
		}
		openBrowser(u, *browser)
	}

	// Serve blocks until error; clean up watcher afterward.
	httpSrv := &http.Server{
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}
	err = httpSrv.Serve(ln)
	_ = w.Close()
	if err != nil {
		log.Fatal(err)
	}
}

// listenAutoPort tries ports starting from startPort until a free one is found.
func listenAutoPort(host string, startPort int) (net.Listener, error) {
	for p := startPort; p < startPort+100; p++ {
		addr := net.JoinHostPort(host, strconv.Itoa(p))
		ln, err := net.Listen("tcp", addr)
		if err == nil {
			return ln, nil
		}
	}
	return nil, fmt.Errorf("no free port in range %d–%d", startPort, startPort+99)
}

// devProxy wraps the server so that non-API requests are proxied to Vite.
func devProxy(srv *server.Server) http.Handler {
	viteURL, _ := url.Parse("http://localhost:5173")
	proxy := httputil.NewSingleHostReverseProxy(viteURL)
	// Vite's on-demand dep optimization can take a while for large WASM
	// packages (typst). Increase the proxy timeout so the browser doesn't
	// get a 504 on first load.
	proxy.Transport = &http.Transport{
		ResponseHeaderTimeout: 120 * time.Second,
	}

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

// allowedHostsFor returns the set of Host header values that should be
// accepted for a given listen address. This prevents DNS rebinding attacks
// where an attacker-controlled domain resolves to 127.0.0.1, causing the
// browser to send requests to dirsv with a foreign Host header. Without
// this check, the attacker's page (now same-origin with the rebinding
// domain) can read /api/raw/... responses and exfiltrate the entire served
// directory tree.
//
// See: https://en.wikipedia.org/wiki/DNS_rebinding
func allowedHostsFor(host string) []string {
	switch host {
	case "localhost", "127.0.0.1", "::1", "":
		// Localhost bindings accept all loopback representations so
		// that browsers resolving "localhost" to either IPv4 or IPv6
		// work without friction.
		return []string{"localhost", "127.0.0.1", "::1"}
	case "0.0.0.0", "::":
		// Wildcard binds accept connections from any interface. The
		// host guard can't enumerate all possible Host values (LAN IPs,
		// hostnames, etc.), so disable it. The non-localhost warning
		// already tells users they're exposing files to the network.
		return nil
	default:
		return []string{host}
	}
}

func isLocalhostHost(host string) bool {
	switch host {
	case "localhost", "127.0.0.1", "::1", "":
		return true
	default:
		return false
	}
}

// originPatternsFor returns WebSocket origin patterns for the given listen
// host. Used by coder/websocket's AcceptOptions.OriginPatterns to reject
// cross-origin WebSocket upgrades — without this, any page on any domain
// can open a WebSocket to dirsv and receive file change notifications.
func originPatternsFor(host string) []string {
	switch host {
	case "localhost", "127.0.0.1", "::1", "":
		return []string{"localhost:*", "127.0.0.1:*", "[::1]:*"}
	default:
		return []string{host + ":*"}
	}
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
