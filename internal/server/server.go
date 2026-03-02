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

// Server serves directory listings and file contents over HTTP.
type Server struct {
	root string
	mux  *http.ServeMux
}

// New creates a Server rooted at the given filesystem path.
func New(root string) (*Server, error) {
	abs, err := filepath.Abs(root)
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
	return s, nil
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.mux.ServeHTTP(w, r)
}

func (s *Server) handleBrowse(w http.ResponseWriter, r *http.Request) {
	reqPath := r.PathValue("path")
	// Clean and resolve to prevent traversal.
	cleaned := filepath.FromSlash(path.Clean("/" + reqPath))
	full := filepath.Join(s.root, cleaned)

	if !strings.HasPrefix(full, s.root) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	info, err := os.Stat(full)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	if info.IsDir() {
		s.serveDir(w, full)
	} else {
		s.serveFile(w, full)
	}
}

func (s *Server) serveDir(w http.ResponseWriter, fullPath string) {
	dirEntries, err := os.ReadDir(fullPath)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

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

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(entries); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
	}
}

func (s *Server) serveFile(w http.ResponseWriter, fullPath string) {
	data, err := os.ReadFile(fullPath)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write(data)
}
