// Package watcher provides filesystem watching with SSE broadcasting.
//
// Limitation (v0.1): the entire directory tree under root is watched at
// startup. On Linux the default inotify limit is 8192 watches per user
// (see /proc/sys/fs/inotify/max_user_watches). For very large trees,
// raise the limit or use lazy per-subscriber watching (planned for v0.2).
package watcher

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"

	"github.com/fsnotify/fsnotify"
)

// Event represents a file system change event sent over SSE.
type Event struct {
	Type string `json:"type"`
	Path string `json:"path"`
}

// Watcher watches a directory tree and broadcasts changes to SSE subscribers.
type Watcher struct {
	root    string
	fsw     *fsnotify.Watcher
	done    chan struct{}
	mu      sync.RWMutex
	clients map[chan Event]string // channel → watched path prefix
}

// New creates a Watcher for the given root directory.
func New(root string) (*Watcher, error) {
	abs, err := filepath.Abs(root)
	if err != nil {
		return nil, err
	}

	fsw, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}

	w := &Watcher{
		root:    abs,
		fsw:     fsw,
		done:    make(chan struct{}),
		clients: make(map[chan Event]string),
	}

	if err := w.addRecursive(abs); err != nil {
		_ = fsw.Close()
		return nil, err
	}

	go w.loop()
	return w, nil
}

// Close stops the watcher, unblocks SSE subscribers, and releases resources.
func (w *Watcher) Close() error {
	close(w.done)
	return w.fsw.Close()
}

// shouldSkipDir reports whether a directory should be excluded from watching.
func shouldSkipDir(name string) bool {
	return strings.HasPrefix(name, ".") || name == "node_modules"
}

func (w *Watcher) addRecursive(dir string) error {
	return filepath.WalkDir(dir, func(p string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			// Never skip the walk root itself — it may start with "."
			// (e.g., dirsv -root .hidden).
			if p != dir && shouldSkipDir(d.Name()) {
				return filepath.SkipDir
			}
			return w.fsw.Add(p)
		}
		return nil
	})
}

func (w *Watcher) loop() {
	for {
		select {
		case ev, ok := <-w.fsw.Events:
			if !ok {
				return
			}
			w.handleEvent(ev)

		case err, ok := <-w.fsw.Errors:
			if !ok {
				return
			}
			log.Printf("watcher error: %v", err)
		}
	}
}

func (w *Watcher) handleEvent(ev fsnotify.Event) {
	rel, err := filepath.Rel(w.root, ev.Name)
	if err != nil {
		return
	}
	rel = filepath.ToSlash(rel)

	var eventType string
	switch {
	case ev.Op.Has(fsnotify.Create):
		eventType = "create"
		// Watch new directories, respecting the same skip rules.
		if info, err := os.Stat(ev.Name); err == nil && info.IsDir() {
			if !shouldSkipDir(info.Name()) {
				_ = w.fsw.Add(ev.Name)
			}
		}
	case ev.Op.Has(fsnotify.Write):
		eventType = "change"
	case ev.Op.Has(fsnotify.Remove):
		eventType = "delete"
	case ev.Op.Has(fsnotify.Rename):
		eventType = "rename"
	default:
		return
	}

	sseEvent := Event{Type: eventType, Path: rel}

	// RLock: handleEvent only reads the client map; subscribe/unsubscribe
	// take the write lock. This lets multiple events fan out concurrently.
	w.mu.RLock()
	defer w.mu.RUnlock()
	for ch, prefix := range w.clients {
		if prefix == "" || strings.HasPrefix(rel, prefix) || strings.HasPrefix(prefix, rel) {
			select {
			case ch <- sseEvent:
			default:
				// Drop if client is slow.
			}
		}
	}
}

// subscribe registers a client for events matching the given path prefix.
func (w *Watcher) subscribe(prefix string) chan Event {
	ch := make(chan Event, 16)
	w.mu.Lock()
	w.clients[ch] = prefix
	w.mu.Unlock()
	return ch
}

func (w *Watcher) unsubscribe(ch chan Event) {
	w.mu.Lock()
	delete(w.clients, ch)
	w.mu.Unlock()
	close(ch)
}

// cleanWatchPath normalizes the watch query parameter to match the format
// of event paths (relative, slash-separated, no leading slash or dots).
func cleanWatchPath(raw string) string {
	cleaned := path.Clean("/" + raw)
	cleaned = strings.TrimPrefix(cleaned, "/")
	if cleaned == "." {
		return ""
	}
	return cleaned
}

// ServeHTTP handles SSE connections at /api/events?watch=<path>.
func (w *Watcher) ServeHTTP(rw http.ResponseWriter, r *http.Request) {
	flusher, ok := rw.(http.Flusher)
	if !ok {
		http.Error(rw, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	watchPath := cleanWatchPath(r.URL.Query().Get("watch"))
	ch := w.subscribe(watchPath)
	defer w.unsubscribe(ch)

	rw.Header().Set("Content-Type", "text/event-stream")
	rw.Header().Set("Cache-Control", "no-cache")
	rw.Header().Set("Connection", "keep-alive")
	rw.Header().Set("X-Accel-Buffering", "no")
	flusher.Flush()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case <-w.done:
			return
		case ev := <-ch:
			data, err := json.Marshal(ev)
			if err != nil {
				continue
			}
			_, _ = fmt.Fprintf(rw, "data: %s\n\n", data)
			flusher.Flush()
		}
	}
}
