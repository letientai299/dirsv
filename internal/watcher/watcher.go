// Package watcher provides filesystem watching with SSE broadcasting.
//
// Watches are added lazily: when an SSE client subscribes, only the
// requested subtree is walked and added to the underlying fsnotify
// watcher. This avoids the startup cost of walking the entire tree
// and keeps the watch count proportional to what clients actually
// browse.
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
	"time"

	"github.com/fsnotify/fsnotify"
)

// Event represents a file system change event sent over SSE.
type Event struct {
	Type string `json:"type"`
	Path string `json:"path"`
}

// Watcher watches a directory tree and broadcasts changes to SSE subscribers.
type Watcher struct {
	root string
	fsw  *fsnotify.Watcher
	done chan struct{}

	mu      sync.RWMutex
	clients map[chan Event]string // channel → watched path prefix

	watchMu sync.Mutex
	watched map[string]struct{} // abs paths of dirs added to fsw
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
		watched: make(map[string]struct{}),
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

// ensureWatched walks dir and adds all sub-directories to the fsnotify
// watcher, skipping subtrees that are already watched.
func (w *Watcher) ensureWatched(dir string) {
	w.watchMu.Lock()
	defer w.watchMu.Unlock()

	_ = filepath.WalkDir(dir, func(p string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		select {
		case <-w.done:
			return filepath.SkipAll
		default:
		}
		if !d.IsDir() {
			return nil
		}
		// Never skip the walk root itself — it may start with "."
		// (e.g., dirsv -root .hidden).
		if p != dir && shouldSkipDir(d.Name()) {
			return filepath.SkipDir
		}
		if _, ok := w.watched[p]; ok {
			return filepath.SkipDir // subtree already covered
		}
		if err := w.fsw.Add(p); err != nil {
			return err
		}
		w.watched[p] = struct{}{}
		return nil
	})
}

const (
	coalesceDuration = 100 * time.Millisecond
	maxClients       = 128
)

func (w *Watcher) loop() {
	pending := make(map[string]Event)
	var timer *time.Timer
	var timerC <-chan time.Time

	for {
		select {
		case ev, ok := <-w.fsw.Events:
			if !ok {
				return
			}
			sseEvent := w.toEvent(ev)
			if sseEvent == nil {
				continue
			}
			pending[sseEvent.Path] = *sseEvent
			if timer == nil {
				timer = time.NewTimer(coalesceDuration)
				timerC = timer.C
			}

		case <-timerC:
			w.broadcast(pending)
			clear(pending)
			timer = nil
			timerC = nil

		case err, ok := <-w.fsw.Errors:
			if !ok {
				return
			}
			log.Printf("watcher error: %v", err)
		}
	}
}

// toEvent converts an fsnotify event to an SSE Event. It also watches
// newly created directories. Returns nil for ignored operations.
func (w *Watcher) toEvent(ev fsnotify.Event) *Event {
	rel, err := filepath.Rel(w.root, ev.Name)
	if err != nil {
		return nil
	}
	rel = filepath.ToSlash(rel)

	var eventType string
	switch {
	case ev.Op.Has(fsnotify.Create):
		eventType = "create"
		if info, err := os.Stat(ev.Name); err == nil && info.IsDir() {
			if !shouldSkipDir(info.Name()) {
				_ = w.fsw.Add(ev.Name)
				w.watchMu.Lock()
				w.watched[ev.Name] = struct{}{}
				w.watchMu.Unlock()
			}
		}
	case ev.Op.Has(fsnotify.Write):
		eventType = "change"
	case ev.Op.Has(fsnotify.Remove):
		eventType = "delete"
	case ev.Op.Has(fsnotify.Rename):
		eventType = "rename"
	default:
		return nil
	}

	return &Event{Type: eventType, Path: rel}
}

// broadcast sends each pending event to matching SSE clients.
func (w *Watcher) broadcast(pending map[string]Event) {
	w.mu.RLock()
	defer w.mu.RUnlock()
	for _, ev := range pending {
		for ch, prefix := range w.clients {
			if prefix == "" || strings.HasPrefix(ev.Path, prefix) ||
				strings.HasPrefix(prefix, ev.Path) {
				select {
				case ch <- ev:
				default:
				}
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

// watchForClient resolves prefix to an absolute path under root and
// ensures the subtree is watched. Rejects paths that escape the root.
func (w *Watcher) watchForClient(prefix string) {
	abs := filepath.Join(w.root, filepath.FromSlash(prefix))
	// Resolve symlinks so the containment check uses the real target.
	resolved, err := filepath.EvalSymlinks(abs)
	if err != nil {
		return
	}
	if resolved != w.root &&
		!strings.HasPrefix(resolved, w.root+string(filepath.Separator)) {
		return
	}
	w.ensureWatched(resolved)
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

	w.mu.RLock()
	full := len(w.clients) >= maxClients
	w.mu.RUnlock()
	if full {
		http.Error(rw, "too many SSE clients", http.StatusServiceUnavailable)
		return
	}

	ch := w.subscribe(watchPath)
	defer w.unsubscribe(ch)

	rw.Header().Set("Content-Type", "text/event-stream")
	rw.Header().Set("Cache-Control", "no-cache")
	rw.Header().Set("Connection", "keep-alive")
	rw.Header().Set("X-Accel-Buffering", "no")
	flusher.Flush()

	// Lazily watch the requested subtree after SSE headers are sent.
	go w.watchForClient(watchPath)

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
