// Package server implements an HTTP server for directory browsing.
package server

import (
	"encoding/json"
	"errors"
	"io/fs"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"
)

// Entry represents a single directory entry in a listing response.
type Entry struct {
	Name    string    `json:"name"`
	IsDir   bool      `json:"isDir"`
	Size    int64     `json:"size"`
	ModTime time.Time `json:"modTime"`
}

// BrowseResponse is the JSON envelope for /api/browse/.
type BrowseResponse struct {
	Type    string    `json:"type"`
	Entries []Entry   `json:"entries,omitempty"`
	Path    string    `json:"path,omitempty"`
	Size    int64     `json:"size,omitempty"`
	ModTime time.Time `json:"modTime,omitempty"`
}

// Server serves directory listings, raw files, and the SPA frontend.
type Server struct {
	root string
	mux  *http.ServeMux
}

// New creates a Server rooted at the given filesystem path.
// If appFS is non-nil, it serves the embedded SPA frontend for non-API paths.
// The SSE handler (if any) should be mounted before calling this.
func New(root string, appFS fs.FS, sseHandler http.Handler) (*Server, error) {
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
	s.mux.HandleFunc("GET /api/browse/{path...}", s.handleBrowse)
	s.mux.HandleFunc("GET /api/raw/{path...}", s.handleRaw)

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

var errForbidden = errors.New("forbidden")

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
	fi, statErr := os.Stat(
		resolved,
	) //nolint:gosec // G703: path validated by containment check
	if statErr != nil {
		return "", nil, statErr
	}

	return resolved, fi, nil
}

func (s *Server) handleBrowse(w http.ResponseWriter, r *http.Request) {
	reqPath := r.PathValue("path")
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

	f, err := os.Open(
		full,
	) //nolint:gosec // G304: path validated by resolvePath containment check
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer func() { _ = f.Close() }()

	// Force browsers to revalidate so SSE-triggered re-fetches get
	// fresh content instead of heuristic-cached stale data.
	w.Header().Set("Cache-Control", "no-cache")

	// ServeContent handles Content-Length, Last-Modified, ETag,
	// If-Modified-Since, Range requests, and MIME sniffing.
	http.ServeContent(w, r, filepath.Base(full), info.ModTime(), f)
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

			// Serve the asset directly if it exists; otherwise SPA fallback.
			if _, err := fs.Stat(sub, name); err != nil {
				name = "index.html"
			}

			// Vite content-hashed assets are immutable; index.html must revalidate.
			if strings.HasPrefix(name, "assets/") {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			} else if name == "index.html" {
				w.Header().Set("Cache-Control", "no-cache")
			}

			http.ServeFileFS(w, r, sub, name)
		},
	)
}
