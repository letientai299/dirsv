package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/coder/websocket"
)

func setupTestDir(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()

	if err := os.WriteFile(
		filepath.Join(dir, "hello.txt"),
		[]byte("hello world"),
		0o644,
	); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(dir, "sub"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(
		filepath.Join(dir, "sub", "nested.txt"),
		[]byte("nested content"),
		0o644,
	); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(
		filepath.Join(dir, "readme.md"),
		[]byte("# Hello"),
		0o644,
	); err != nil {
		t.Fatal(err)
	}
	// Dir with index.html for trailing-slash test.
	if err := os.Mkdir(filepath.Join(dir, "site"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(
		filepath.Join(dir, "site", "index.html"),
		[]byte("<h1>hi</h1>"),
		0o644,
	); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(
		filepath.Join(dir, "vite.config.ts"),
		[]byte(`import { defineConfig } from "vite"`),
		0o644,
	); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(
		filepath.Join(dir, "query.sql"),
		[]byte(`SELECT id, name FROM users WHERE active = 1`),
		0o644,
	); err != nil {
		t.Fatal(err)
	}
	return dir
}

func newTestServer(t *testing.T) *Server {
	t.Helper()
	srv, err := New(setupTestDir(t), nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	return srv
}

func TestBrowseRoot(t *testing.T) {
	srv := newTestServer(t)
	req := httptest.NewRequestWithContext(
		context.Background(),
		http.MethodGet,
		"/api/browse/",
		nil,
	)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rec.Code)
	}

	var resp BrowseResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatal(err)
	}

	if resp.Type != "dir" {
		t.Fatalf("want type=dir, got %s", resp.Type)
	}

	names := map[string]bool{}
	for _, e := range resp.Entries {
		names[e.Name] = e.IsDir
	}

	if !names["sub"] {
		t.Error("expected sub/ to be a directory entry")
	}
	if _, ok := names["hello.txt"]; !ok {
		t.Error("expected hello.txt in listing")
	}
}

func TestBrowseFile(t *testing.T) {
	srv := newTestServer(t)
	req := httptest.NewRequestWithContext(
		context.Background(),
		http.MethodGet,
		"/api/browse/hello.txt",
		nil,
	)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rec.Code)
	}

	var resp BrowseResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatal(err)
	}

	if resp.Type != "file" {
		t.Fatalf("want type=file, got %s", resp.Type)
	}
	if resp.Size != int64(len("hello world")) {
		t.Errorf("want size=%d, got %d", len("hello world"), resp.Size)
	}
	if resp.ModTime.IsZero() {
		t.Error("expected non-zero modTime")
	}
}

func TestRawFile(t *testing.T) {
	srv := newTestServer(t)
	req := httptest.NewRequestWithContext(
		context.Background(),
		http.MethodGet,
		"/api/raw/hello.txt",
		nil,
	)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rec.Code)
	}
	if rec.Body.String() != "hello world" {
		t.Errorf("want 'hello world', got %q", rec.Body.String())
	}
}

func TestRawMIME(t *testing.T) {
	srv := newTestServer(t)
	req := httptest.NewRequestWithContext(
		context.Background(),
		http.MethodGet,
		"/api/raw/readme.md",
		nil,
	)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rec.Code)
	}

	ct := rec.Header().Get("Content-Type")
	// .md files should get a text MIME type.
	if ct == "" {
		t.Error("expected Content-Type header")
	}
}

func TestRawTSNotBinary(t *testing.T) {
	srv := newTestServer(t)
	req := httptest.NewRequestWithContext(
		context.Background(),
		http.MethodGet,
		"/api/raw/vite.config.ts",
		nil,
	)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rec.Code)
	}

	ct := rec.Header().Get("Content-Type")
	if ct != "text/plain; charset=utf-8" {
		t.Errorf("want text/plain for .ts, got %q", ct)
	}
}

func TestRawSQLNotBinary(t *testing.T) {
	srv := newTestServer(t)
	req := httptest.NewRequestWithContext(
		context.Background(),
		http.MethodGet,
		"/api/raw/query.sql",
		nil,
	)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rec.Code)
	}

	ct := rec.Header().Get("Content-Type")
	if ct != "text/plain; charset=utf-8" {
		t.Errorf("want text/plain for .sql, got %q", ct)
	}
}

func TestRawDir(t *testing.T) {
	srv := newTestServer(t)
	req := httptest.NewRequestWithContext(
		context.Background(),
		http.MethodGet,
		"/api/raw/sub",
		nil,
	)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400 for raw dir, got %d", rec.Code)
	}
}

func TestRawNested(t *testing.T) {
	srv := newTestServer(t)
	req := httptest.NewRequestWithContext(
		context.Background(),
		http.MethodGet,
		"/api/raw/sub/nested.txt",
		nil,
	)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rec.Code)
	}
	if rec.Body.String() != "nested content" {
		t.Errorf("want 'nested content', got %q", rec.Body.String())
	}
}

func TestNotFound(t *testing.T) {
	srv := newTestServer(t)
	for _, path := range []string{"/api/browse/nope.txt", "/api/raw/nope.txt"} {
		rec := httptest.NewRecorder()
		srv.ServeHTTP(
			rec,
			httptest.NewRequestWithContext(
				context.Background(),
				http.MethodGet,
				path,
				nil,
			),
		)
		if rec.Code != http.StatusNotFound {
			t.Errorf("%s: want 404, got %d", path, rec.Code)
		}
	}
}

func TestPathTraversal(t *testing.T) {
	srv := newTestServer(t)
	for _, p := range []string{
		"/api/browse/../../../etc/passwd",
		"/api/raw/../../../etc/passwd",
	} {
		rec := httptest.NewRecorder()
		srv.ServeHTTP(
			rec,
			httptest.NewRequestWithContext(
				context.Background(),
				http.MethodGet,
				p,
				nil,
			),
		)
		// ServeMux may clean /../ and redirect (307) before our handler runs.
		// Any of 307, 403, 404 are safe — only 200 is a problem.
		if rec.Code == http.StatusOK {
			t.Errorf("%s: traversal returned 200 (body: %s)", p, rec.Body.String())
		}
	}

	// Test traversal via encoded path components that reach the handler.
	for _, p := range []string{
		"/api/browse/..%2F..%2F..%2Fetc%2Fpasswd",
		"/api/raw/..%2F..%2F..%2Fetc%2Fpasswd",
	} {
		rec := httptest.NewRecorder()
		srv.ServeHTTP(
			rec,
			httptest.NewRequestWithContext(
				context.Background(),
				http.MethodGet,
				p,
				nil,
			),
		)
		if rec.Code == http.StatusOK {
			t.Errorf("%s: traversal returned 200 (body: %s)", p, rec.Body.String())
		}
	}
}

func TestSymlinkEscape(t *testing.T) {
	dir := setupTestDir(t)
	// Create a symlink inside root pointing to /tmp (outside root).
	link := filepath.Join(dir, "escape")
	if err := os.Symlink(os.TempDir(), link); err != nil {
		t.Skip("symlinks not supported:", err)
	}

	srv, err := New(dir, nil, nil)
	if err != nil {
		t.Fatal(err)
	}

	for _, p := range []string{"/api/browse/escape", "/api/raw/escape"} {
		rec := httptest.NewRecorder()
		srv.ServeHTTP(
			rec,
			httptest.NewRequestWithContext(
				context.Background(),
				http.MethodGet,
				p,
				nil,
			),
		)
		if rec.Code == http.StatusOK {
			t.Errorf("%s: symlink escape should not return 200", p)
		}
	}
}

func TestTrailingSlashIndex(t *testing.T) {
	srv := newTestServer(t)

	// No trailing slash on dir with index.html → type=index.
	req := httptest.NewRequestWithContext(
		context.Background(),
		http.MethodGet,
		"/api/browse/site",
		nil,
	)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rec.Code)
	}

	var resp BrowseResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatal(err)
	}
	if resp.Type != "index" {
		t.Fatalf("want type=index, got %s", resp.Type)
	}
	if resp.Path != "site/index.html" {
		t.Errorf("want path=site/index.html, got %s", resp.Path)
	}
}

func TestTrailingSlashDirListing(t *testing.T) {
	srv := newTestServer(t)

	// Trailing slash on dir with index.html → type=dir (dir listing).
	req := httptest.NewRequestWithContext(
		context.Background(),
		http.MethodGet,
		"/api/browse/site/",
		nil,
	)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rec.Code)
	}

	var resp BrowseResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatal(err)
	}
	if resp.Type != "dir" {
		t.Fatalf("want type=dir, got %s", resp.Type)
	}
}

func TestHostGuard(t *testing.T) {
	dir := setupTestDir(t)
	srv, err := New(dir, nil, nil, WithAllowedHosts("localhost"))
	if err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		host string
		want int
	}{
		{"localhost", http.StatusOK},
		{"localhost:8080", http.StatusOK},
		{"LOCALHOST:8080", http.StatusOK}, // case-insensitive
		{"Localhost", http.StatusOK},
		{"evil.com", http.StatusForbidden},
		{"evil.com:8080", http.StatusForbidden},
	}
	for _, tt := range tests {
		req := httptest.NewRequestWithContext(
			context.Background(),
			http.MethodGet,
			"/api/browse/",
			nil,
		)
		req.Host = tt.host
		rec := httptest.NewRecorder()
		srv.ServeHTTP(rec, req)
		if rec.Code != tt.want {
			t.Errorf("Host=%q: want %d, got %d", tt.host, tt.want, rec.Code)
		}
	}
}

func TestSPAFallback(t *testing.T) {
	// Create a minimal embedded FS with index.html.
	dir := t.TempDir()
	distDir := filepath.Join(dir, "app", "dist")
	if err := os.MkdirAll(distDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(
		filepath.Join(distDir, "index.html"),
		[]byte("<!doctype html><div id=app></div>"),
		0o644,
	); err != nil {
		t.Fatal(err)
	}

	srv, err := New(setupTestDir(t), os.DirFS(dir), nil)
	if err != nil {
		t.Fatal(err)
	}

	// Non-API, non-asset path should return index.html (SPA fallback).
	req := httptest.NewRequestWithContext(
		context.Background(),
		http.MethodGet,
		"/some/deep/path",
		nil,
	)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rec.Code)
	}
	if body := rec.Body.String(); body != "<!doctype html><div id=app></div>" {
		t.Errorf("want SPA index.html, got %q", body)
	}
}

func postEditor(srv *Server, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequestWithContext(
		context.Background(),
		http.MethodPost,
		"/api/editor",
		strings.NewReader(body),
	)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	return rec
}

func TestHandleEditor(t *testing.T) {
	tests := []struct {
		name     string
		body     string
		wantCode int
		wantCB   bool
	}{
		{
			name:     "valid scroll",
			body:     `{"type":"scroll","path":"hello.txt","line":42,"total":300}`,
			wantCode: http.StatusNoContent,
			wantCB:   true,
		},
		{
			name:     "valid cursor",
			body:     `{"type":"cursor","path":"hello.txt","line":10}`,
			wantCode: http.StatusNoContent,
			wantCB:   true,
		},
		{
			name:     "cursor with topLine",
			body:     `{"type":"cursor","path":"hello.txt","line":10,"topLine":1,"total":300}`,
			wantCode: http.StatusNoContent,
			wantCB:   true,
		},
		{
			name:     "valid selection",
			body:     `{"type":"selection","path":"hello.txt","startLine":10,"endLine":25}`,
			wantCode: http.StatusNoContent,
			wantCB:   true,
		},
		{
			name:     "valid clear",
			body:     `{"type":"clear","path":"hello.txt"}`,
			wantCode: http.StatusNoContent,
			wantCB:   true,
		},
		{
			name:     "missing path",
			body:     `{"type":"cursor","line":10}`,
			wantCode: http.StatusBadRequest,
		},
		{
			name:     "invalid type",
			body:     `{"type":"bogus","path":"hello.txt"}`,
			wantCode: http.StatusBadRequest,
		},
		{
			name:     "malformed JSON",
			body:     `{not json`,
			wantCode: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var called bool
			dir := setupTestDir(t)
			srv, err := New(dir, nil, nil, WithEditorCallback(func(_ EditorEvent) {
				called = true
			}))
			if err != nil {
				t.Fatal(err)
			}
			rec := postEditor(srv, tt.body)
			if rec.Code != tt.wantCode {
				t.Errorf("want %d, got %d (body: %s)",
					tt.wantCode, rec.Code, rec.Body.String())
			}
			if called != tt.wantCB {
				t.Errorf("callback called=%v, want %v", called, tt.wantCB)
			}
		})
	}
}

func TestHandleEditorWS(t *testing.T) {
	var got EditorEvent
	var mu sync.Mutex
	dir := setupTestDir(t)
	srv, err := New(dir, nil, nil, WithEditorCallback(func(ev EditorEvent) {
		mu.Lock()
		got = ev
		mu.Unlock()
	}))
	if err != nil {
		t.Fatal(err)
	}

	ts := httptest.NewServer(srv)
	defer ts.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	wsURL := "ws" + strings.TrimPrefix(ts.URL, "http") + "/api/editor/ws"
	conn, resp, err := websocket.Dial(ctx, wsURL, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = conn.CloseNow() }()
	if resp != nil && resp.Body != nil {
		_ = resp.Body.Close()
	}

	// Send a cursor event over WS.
	msg := []byte(
		`{"type":"cursor","path":"hello.txt","line":10,"topLine":1,"total":50}`,
	)
	if err := conn.Write(ctx, websocket.MessageText, msg); err != nil {
		t.Fatal(err)
	}

	// Give the server a moment to process.
	time.Sleep(50 * time.Millisecond)

	mu.Lock()
	ev := got
	mu.Unlock()

	if ev.Type != "cursor" {
		t.Errorf("want type=cursor, got %q", ev.Type)
	}
	if ev.Path != "hello.txt" {
		t.Errorf("want path=hello.txt, got %q", ev.Path)
	}
	if ev.Line != 10 {
		t.Errorf("want line=10, got %d", ev.Line)
	}

	_ = conn.Close(websocket.StatusNormalClosure, "")
}

func TestHandleEditorPathCleaning(t *testing.T) {
	var got EditorEvent
	dir := setupTestDir(t)
	srv, err := New(dir, nil, nil, WithEditorCallback(func(ev EditorEvent) {
		got = ev
	}))
	if err != nil {
		t.Fatal(err)
	}
	postEditor(srv, `{"type":"cursor","path":"./sub/../sub/nested.txt","line":1}`)
	if got.Path != "sub/nested.txt" {
		t.Errorf("want cleaned path sub/nested.txt, got %q", got.Path)
	}
}
