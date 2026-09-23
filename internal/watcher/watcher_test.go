package watcher

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func await(t *testing.T, condition func() bool) {
	t.Helper()
	deadline := time.NewTimer(3 * time.Second)
	defer deadline.Stop()
	tick := time.NewTicker(10 * time.Millisecond)
	defer tick.Stop()
	for {
		if condition() {
			return
		}
		select {
		case <-deadline.C:
			t.Fatal("watch state did not converge")
		case <-tick.C:
		}
	}
}

func TestWatchLifecycle(t *testing.T) {
	root := t.TempDir()
	for _, dir := range []string{"a", "b"} {
		if err := os.Mkdir(filepath.Join(root, dir), 0o700); err != nil {
			t.Fatal(err)
		}
	}
	w, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if closeErr := w.Close(); closeErr != nil {
			t.Error(closeErr)
		}
	})
	c, err := w.subscribe()
	if err != nil {
		t.Fatal(err)
	}
	set := func(prefix string) {
		w.mu.Lock()
		c.mu.Lock()
		c.prefixes = []string{prefix}
		c.mu.Unlock()
		w.requestWatches()
		w.mu.Unlock()
	}
	hasOnly := func(dir string) bool {
		w.watchMu.Lock()
		defer w.watchMu.Unlock()
		_, ok := w.watched[filepath.Join(root, dir)]
		return ok && len(w.watched) == 1
	}
	set("a")
	await(t, func() bool { return hasOnly("a") })
	for range 1000 {
		set("a")
		set("b")
	}
	await(t, func() bool { return hasOnly("b") })
	if err := os.Remove(filepath.Join(root, "b")); err != nil {
		t.Fatal(err)
	}
	await(t, func() bool {
		w.watchMu.Lock()
		defer w.watchMu.Unlock()
		_, ok := w.watched[root]
		return ok
	})
	if err := os.Mkdir(filepath.Join(root, "b"), 0o700); err != nil {
		t.Fatal(err)
	}
	await(t, func() bool { return hasOnly("b") })
	w.unsubscribe(c)
	await(
		t,
		func() bool { w.watchMu.Lock(); defer w.watchMu.Unlock(); return len(w.watched) == 0 },
	)
}

func TestChangeQueue(t *testing.T) {
	root := t.TempDir()
	w, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = w.Close() })
	for i := range 1000 {
		text := "old"
		if i == 999 {
			text = "final"
		}
		if writeErr := os.WriteFile(
			filepath.Join(root, "file"),
			[]byte(text),
			0o600,
		); writeErr != nil {
			t.Fatal(writeErr)
		}
		w.broadcast(map[string]Event{"file": {Type: "change", Path: "file"}})
	}
	await(t, func() bool {
		w.cacheMu.RLock()
		defer w.cacheMu.RUnlock()
		lines := w.cache["file"]
		return len(lines) == 1 && lines[0] == "final"
	})
}

func TestDiffContainment(t *testing.T) {
	root, outside := t.TempDir(), t.TempDir()
	secret := filepath.Join(outside, "secret")
	if err := os.WriteFile(secret, []byte("secret"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(secret, filepath.Join(root, "link")); err != nil {
		t.Fatal(err)
	}
	w, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = w.Close() }()
	ev := Event{Type: "change", Path: "link"}
	w.enrichChangedLines(&ev)
	if len(w.cache) != 0 {
		t.Fatal("cached outside-root content")
	}
}

func TestPathMatching(t *testing.T) {
	for _, tc := range []struct {
		prefix, path string
		want         bool
	}{
		{"", "file", true}, {"a", "a/b", true}, {"a/b", "a", true}, {"a.txt", "a.txt.bak", false}, {"a", "ab", false},
	} {
		c := &wsClient{prefixes: []string{tc.prefix}}
		if got := matchesClient(c, tc.path); got != tc.want {
			t.Errorf("%q, %q: %v", tc.prefix, tc.path, got)
		}
	}
}
