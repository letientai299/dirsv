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
	"errors"
	"io/fs"
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
	"github.com/letientai299/dirsv/internal/diff"
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
	Type         string `json:"type"`
	Path         string `json:"path"`
	ChangedLines []int  `json:"changedLines,omitempty"`
}

// watchMsg is the JSON message clients send to update their watch set.
type watchMsg struct {
	Watch []string `json:"watch"`
}

// wsClient tracks a single WebSocket subscriber and the set of path
// prefixes it cares about. Prefixes are updated dynamically via
// messages on the socket without reconnecting.
type wsClient struct {
	ch       chan []byte
	mu       sync.RWMutex
	prefixes []string
}

// Watcher watches a directory tree and broadcasts changes to WebSocket subscribers.
type Watcher struct {
	root           string
	osRoot         *os.Root
	debug          bool
	originPatterns []string
	fsw            *fsnotify.Watcher
	done           chan struct{}

	mu      sync.RWMutex
	clients map[*wsClient]struct{}

	watchMu  sync.Mutex
	watched  map[string]struct{} // abs paths of dirs added to fsw
	watchSem chan struct{}       // bounds concurrent ensureWatched goroutines

	cacheMu sync.RWMutex
	cache   map[string][]string // rel path → previous lines
}

// Option configures a Watcher.
type Option func(*Watcher)

// Debug enables verbose watcher log output (watches, events, connections).
func Debug(w *Watcher) { w.debug = true }

// WithOriginPatterns sets the allowed WebSocket origin patterns.
// Patterns follow coder/websocket conventions (e.g., "localhost:*").
// When set, connections from other origins are rejected during the
// WebSocket upgrade, preventing cross-site WebSocket hijacking where
// an attacker page opens a WS to dirsv and receives file change events.
func WithOriginPatterns(patterns ...string) Option {
	return func(w *Watcher) { w.originPatterns = patterns }
}

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

	osRoot, err := os.OpenRoot(abs)
	if err != nil {
		return nil, err
	}

	fsw, err := fsnotify.NewWatcher()
	if err != nil {
		_ = osRoot.Close()
		return nil, err
	}

	w := &Watcher{
		root:     abs,
		osRoot:   osRoot,
		fsw:      fsw,
		done:     make(chan struct{}),
		clients:  make(map[*wsClient]struct{}),
		watched:  make(map[string]struct{}),
		watchSem: make(chan struct{}, 4),
		cache:    make(map[string][]string),
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
	_ = w.osRoot.Close()
	return w.fsw.Close()
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

// ensureWatched walks relDir (relative to w.root) via w.osRoot.FS() and
// adds all sub-directories to the fsnotify watcher, skipping subtrees
// that are already watched. Walking through os.Root confines traversal
// to the root fd — symlink swaps cannot escape.
func (w *Watcher) ensureWatched(relDir string) {
	// Snapshot already-watched dirs to skip during walk (no lock held
	// during the potentially slow WalkDir).
	w.watchMu.Lock()
	snapshot := make(map[string]struct{}, len(w.watched))
	for k := range w.watched {
		snapshot[k] = struct{}{}
	}
	w.watchMu.Unlock()

	// Walk without holding the lock. Paths from fs.WalkDir on
	// osRoot.FS() are relative to w.root (forward-slash separated).
	var newDirs []string
	_ = fs.WalkDir(
		w.osRoot.FS(),
		relDir,
		func(p string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			select {
			case <-w.done:
				return fs.SkipAll
			default:
			}
			if !d.IsDir() {
				return nil
			}
			// Never skip the walk root itself — it may start with "."
			// (e.g., dirsv -root .hidden).
			abs := filepath.Join(w.root, filepath.FromSlash(p))
			if p != relDir && shouldSkipDir(d.Name()) {
				return fs.SkipDir
			}
			if _, ok := snapshot[abs]; ok {
				return fs.SkipDir // subtree already covered
			}
			newDirs = append(newDirs, abs)
			return nil
		},
	)

	if len(newDirs) == 0 {
		return
	}

	// Lock only for the batch add.
	w.watchMu.Lock()
	defer w.watchMu.Unlock()

	var added []string
	for _, abs := range newDirs {
		if _, ok := w.watched[abs]; ok {
			continue // added by a concurrent call
		}
		if err := w.fsw.Add(abs); err != nil {
			continue
		}
		w.watched[abs] = struct{}{}
		rel, _ := filepath.Rel(w.root, abs)
		added = append(added, filepath.ToSlash(rel))
	}
	if len(added) > 0 {
		//nolint:gosec // G706: dirs derived from filepath.Abs
		w.logf("%s%-10s%s %s",
			colorDim, "watch", colorReset,
			strings.Join(added, ", "))
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
	maxWatchPrefixes = 50 // per client, prevents unbounded goroutine spawning
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

// maxDiffSize is the largest file (1 MB) we'll read for diffing.
const maxDiffSize = 1 << 20

// broadcast dispatches pending events. Change events are enriched with line
// diffs in a bounded goroutine; other events are sent immediately.
func (w *Watcher) broadcast(pending map[string]Event) {
	for _, ev := range pending {
		if ev.Type == "change" {
			ev := ev // capture loop variable
			go func() {
				w.watchSem <- struct{}{}
				defer func() { <-w.watchSem }()
				w.processChange(ev)
			}()
			continue
		}
		// Non-change events: clean cache on remove/rename.
		if ev.Type == "delete" || ev.Type == "rename" {
			w.cacheMu.Lock()
			delete(w.cache, ev.Path)
			w.cacheMu.Unlock()
		}
		w.fanOut(ev)
	}
}

// processChange reads the changed file, computes a line diff against the
// cached content, updates the cache, and fans out the enriched event.
func (w *Watcher) processChange(ev Event) {
	w.enrichChangedLines(&ev)
	w.fanOut(ev)
}

// enrichChangedLines attempts to read the file and compute line-level diff.
// On any failure (stat, read, binary, too large) it returns silently —
// the event is sent without changedLines.
func (w *Watcher) enrichChangedLines(ev *Event) {
	absPath := filepath.Join(w.root, filepath.FromSlash(ev.Path))
	info, err := os.Stat(absPath)
	if err != nil || info.IsDir() || info.Size() > maxDiffSize {
		return
	}

	//nolint:gosec // absPath is w.root + relative event path, not user input
	data, err := os.ReadFile(absPath)
	if err != nil || diff.IsBinary(data) {
		return
	}

	newLines := strings.Split(string(data), "\n")

	w.cacheMu.Lock()
	oldLines, hadCache := w.cache[ev.Path]
	w.cache[ev.Path] = newLines
	w.cacheMu.Unlock()

	if hadCache {
		ev.ChangedLines = diff.ChangedLines(oldLines, newLines)
	}
}

// fanOut marshals an event and sends it to all matching clients.
func (w *Watcher) fanOut(ev Event) {
	data, err := json.Marshal(ev)
	if err != nil {
		return
	}
	w.mu.RLock()
	defer w.mu.RUnlock()
	var notified int
	for c := range w.clients {
		if matchesClient(c, ev.Path) {
			select {
			case c.ch <- data:
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

// BroadcastEditor forwards a pre-marshaled editor event JSON blob to
// matching WebSocket clients. The path is extracted from the JSON to
// apply prefix filtering.
func (w *Watcher) BroadcastEditor(data []byte) {
	var peek struct {
		Type string `json:"type"`
		Path string `json:"path"`
	}
	if err := json.Unmarshal(data, &peek); err != nil {
		return
	}
	w.mu.RLock()
	defer w.mu.RUnlock()
	var notified int
	for c := range w.clients {
		if matchesClient(c, peek.Path) {
			select {
			case c.ch <- data:
				notified++
			default:
			}
		}
	}
	w.logf("%s%-10s%s %s %s→ %d client(s)%s",
		colorCyan, "editor", colorReset, peek.Path,
		colorDim, notified, colorReset)
}

var errTooManyClients = errors.New("too many clients")

// subscribe registers a new client with no initial prefixes.
// Returns errTooManyClients if the client count has reached maxClients.
// The capacity check and insertion are atomic under the same write lock
// to prevent TOCTOU races where concurrent upgrades bypass the limit.
func (w *Watcher) subscribe() (*wsClient, error) {
	w.mu.Lock()
	if len(w.clients) >= maxClients {
		w.mu.Unlock()
		return nil, errTooManyClients
	}
	c := &wsClient{ch: make(chan []byte, 16)}
	w.clients[c] = struct{}{}
	w.mu.Unlock()
	return c, nil
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
		// Prune cached content for files under removed directories.
		w.cacheMu.Lock()
		for cachedPath := range w.cache {
			for _, rel := range dirs {
				if rel == "." || strings.HasPrefix(cachedPath, rel+"/") {
					delete(w.cache, cachedPath)
					break
				}
			}
		}
		w.cacheMu.Unlock()
	}
}

// watchForClient resolves prefix to an absolute path under root and
// ensures the subtree is watched. Rejects paths that escape the root
// (os.Root enforces containment via the directory fd).
// If prefix points to a file, the file's parent directory is watched.
func (w *Watcher) watchForClient(prefix string) {
	// os.Root.Stat follows symlinks but confines resolution to the
	// root directory — paths that escape via ../ or symlinks are rejected
	// by the kernel, replacing the manual EvalSymlinks + prefix check.
	target := prefix
	if target == "" {
		target = "."
	}
	info, err := w.osRoot.Stat(target)
	if err != nil {
		return
	}
	// If target is a file, watch its parent directory so fsnotify
	// can report changes to it.
	if !info.IsDir() {
		target = path.Dir(target)
	}
	// Run asynchronously so the client's read loop isn't blocked by
	// the WalkDir inside ensureWatched. The semaphore caps concurrent
	// walks to prevent goroutine accumulation from rapid watch messages.
	go func() {
		w.watchSem <- struct{}{}
		defer func() { <-w.watchSem }()
		w.ensureWatched(target)
	}()
}

// CleanWatchPath normalizes the watch query parameter to match the format
// of event paths (relative, slash-separated, no leading slash or dots).
func CleanWatchPath(raw string) string {
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
	var wsOpts *websocket.AcceptOptions
	if len(w.originPatterns) > 0 {
		wsOpts = &websocket.AcceptOptions{OriginPatterns: w.originPatterns}
	}
	conn, err := websocket.Accept(rw, r, wsOpts)
	if err != nil {
		return
	}
	defer func() { _ = conn.CloseNow() }()

	// Watch messages are small JSON ({"watch":["path",...]}). Set an
	// explicit read limit instead of relying on the library default
	// (32 KiB) which could change across upgrades.
	conn.SetReadLimit(4096)

	c, subErr := w.subscribe()
	if subErr != nil {
		_ = conn.Close(websocket.StatusTryAgainLater, subErr.Error())
		return
	}
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
		case data := <-c.ch:
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
			cleaned = append(cleaned, CleanWatchPath(raw))
		}
		// Cap prefixes per client to prevent a malicious client from
		// spawning unbounded goroutines (each new prefix triggers a
		// WalkDir via ensureWatched).
		if len(cleaned) > maxWatchPrefixes {
			cleaned = cleaned[:maxWatchPrefixes]
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
