// Package server implements an HTTP server for directory browsing.
package server

import (
	"compress/gzip"
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"
	"time"
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

// Server serves directory listings, raw files, and the SPA frontend.
type Server struct {
	root       string
	singleFile string // if non-empty, restrict serving to this one file
	mux        *http.ServeMux
}

// Option configures a Server.
type Option func(*Server)

// WithSingleFile restricts the server to serving only the named file
// (relative to root). Directory listings show only this file.
func WithSingleFile(name string) Option {
	return func(s *Server) { s.singleFile = name }
}

// New creates a Server rooted at the given filesystem path.
// If appFS is non-nil, it serves the embedded SPA frontend for non-API paths.
// The SSE handler (if any) should be mounted before calling this.
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

	s := &Server{root: abs, mux: http.NewServeMux()}
	for _, opt := range opts {
		opt(s)
	}
	s.mux.HandleFunc("GET /api/browse/{path...}", s.handleBrowse)
	s.mux.HandleFunc("GET /api/raw/{path...}", s.handleRaw)
	s.mux.HandleFunc("GET /api/htmlpreview/{path...}", s.handleHTMLPreview)
	s.mux.HandleFunc("GET /api/info", handleInfo)

	if sseHandler != nil {
		s.mux.Handle("GET /api/events", sseHandler)
	}

	if appFS != nil {
		s.mountSPA(appFS)
	}

	return s, nil
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.mux.ServeHTTP(w, r)
}

func handleInfo(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]int{"pid": os.Getpid()})
}

var errForbidden = errors.New("forbidden")

// textMIME overrides Go's mime.TypeByExtension for extensions that are
// misidentified as non-text (e.g., .ts → video/mp2t).
var textMIME = map[string]string{
	".ts":   "text/plain; charset=utf-8",
	".tsx":  "text/plain; charset=utf-8",
	".mts":  "text/plain; charset=utf-8",
	".cts":  "text/plain; charset=utf-8",
	".sql":  "text/plain; charset=utf-8",
	".dbml": "text/plain; charset=utf-8",
	".typ":  "text/plain; charset=utf-8",
}

// resolvePath cleans, resolves symlinks, and validates a request path
// against the root. Returns the real filesystem path and FileInfo, or an error:
//   - fs.ErrNotExist if the path doesn't exist
//   - errForbidden if the path escapes the root
func (s *Server) resolvePath(
	reqPath string,
) (resolved string, info os.FileInfo, err error) {
	cleaned := filepath.FromSlash(path.Clean("/" + reqPath))
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

	// Containment check above ensures resolved is within s.root.
	fi, statErr := os.Stat(resolved)
	if statErr != nil {
		return "", nil, statErr
	}

	return resolved, fi, nil
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
	entries := make([]Entry, 0, len(dirEntries))
	for _, de := range dirEntries {
		info, err := de.Info()
		if err != nil {
			continue
		}
		entries = append(entries, Entry{
			Name:    de.Name(),
			IsDir:   de.IsDir(),
			IsExec:  !de.IsDir() && info.Mode()&0o111 != 0,
			Size:    info.Size(),
			ModTime: info.ModTime(),
		})
	}

	resp := BrowseResponse{Type: "dir", Entries: entries}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-cache")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
	}
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

	// Force browsers to revalidate so SSE-triggered re-fetches get
	// fresh content instead of heuristic-cached stale data.
	w.Header().Set("Cache-Control", "no-cache")

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

	// Read HTML content for URL rewriting.
	content, readErr := os.ReadFile(full)
	if readErr != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	// <base> always points to the site root so sub-pages and the index
	// page resolve assets (_astro/, images/, etc.) from the same place.
	baseHref := "/api/htmlpreview/" + url.PathEscape(siteRoot) + "/"

	html := string(content)

	// Strip leading "/" from absolute-path attribute values so <base>
	// can resolve them (e.g., href="/_astro/x" → href="_astro/x").
	html = reAbsAttr.ReplaceAllString(html, "${1}${2}")

	// Inject <base> after <head> so relative URLs resolve through
	// this endpoint, keeping site-internal navigation working.
	baseTag := `<base href="` + baseHref + `">`
	if idx := strings.Index(strings.ToLower(html), "<head"); idx != -1 {
		if closeIdx := strings.IndexByte(html[idx:], '>'); closeIdx != -1 {
			insertAt := idx + closeIdx + 1
			html = html[:insertAt] + baseTag + html[insertAt:]
		}
	} else {
		html = baseTag + html
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Content-Security-Policy",
		"default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src *")
	_, _ = w.Write([]byte(html))
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
