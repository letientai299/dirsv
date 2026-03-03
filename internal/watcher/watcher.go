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
	"net"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

// ANSI color helpers for terminal output.
var (
	colorReset  = "\033[0m"
	colorCyan   = "\033[36m"
	colorYellow = "\033[33m"
	colorGreen  = "\033[32m"
	colorRed    = "\033[31m"
	colorDim    = "\033[2m"
)

func init() {
	// Disable colors when stderr is not a terminal.
	info, err := os.Stderr.Stat()
	if err != nil || info.Mode()&os.ModeCharDevice == 0 {
		colorReset = ""
		colorCyan = ""
		colorYellow = ""
		colorGreen = ""
		colorRed = ""
		colorDim = ""
	}
}

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

// isEditorTempFile reports whether name looks like an editor backup, swap,
// or temporary file that should be ignored (vim ~, .swp, .swx, 4913;
// emacs #autosave#, .#lock; kate .kate-swp; etc.).
func isEditorTempFile(name string) bool {
	base := filepath.Base(name)
	switch {
	case strings.HasSuffix(base, "~"):
		return true
	case strings.HasPrefix(base, ".#"):
		return true
	case strings.HasPrefix(base, "#") && strings.HasSuffix(base, "#"):
		return true
	}
	ext := filepath.Ext(base)
	switch ext {
	case ".swp", ".swx", ".swo", ".tmp", ".bak":
		return true
	}
	// vim writes to a file named "4913" (or higher) to test directory
	// writability before saving.
	if base == "4913" {
		return true
	}
	return false
}

// ensureWatched walks dir and adds all sub-directories to the fsnotify
// watcher, skipping subtrees that are already watched.
func (w *Watcher) ensureWatched(dir string) {
	w.watchMu.Lock()
	defer w.watchMu.Unlock()

	var dirs []string
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
		rel, _ := filepath.Rel(w.root, p)
		dirs = append(dirs, filepath.ToSlash(rel))
		return nil
	})
	if len(dirs) > 0 {
		//nolint:gosec // G706: dirs derived from filepath.Abs
		log.Printf("%s%-10s%s %s",
			colorDim, "watch", colorReset,
			strings.Join(dirs, ", "))
	}
}

// removeWatched cleans up tracking state for a physically deleted directory.
// No log — the delete event itself is already logged by broadcast.
func (w *Watcher) removeWatched(absPath string) {
	w.watchMu.Lock()
	defer w.watchMu.Unlock()
	delete(w.watched, absPath)
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
	if isEditorTempFile(ev.Name) {
		return nil
	}

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
		w.removeWatched(ev.Name)
	case ev.Op.Has(fsnotify.Rename):
		eventType = "rename"
		w.removeWatched(ev.Name)
	default:
		return nil
	}

	return &Event{Type: eventType, Path: rel}
}

// clientAddr returns a safe-to-log representation of the remote address.
func clientAddr(remoteAddr string) string {
	host, port, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		return "unknown"
	}
	return net.JoinHostPort(host, port)
}

func logClient(connected bool, addr, watchPath string) {
	verb := "disconnect"
	if connected {
		verb = "connect"
	}
	//nolint:gosec // G706: addr is from net.SplitHostPort(RemoteAddr)
	log.Printf("%s%-10s%s %s %swatching %s%s",
		colorCyan, verb, colorReset,
		addr, colorDim, watchPath, colorReset)
}

// eventColor returns the ANSI color for a given event type.
func eventColor(typ string) string {
	switch typ {
	case "create":
		return colorGreen
	case "change":
		return colorYellow
	case "delete", "rename":
		return colorRed
	default:
		return colorReset
	}
}

// broadcast sends each pending event to matching SSE clients.
func (w *Watcher) broadcast(pending map[string]Event) {
	w.mu.RLock()
	defer w.mu.RUnlock()
	for _, ev := range pending {
		var notified int
		for ch, prefix := range w.clients {
			if prefix == "" || strings.HasPrefix(ev.Path, prefix) ||
				strings.HasPrefix(prefix, ev.Path) {
				select {
				case ch <- ev:
					notified++
				default:
				}
			}
		}
		c := eventColor(ev.Type)
		log.Printf("%s%-10s%s %s %s→ %d client(s)%s",
			c, ev.Type, colorReset,
			ev.Path,
			colorDim, notified, colorReset)
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

	w.pruneWatches()
}

// pruneWatches removes fsnotify watches for directories that no remaining
// SSE client needs. Called after a client disconnects.
func (w *Watcher) pruneWatches() {
	w.mu.RLock()
	prefixes := make([]string, 0, len(w.clients))
	for _, p := range w.clients {
		prefixes = append(prefixes, p)
	}
	w.mu.RUnlock()

	w.watchMu.Lock()
	defer w.watchMu.Unlock()

	var dirs []string
	for dir := range w.watched {
		rel, err := filepath.Rel(w.root, dir)
		if err != nil {
			continue
		}
		rel = filepath.ToSlash(rel)

		needed := false
		for _, prefix := range prefixes {
			if prefix == "" ||
				strings.HasPrefix(rel, prefix) ||
				strings.HasPrefix(prefix, rel) {
				needed = true
				break
			}
		}
		if needed {
			continue
		}
		_ = w.fsw.Remove(dir)
		delete(w.watched, dir)
		dirs = append(dirs, rel)
	}
	if len(dirs) > 0 {
		log.Printf("%s%-10s%s %s",
			colorDim, "unwatch", colorReset,
			strings.Join(dirs, ", "))
	}
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

	displayPath := watchPath
	if displayPath == "" {
		displayPath = "/"
	}
	clientID := clientAddr(r.RemoteAddr)
	logClient(true, clientID, displayPath)
	defer logClient(false, clientID, displayPath)

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
