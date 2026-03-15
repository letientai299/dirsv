// Package server implements an HTTP server for directory browsing.
package server

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"log/slog"
	"mime"
	"net"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/letientai299/dirsv/internal/appinfo"
)

// Entry represents a single directory entry in a listing response.
type Entry struct {
	Name    string    `json:"name"`
	IsDir   bool      `json:"isDir"`
	IsExec  bool      `json:"isExec,omitempty"`
	Size    int64     `json:"size"`
	ModTime time.Time `json:"modTime"`
}

// BrowseResponse is the JSON envelope for /api/browse/.
type BrowseResponse struct {
	Type    string    `json:"type"`
	Entries []Entry   `json:"entries"`
	Path    string    `json:"path,omitempty"`
	Size    int64     `json:"size,omitempty"`
	ModTime time.Time `json:"modTime,omitempty"`
}

// pathCacheEntry caches the resolved filesystem path from EvalSymlinks.
// FileInfo is not cached — Stat is cheap and caching it causes stale
// ModTime in ServeContent (wrong 304 responses with CDN caching).
type pathCacheEntry struct {
	resolved string
	cachedAt time.Time
}

const pathCacheTTL = 2 * time.Second

// EventType identifies the kind of editor sync event.
type EventType string

// Valid EventType values matching the JSON wire format.
const (
	EventScroll    EventType = "scroll"
	EventCursor    EventType = "cursor"
	EventSelection EventType = "selection"
	EventClear     EventType = "clear"
	EventClose     EventType = "close"
)

// EditorEvent represents an editor sync event.
type EditorEvent struct {
	Type       EventType `json:"type"`
	Path       string    `json:"path"`
	Line       int       `json:"line,omitempty"`
	StartLine  int       `json:"startLine,omitempty"`
	EndLine    int       `json:"endLine,omitempty"`
	Total      int       `json:"total,omitempty"`
	TopLine    int       `json:"topLine,omitempty"`
	BottomLine int       `json:"bottomLine,omitempty"`
}

// Server serves directory listings, raw files, and the SPA frontend.
type Server struct {
	root           string
	singleFile     string // if non-empty, restrict serving to this one file
	highlightMs    int    // highlight duration for live-reload change flash
	allowedHosts   map[string]struct{}
	editorCallback func(EditorEvent)
	mux            *http.ServeMux
	pathCache      sync.Map // cleaned request path → *pathCacheEntry
	done           chan struct{}
}

// Option configures a Server.
type Option func(*Server)

// WithSingleFile restricts the server to serving only the named file
// (relative to root). Directory listings show only this file.
func WithSingleFile(name string) Option {
	return func(s *Server) { s.singleFile = name }
}

// WithHighlightMs sets the duration (in milliseconds) of the background
// flash that highlights changed elements after a live reload.
func WithHighlightMs(ms int) Option {
	return func(s *Server) { s.highlightMs = ms }
}

// WithAllowedHosts sets the hosts permitted by the Host header guard.
// Requests whose Host header doesn't match any entry are rejected with 403.
// When empty, all hosts are allowed (backwards-compatible default).
func WithAllowedHosts(hosts ...string) Option {
	return func(s *Server) {
		s.allowedHosts = make(map[string]struct{}, len(hosts))
		for _, h := range hosts {
			s.allowedHosts[strings.ToLower(h)] = struct{}{}
		}
	}
}

// WithEditorCallback sets the function called when a valid editor event
// is received on POST /api/editor or GET /api/editor/ws.
func WithEditorCallback(fn func(EditorEvent)) Option {
	return func(s *Server) { s.editorCallback = fn }
}

// New creates a Server rooted at the given filesystem path.
// If appFS is non-nil, it serves the embedded SPA frontend for non-API paths.
// The WebSocket handler (if any) should be mounted before calling this.
func New(
	root string,
	appFS fs.FS,
	sseHandler http.Handler,
	opts ...Option,
) (*Server, error) {
	abs, err := filepath.Abs(root)
	if err != nil {
		return nil, err
	}
	// Resolve symlinks on the root itself so all containment checks
	// compare against the real path.
	abs, err = filepath.EvalSymlinks(abs)
	if err != nil {
		return nil, err
	}
	info, err := os.Stat(abs)
	if err != nil {
		return nil, err
	}
	if !info.IsDir() {
		return nil, errors.New("root is not a directory")
	}

	s := &Server{root: abs, mux: http.NewServeMux(), done: make(chan struct{})}
	for _, opt := range opts {
		opt(s)
	}
	go s.sweepPathCache()
	s.mux.HandleFunc("GET /api/browse/{path...}", s.handleBrowse)
	s.mux.HandleFunc("GET /api/raw/{path...}", s.handleRaw)
	s.mux.HandleFunc("GET /api/htmlpreview/{path...}", s.handleHTMLPreview)
	s.mux.HandleFunc("GET /api/info", s.handleInfo)

	s.mux.HandleFunc("POST /api/editor", s.handleEditor)
	s.mux.HandleFunc("GET /api/editor/ws", s.handleEditorWS)

	if sseHandler != nil {
		s.mux.Handle("GET /api/events", sseHandler)
	}

	if appFS != nil {
		s.mountSPA(appFS)
	}

	return s, nil
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Host header guard: mitigates DNS rebinding attacks.
	//
	// DNS rebinding allows an attacker to bypass the browser's same-origin
	// policy against localhost services. The attack works as follows:
	//
	//  1. Victim visits attacker.example.com (resolves to attacker's IP).
	//  2. Attacker's page loads JS, then the DNS record for
	//     attacker.example.com is changed to resolve to 127.0.0.1.
	//  3. Subsequent fetch() calls to attacker.example.com:PORT/api/raw/...
	//     now hit dirsv on localhost.
	//  4. The browser considers these requests same-origin with the
	//     attacker's page, so JS can read the response body — exposing
	//     the entire served directory tree.
	//
	// By rejecting requests whose Host header doesn't match the configured
	// listen address, the rebinding fetch in step 3 is blocked: the browser
	// sends Host: attacker.example.com, which isn't in the allowlist.
	//
	// See: https://en.wikipedia.org/wiki/DNS_rebinding
	if len(s.allowedHosts) > 0 {
		host, _, _ := net.SplitHostPort(r.Host)
		if host == "" {
			host = r.Host
		}
		// DNS names are case-insensitive (RFC 4343). Normalize to
		// lowercase so "LOCALHOST" matches the lowercase allowlist.
		host = asciiLower(host)
		if _, ok := s.allowedHosts[host]; !ok {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
	}
	s.mux.ServeHTTP(w, r)
}

func (s *Server) handleInfo(w http.ResponseWriter, r *http.Request) {
	resp := map[string]any{
		"root":        filepath.Base(s.root),
		"version":     appinfo.Info(),
		"highlightMs": s.highlightMs,
	}
	// Only expose the server PID to loopback clients. The PID is used by
	// the frontend to display a "kill server" affordance, but on shared
	// networks it leaks process info that aids local privilege escalation
	// (e.g., /proc/<pid>/ enumeration). The host guard (ServeHTTP) already
	// blocks non-allowlisted Host headers, but this check further restricts
	// PID to requests originating from the loopback interface itself.
	if host, _, _ := net.SplitHostPort(r.RemoteAddr); isLoopback(host) {
		resp["pid"] = os.Getpid()
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

// editorEventTypes is the set of valid editor event types.
var editorEventTypes = map[EventType]struct{}{
	EventScroll:    {},
	EventCursor:    {},
	EventSelection: {},
	EventClear:     {},
	EventClose:     {},
}

// normalizeEditorEvent validates the event type and path, cleans the path,
// and returns false if the event should be rejected.
func normalizeEditorEvent(ev *EditorEvent) bool {
	if _, ok := editorEventTypes[ev.Type]; !ok {
		return false
	}
	if ev.Path == "" {
		return false
	}
	ev.Path = path.Clean("/" + ev.Path)
	ev.Path = strings.TrimPrefix(ev.Path, "/")
	if ev.Path == "." {
		ev.Path = ""
	}
	return true
}

func (s *Server) handleEditor(w http.ResponseWriter, r *http.Request) {
	var ev EditorEvent
	dec := json.NewDecoder(io.LimitReader(r.Body, 4096))
	if err := dec.Decode(&ev); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	if !normalizeEditorEvent(&ev) {
		http.Error(w, "invalid event", http.StatusBadRequest)
		return
	}
	if s.editorCallback != nil {
		s.editorCallback(ev)
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleEditorWS(w http.ResponseWriter, r *http.Request) {
	conn, err := websocket.Accept(w, r, nil)
	if err != nil {
		slog.Debug("ws accept", "err", err)
		return
	}
	defer func() { _ = conn.CloseNow() }()
	conn.SetReadLimit(4096)

	ctx := r.Context()
	for {
		_, data, err := conn.Read(ctx)
		if err != nil {
			return
		}
		var ev EditorEvent
		if err := json.Unmarshal(data, &ev); err != nil {
			continue
		}
		if !normalizeEditorEvent(&ev) {
			continue
		}
		if s.editorCallback != nil {
			s.editorCallback(ev)
		}
	}
}

// asciiLower returns s with ASCII uppercase letters lowered.
// Returns s unchanged (no allocation) when already lowercase.
func asciiLower(s string) string {
	for i := range len(s) {
		if s[i] >= 'A' && s[i] <= 'Z' {
			b := []byte(s)
			for ; i < len(b); i++ {
				if b[i] >= 'A' && b[i] <= 'Z' {
					b[i] += 'a' - 'A'
				}
			}
			return string(b)
		}
	}
	return s
}

func isLoopback(host string) bool {
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

var errForbidden = errors.New("forbidden")

// textMIME overrides Go's mime.TypeByExtension for extensions that are
// misidentified as non-text (e.g., .ts → video/mp2t).
var textMIME = map[string]string{
	".ts":       "text/plain; charset=utf-8",
	".tsx":      "text/plain; charset=utf-8",
	".mts":      "text/plain; charset=utf-8",
	".cts":      "text/plain; charset=utf-8",
	".sql":      "text/plain; charset=utf-8",
	".dbml":     "text/plain; charset=utf-8",
	".cast":     "text/plain; charset=utf-8",
	".dot":      "text/plain; charset=utf-8",
	".puml":     "text/plain; charset=utf-8",
	".plantuml": "text/plain; charset=utf-8",
	".iuml":     "text/plain; charset=utf-8",
	".mmd":      "text/plain; charset=utf-8",
	".mermaid":  "text/plain; charset=utf-8",
}

// resolvePath cleans, resolves symlinks, and validates a request path
// against the root. Returns the real filesystem path and FileInfo, or an error:
//   - fs.ErrNotExist if the path doesn't exist
//   - errForbidden if the path escapes the root
func (s *Server) resolvePath(
	reqPath string,
) (resolved string, info os.FileInfo, err error) {
	cleaned := filepath.FromSlash(path.Clean("/" + reqPath))

	// Check cache for the resolved path (EvalSymlinks result).
	// FileInfo is always fresh — Stat is cheap, caching it causes
	// stale ModTime in ServeContent.
	if v, ok := s.pathCache.Load(cleaned); ok {
		entry, ok := v.(*pathCacheEntry)
		if ok && time.Since(entry.cachedAt) < pathCacheTTL {
			fi, statErr := os.Stat(entry.resolved)
			if statErr != nil {
				s.pathCache.Delete(cleaned)
				return "", nil, statErr
			}
			return entry.resolved, fi, nil
		}
		s.pathCache.Delete(cleaned)
	}

	full := filepath.Join(s.root, cleaned)

	// Resolve symlinks so the containment check uses the real target.
	resolved, err = filepath.EvalSymlinks(full)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return "", nil, fs.ErrNotExist
		}
		return "", nil, errForbidden
	}

	// Boundary-safe containment: root itself is allowed, otherwise require
	// the separator after root to prevent /tmp/foo matching /tmp/foobar.
	if resolved != s.root &&
		!strings.HasPrefix(resolved, s.root+string(filepath.Separator)) {
		return "", nil, errForbidden
	}

	fi, statErr := os.Stat(resolved)
	if statErr != nil {
		return "", nil, statErr
	}

	s.pathCache.Store(cleaned, &pathCacheEntry{
		resolved: resolved,
		cachedAt: time.Now(),
	})

	return resolved, fi, nil
}

// Close stops background goroutines. Safe to call multiple times.
func (s *Server) Close() {
	select {
	case <-s.done:
	default:
		close(s.done)
	}
}

// sweepPathCache periodically evicts expired entries so the cache
// doesn't grow unboundedly from crawlers hitting unique paths.
func (s *Server) sweepPathCache() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-s.done:
			return
		case <-ticker.C:
			now := time.Now()
			s.pathCache.Range(func(key, value any) bool {
				if entry, ok := value.(*pathCacheEntry); ok {
					if now.Sub(entry.cachedAt) >= pathCacheTTL {
						s.pathCache.Delete(key)
					}
				}
				return true
			})
		}
	}
}

func (s *Server) handleBrowse(w http.ResponseWriter, r *http.Request) {
	reqPath := r.PathValue("path")

	// Single-file mode: only the target file and root listing are allowed.
	if s.singleFile != "" {
		if reqPath == "" {
			full := filepath.Join(s.root, s.singleFile)
			info, err := os.Stat(full)
			if err != nil {
				http.Error(w, "internal error", http.StatusInternalServerError)
				return
			}
			entries := []Entry{{
				Name:    s.singleFile,
				IsDir:   false,
				IsExec:  info.Mode()&0o111 != 0,
				Size:    info.Size(),
				ModTime: info.ModTime(),
			}}
			resp := BrowseResponse{Type: "dir", Entries: entries}
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Cache-Control", "no-cache")
			_ = json.NewEncoder(w).Encode(resp)
			return
		}
		if reqPath != s.singleFile {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
	}

	full, info, err := s.resolvePath(reqPath)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			http.Error(w, "not found", http.StatusNotFound)
		} else {
			http.Error(w, "forbidden", http.StatusForbidden)
		}
		return
	}

	if !info.IsDir() {
		resp := BrowseResponse{
			Type:    "file",
			Path:    reqPath,
			Size:    info.Size(),
			ModTime: info.ModTime(),
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache")
		_ = json.NewEncoder(w).Encode(resp)
		return
	}

	// Read directory entries once — used for both the index.html check
	// and the listing response, avoiding double stat.
	dirEntries, err := os.ReadDir(full)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	// Cap entries to avoid unbounded memory on directories with millions
	// of files. The limit is generous enough for any practical directory.
	const maxDirEntries = 10_000
	if len(dirEntries) > maxDirEntries {
		dirEntries = dirEntries[:maxDirEntries]
	}

	// Trailing-slash convention: no trailing slash + dir has index.html → index type.
	hasTrailingSlash := strings.HasSuffix(r.URL.Path, "/")
	if !hasTrailingSlash && reqPath != "" {
		for _, de := range dirEntries {
			if de.IsDir() || de.Name() != "index.html" {
				continue
			}
			rel, _ := filepath.Rel(s.root, filepath.Join(full, "index.html"))
			resp := BrowseResponse{
				Type: "index",
				Path: filepath.ToSlash(rel),
			}
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Cache-Control", "no-cache")
			_ = json.NewEncoder(w).Encode(resp)
			return
		}
	}

	s.serveDirEntries(w, dirEntries)
}

func (s *Server) serveDirEntries(
	w http.ResponseWriter,
	dirEntries []os.DirEntry,
) {
	entries := s.collectEntries(dirEntries)
	resp := BrowseResponse{Type: "dir", Entries: entries}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-cache")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
	}
}

func dirEntryToEntry(de os.DirEntry) (Entry, bool) {
	info, err := de.Info()
	if err != nil {
		return Entry{}, false
	}
	return Entry{
		Name:    de.Name(),
		IsDir:   de.IsDir(),
		IsExec:  !de.IsDir() && info.Mode()&0o111 != 0,
		Size:    info.Size(),
		ModTime: info.ModTime(),
	}, true
}

// collectEntries converts DirEntry slices to Entry slices. For small
// directories the conversion is sequential; larger directories use
// parallel workers to overlap Info() syscalls.
func (s *Server) collectEntries(dirEntries []os.DirEntry) []Entry {
	const parallelThreshold = 200

	if len(dirEntries) < parallelThreshold {
		entries := make([]Entry, 0, len(dirEntries))
		for _, de := range dirEntries {
			if e, ok := dirEntryToEntry(de); ok {
				entries = append(entries, e)
			}
		}
		return entries
	}

	numWorkers := 16
	chunkSize := (len(dirEntries) + numWorkers - 1) / numWorkers

	type result struct {
		entries []Entry
	}
	results := make([]result, numWorkers)
	var wg sync.WaitGroup

	for i := range numWorkers {
		start := i * chunkSize
		if start >= len(dirEntries) {
			break
		}
		end := start + chunkSize
		if end > len(dirEntries) {
			end = len(dirEntries)
		}

		wg.Add(1)
		go func(idx int, chunk []os.DirEntry) {
			defer wg.Done()
			local := make([]Entry, 0, len(chunk))
			for _, de := range chunk {
				if e, ok := dirEntryToEntry(de); ok {
					local = append(local, e)
				}
			}
			results[idx].entries = local
		}(i, dirEntries[start:end])
	}
	wg.Wait()

	entries := make([]Entry, 0, len(dirEntries))
	for _, res := range results {
		entries = append(entries, res.entries...)
	}
	return entries
}

func (s *Server) handleRaw(w http.ResponseWriter, r *http.Request) {
	reqPath := r.PathValue("path")
	if s.singleFile != "" && reqPath != s.singleFile {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	full, info, err := s.resolvePath(reqPath)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			http.Error(w, "not found", http.StatusNotFound)
		} else {
			http.Error(w, "forbidden", http.StatusForbidden)
		}
		return
	}

	if info.IsDir() {
		http.Error(w, "not a file", http.StatusBadRequest)
		return
	}

	s.serveFile(w, r, full, info)
}

// serveFile sends a single file with correct MIME type and caching headers.
func (s *Server) serveFile(
	w http.ResponseWriter,
	r *http.Request,
	full string,
	info os.FileInfo,
) {
	f, err := os.Open(full)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer func() { _ = f.Close() }()

	// Force browsers to revalidate so WS-triggered re-fetches get
	// fresh content instead of heuristic-cached stale data.
	w.Header().Set("Cache-Control", "no-cache")
	// Prevent browsers from MIME-sniffing a non-HTML file (e.g., a .txt
	// starting with "<html>") into text/html, which would enable script
	// execution in dirsv's origin.
	w.Header().Set("X-Content-Type-Options", "nosniff")

	name := filepath.Base(full)

	// Go's mime package maps .ts to video/mp2t (MPEG-2 Transport Stream).
	// Override extensions that are misidentified as non-text.
	if ct, ok := textMIME[strings.ToLower(filepath.Ext(name))]; ok {
		w.Header().Set("Content-Type", ct)
	}

	// ServeContent handles Content-Length, Last-Modified, ETag,
	// If-Modified-Since, Range requests, and MIME sniffing.
	http.ServeContent(w, r, name, info.ModTime(), f)
}

// reAbsAttr matches src, href, and action attributes with absolute-path
// values (starting with "/" followed by a non-"/" character). Group 1
// captures the attribute prefix, group 2 captures the first path character
// so the leading "/" can be dropped while preserving the rest.
var reAbsAttr = regexp.MustCompile(`((?:src|href|action)\s*=\s*["'])/([^/])`)

// handleHTMLPreview serves files for HTML site preview.
//
// URL scheme: /api/htmlpreview/{encodedRoot}/{filePath...}
//
// {encodedRoot} is the site root directory with "/" encoded as %2F (e.g.,
// "bin%2Fbims-site"). {filePath} is the path within that root.
//
// HTML files get URL rewriting (absolute paths → relative) plus a <base>
// tag so all resources resolve through this endpoint. Non-HTML files are
// served as-is. Directory requests auto-resolve to index.html.
func (s *Server) handleHTMLPreview(w http.ResponseWriter, r *http.Request) {
	if s.singleFile != "" {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	// Use the raw (percent-encoded) URL to preserve %2F in the root
	// segment. Go's mux decodes %2F before populating PathValue, so
	// we extract from EscapedPath instead.
	const prefix = "/api/htmlpreview/"
	escaped := r.URL.EscapedPath()
	rawPath := strings.TrimPrefix(escaped, prefix)

	// Split into encoded-root (first segment) and file path (rest).
	encodedRoot, filePath, _ := strings.Cut(rawPath, "/")
	siteRoot, err := url.PathUnescape(encodedRoot)
	if err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	// Resolve the full filesystem path: root + filePath.
	fsPath := path.Join(siteRoot, filePath)
	full, info, resolveErr := s.resolvePath(fsPath)
	if resolveErr != nil {
		if errors.Is(resolveErr, fs.ErrNotExist) {
			http.Error(w, "not found", http.StatusNotFound)
		} else {
			http.Error(w, "forbidden", http.StatusForbidden)
		}
		return
	}

	// Directories auto-resolve to index.html (like a real web server).
	if info.IsDir() {
		indexPath := filepath.Join(full, "index.html")
		indexInfo, statErr := os.Stat(indexPath)
		if statErr != nil {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		full = indexPath
		info = indexInfo
	}

	ext := strings.ToLower(filepath.Ext(full))
	if ext != ".html" && ext != ".htm" {
		s.serveFile(w, r, full, info)
		return
	}

	// Cap preview reads to avoid OOM on multi-GB HTML files.
	const maxPreviewSize = 10 << 20 // 10 MB
	if info.Size() > maxPreviewSize {
		http.Error(
			w,
			"file too large for preview",
			http.StatusRequestEntityTooLarge,
		)
		return
	}

	content, readErr := os.ReadFile(full)
	if readErr != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	// <base> always points to the site root so sub-pages and the index
	// page resolve assets (_astro/, images/, etc.) from the same place.
	baseHref := "/api/htmlpreview/" + url.PathEscape(siteRoot) + "/"

	// Strip leading "/" from absolute-path attribute values so <base>
	// can resolve them (e.g., href="/_astro/x" → href="_astro/x").
	content = reAbsAttr.ReplaceAll(content, []byte("${1}${2}"))

	// Inject <base> after <head> so relative URLs resolve through
	// this endpoint, keeping site-internal navigation working.
	baseTag := []byte(`<base href="` + baseHref + `">`)
	if idx := indexBytesCI(content, []byte("<head")); idx != -1 {
		if closeIdx := bytes.IndexByte(content[idx:], '>'); closeIdx != -1 {
			insertAt := idx + closeIdx + 1
			var buf bytes.Buffer
			buf.Grow(len(content) + len(baseTag))
			buf.Write(content[:insertAt])
			buf.Write(baseTag)
			buf.Write(content[insertAt:])
			content = buf.Bytes()
		}
	} else {
		content = append(baseTag, content...)
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	// Restrict the preview's CSP so that even if a user navigates directly
	// to /api/htmlpreview/... (bypassing the sandboxed iframe), scripts in
	// the previewed HTML cannot fetch dirsv's API endpoints (e.g.,
	// /api/raw/) to exfiltrate file contents. The frontend renders previews
	// in a sandbox="allow-scripts" iframe (without allow-same-origin),
	// which isolates the preview from dirsv's origin. This CSP is a
	// defense-in-depth layer for direct-navigation scenarios.
	//
	// - default-src 'self': allows same-origin sub-resources (CSS, JS files)
	// - script-src 'unsafe-inline' 'unsafe-eval': allows inline JS in the
	//   previewed HTML (needed for most static sites)
	// - style-src 'self' 'unsafe-inline': allows inline styles and
	//   same-origin stylesheets
	// - img/media/font-src *: allows external assets for faithful rendering
	// - connect-src 'none': blocks all fetch/XHR — prevents same-origin API
	//   exfiltration on direct navigation (static previews don't need fetch)
	w.Header().Set("Content-Security-Policy",
		"default-src 'self'; script-src 'unsafe-inline' 'unsafe-eval'; "+
			"style-src 'self' 'unsafe-inline'; img-src * data: blob:; "+
			"media-src * data: blob:; font-src * data:; connect-src 'none'")
	_, _ = w.Write(content)
}

func (s *Server) mountSPA(appFS fs.FS) {
	// Try to get a sub-filesystem rooted at app/dist.
	sub, err := fs.Sub(appFS, "app/dist")
	if err != nil {
		sub = appFS
	}

	s.mux.HandleFunc(
		"GET /{path...}",
		func(w http.ResponseWriter, r *http.Request) {
			name := strings.TrimPrefix(r.URL.Path, "/")
			if name == "" {
				name = "index.html"
			}

			// Resolve asset: original exists, or .gz variant exists
			// (originals are removed for compressed files), or SPA fallback.
			_, statErr := fs.Stat(sub, name)
			_, gzErr := fs.Stat(sub, name+".gz")
			if statErr != nil && gzErr != nil {
				name = "index.html"
			}

			// Vite content-hashed assets are immutable; index.html must revalidate.
			if strings.HasPrefix(name, "assets/") {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			} else if name == "index.html" {
				w.Header().Set("Cache-Control", "no-cache")
			}

			// Try pre-compressed .gz variant (exists when the compressor
			// replaced the original). Serves gzip directly or decompresses
			// on the fly depending on Accept-Encoding.
			if servePrecompressed(w, r, sub, name) {
				return
			}

			http.ServeFileFS(w, r, sub, name)
		},
	)
}

// servePrecompressed looks for a pre-compressed .gz variant of name in fsys.
// If found and the client accepts gzip, it streams the .gz bytes directly.
// If found but the client doesn't accept gzip, it decompresses on the fly.
// Returns false if no .gz variant exists (caller should serve the raw file).
func servePrecompressed(
	w http.ResponseWriter,
	r *http.Request,
	fsys fs.FS,
	name string,
) bool {
	gzName := name + ".gz"
	f, err := fsys.Open(gzName)
	if err != nil {
		return false
	}
	defer func() { _ = f.Close() }()

	info, err := f.Stat()
	if err != nil {
		return false
	}

	ct := mime.TypeByExtension(filepath.Ext(name))
	if ct == "" {
		ct = "application/octet-stream"
	}

	w.Header().Set("Content-Type", ct)
	w.Header().Set("Vary", "Accept-Encoding")
	w.Header().Set("Last-Modified", info.ModTime().UTC().Format(http.TimeFormat))

	if strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
		w.Header().Set("Content-Encoding", "gzip")
		_, _ = io.Copy(w, f)
		return true
	}

	// Client doesn't accept gzip — decompress on the fly.
	gr, err := gzip.NewReader(f)
	if err != nil {
		return false
	}
	defer func() { _ = gr.Close() }()

	_, _ = io.Copy(w, gr) //nolint:gosec // G110: own embedded assets
	return true
}

// indexBytesCI returns the index of the first case-insensitive occurrence
// of needle in haystack, or -1. needle must be lowercase ASCII.
// Zero allocation — avoids bytes.ToLower on the full haystack.
func indexBytesCI(haystack, needle []byte) int {
	if len(needle) == 0 || len(needle) > len(haystack) {
		return -1
	}
	for i := range len(haystack) - len(needle) + 1 {
		match := true
		for j := range needle {
			h := haystack[i+j]
			if h >= 'A' && h <= 'Z' {
				h += 'a' - 'A'
			}
			if h != needle[j] {
				match = false
				break
			}
		}
		if match {
			return i
		}
	}
	return -1
}
