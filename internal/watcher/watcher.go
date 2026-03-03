// Package watcher provides filesystem watching with WebSocket broadcasting.
//
// Watches are added lazily: when a WebSocket client subscribes, only the
// requested subtree is walked and added to the underlying fsnotify
// watcher. This avoids the startup cost of walking the entire tree
// and keeps the watch count proportional to what clients actually
// browse.
package watcher

import (
	"context"
	"encoding/json"
	"log"
	"net"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/coder/websocket"
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

// Event represents a file system change event sent over WebSocket.
type Event struct {
	Type string `json:"type"`
	Path string `json:"path"`
}

// watchMsg is the JSON message clients send to update their watch set.
type watchMsg struct {
	Watch []string `json:"watch"`
}

// wsClient tracks a single WebSocket subscriber and the set of path
// prefixes it cares about. Prefixes are updated dynamically via
// messages on the socket without reconnecting.
type wsClient struct {
	ch       chan Event
	mu       sync.RWMutex
	prefixes []string
}

// Watcher watches a directory tree and broadcasts changes to WebSocket subscribers.
type Watcher struct {
	root  string
	debug bool
	fsw   *fsnotify.Watcher
	done  chan struct{}

	mu      sync.RWMutex
	clients map[*wsClient]struct{}

	watchMu sync.Mutex
	watched map[string]struct{} // abs paths of dirs added to fsw
}

// Option configures a Watcher.
type Option func(*Watcher)

// Debug enables verbose watcher log output (watches, events, connections).
func Debug(w *Watcher) { w.debug = true }

func (w *Watcher) logf(format string, args ...any) {
	if w.debug {
		//nolint:gosec // G706: all callers pass server-controlled data
		log.Printf(format, args...)
	}
}

// New creates a Watcher for the given root directory.
func New(root string, opts ...Option) (*Watcher, error) {
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
		clients: make(map[*wsClient]struct{}),
		watched: make(map[string]struct{}),
	}
	for _, opt := range opts {
		opt(w)
	}

	go w.loop()
	return w, nil
}

// Close stops the watcher and releases resources.
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
		w.logf("%s%-10s%s %s",
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
			fsEvent := w.toEvent(ev)
			if fsEvent == nil {
				continue
			}
			pending[fsEvent.Path] = *fsEvent
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

// toEvent converts an fsnotify event to a broadcast Event. It also watches
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

// shortUA extracts a short "Browser/Version" from a User-Agent string.
func shortUA(ua string) string {
	// Order matters — check specific browsers before generic engines.
	// substr is the token prefix to find; name is the display label.
	for _, p := range []struct{ substr, name string }{
		{"Arc/", "Arc"},
		{"OPR/", "Opera"},
		{"Edg/", "Edge"},
		{"Vivaldi/", "Vivaldi"},
		{"Brave/", "Brave"},
		{"Chrome/", "Chrome"},
		{"Firefox/", "Firefox"},
		{"Version/", "Safari"}, // Safari uses "Version/X" for its version
	} {
		if i := strings.Index(ua, p.substr); i >= 0 {
			return p.name + "/" + uaVersion(ua[i+len(p.substr):])
		}
	}
	if ua == "" {
		return "unknown"
	}
	if i := strings.IndexByte(ua, '/'); i > 0 {
		return ua[:i]
	}
	return ua
}

// uaVersion extracts the major.minor version from the start of s,
// stopping at the first space or end of string.
func uaVersion(s string) string {
	end := strings.IndexByte(s, ' ')
	if end < 0 {
		end = len(s)
	}
	ver := s[:end]
	// Keep only major version (e.g., "136" from "136.0.7103.114").
	if dot := strings.IndexByte(ver, '.'); dot > 0 {
		ver = ver[:dot]
	}
	return ver
}

func (w *Watcher) logConnect(addr, watchPath, ua string) {
	browser := shortUA(ua)
	//nolint:gosec // G706: addr is from net.SplitHostPort(RemoteAddr)
	w.logf("%s%-10s%s %s %s%s watching %s%s",
		colorCyan, "connect", colorReset,
		addr, colorDim, browser, watchPath, colorReset)
}

func (w *Watcher) logDisconnect(addr, watchPath string) {
	//nolint:gosec // G706: addr is from net.SplitHostPort(RemoteAddr)
	w.logf("%s%-10s%s %s %swatching %s%s",
		colorCyan, "disconnect", colorReset,
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

// matchesClient reports whether any of the client's prefixes match the event path.
func matchesClient(c *wsClient, evPath string) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if len(c.prefixes) == 0 {
		return true // no filter — match everything
	}
	for _, prefix := range c.prefixes {
		if prefix == "" || strings.HasPrefix(evPath, prefix) ||
			strings.HasPrefix(prefix, evPath) {
			return true
		}
	}
	return false
}

// broadcast sends each pending event to matching clients.
func (w *Watcher) broadcast(pending map[string]Event) {
	w.mu.RLock()
	defer w.mu.RUnlock()
	for _, ev := range pending {
		var notified int
		for c := range w.clients {
			if matchesClient(c, ev.Path) {
				select {
				case c.ch <- ev:
					notified++
				default:
				}
			}
		}
		clr := eventColor(ev.Type)
		w.logf("%s%-10s%s %s %s→ %d client(s)%s",
			clr, ev.Type, colorReset,
			ev.Path,
			colorDim, notified, colorReset)
	}
}

// subscribe registers a new client with no initial prefixes.
func (w *Watcher) subscribe() *wsClient {
	c := &wsClient{ch: make(chan Event, 16)}
	w.mu.Lock()
	w.clients[c] = struct{}{}
	w.mu.Unlock()
	return c
}

func (w *Watcher) unsubscribe(c *wsClient) {
	w.mu.Lock()
	delete(w.clients, c)
	w.mu.Unlock()
	close(c.ch)

	w.pruneWatches()
}

// pruneWatches removes fsnotify watches for directories that no remaining
// client needs. Called after a client disconnects.
func (w *Watcher) pruneWatches() {
	w.mu.RLock()
	prefixes := make([]string, 0, len(w.clients))
	for c := range w.clients {
		c.mu.RLock()
		prefixes = append(prefixes, c.prefixes...)
		c.mu.RUnlock()
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
		if rel == "." {
			rel = ""
		}

		needed := false
		for _, prefix := range prefixes {
			if prefix == "" || rel == "" ||
				rel == prefix ||
				strings.HasPrefix(rel, prefix+"/") ||
				strings.HasPrefix(prefix, rel+"/") {
				needed = true
				break
			}
		}
		if needed {
			continue
		}
		_ = w.fsw.Remove(dir)
		delete(w.watched, dir)
		if rel == "" {
			rel = "."
		}
		dirs = append(dirs, rel)
	}
	if len(dirs) > 0 {
		w.logf("%s%-10s%s %s",
			colorDim, "unwatch", colorReset,
			strings.Join(dirs, ", "))
	}
}

// watchForClient resolves prefix to an absolute path under root and
// ensures the subtree is watched. Rejects paths that escape the root.
// If prefix points to a file, the file's parent directory is watched.
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
	// If target is a file, watch its parent directory so fsnotify
	// can report changes to it.
	//nolint:gosec // G703: resolved is boundary-checked above
	info, statErr := os.Stat(resolved)
	if statErr == nil && !info.IsDir() {
		resolved = filepath.Dir(resolved)
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

// ServeHTTP handles WebSocket connections at /api/events.
// Clients send {"watch":["path1","path2"]} to update their watch set.
func (w *Watcher) ServeHTTP(rw http.ResponseWriter, r *http.Request) {
	w.mu.RLock()
	full := len(w.clients) >= maxClients
	w.mu.RUnlock()
	if full {
		http.Error(rw, "too many clients", http.StatusServiceUnavailable)
		return
	}

	conn, err := websocket.Accept(rw, r, nil)
	if err != nil {
		return
	}
	defer conn.CloseNow() //nolint:errcheck // best-effort cleanup

	c := w.subscribe()
	defer w.unsubscribe(c)

	clientID := clientAddr(r.RemoteAddr)
	w.logConnect(clientID, "/", r.UserAgent())
	defer w.logDisconnect(clientID, "/")

	// readCtx is cancelled when the read goroutine exits (client
	// disconnect or read error), which signals the write loop to stop.
	readCtx, readCancel := context.WithCancel(r.Context())
	defer readCancel()

	go w.readLoop(readCtx, readCancel, conn, c, clientID)

	for {
		select {
		case <-readCtx.Done():
			return
		case <-w.done:
			_ = conn.Close(websocket.StatusGoingAway, "server shutting down")
			return
		case ev := <-c.ch:
			data, err := json.Marshal(ev)
			if err != nil {
				continue
			}
			if err := conn.Write(readCtx, websocket.MessageText, data); err != nil {
				return
			}
		}
	}
}

// readLoop reads watch messages from the client and updates the client's
// prefix set. Cancels ctx on read error or close.
func (w *Watcher) readLoop(
	ctx context.Context,
	cancel context.CancelFunc,
	conn *websocket.Conn,
	c *wsClient,
	clientID string,
) {
	defer cancel()
	for {
		_, data, err := conn.Read(ctx)
		if err != nil {
			return
		}
		var msg watchMsg
		if err := json.Unmarshal(data, &msg); err != nil {
			continue
		}
		cleaned := make([]string, 0, len(msg.Watch))
		for _, raw := range msg.Watch {
			cleaned = append(cleaned, cleanWatchPath(raw))
		}

		c.mu.Lock()
		c.prefixes = cleaned
		c.mu.Unlock()

		w.logf("%s%-10s%s %s %swatching %v%s",
			colorCyan, "watch-set", colorReset,
			clientID, colorDim, cleaned, colorReset)

		for _, prefix := range cleaned {
			w.watchForClient(prefix)
		}
	}
}
