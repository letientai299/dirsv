package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func setupTestDir(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()

	if err := os.WriteFile(filepath.Join(dir, "hello.txt"), []byte("hello world"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(dir, "sub"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "sub", "nested.txt"), []byte("nested content"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "readme.md"), []byte("# Hello"), 0o644); err != nil {
		t.Fatal(err)
	}
	// Dir with index.html for trailing-slash test.
	if err := os.Mkdir(filepath.Join(dir, "site"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "site", "index.html"), []byte("<h1>hi</h1>"), 0o644); err != nil {
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
	req := httptest.NewRequest(http.MethodGet, "/api/browse/", nil)
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
	req := httptest.NewRequest(http.MethodGet, "/api/browse/hello.txt", nil)
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
}

func TestRawFile(t *testing.T) {
	srv := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/raw/hello.txt", nil)
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
	req := httptest.NewRequest(http.MethodGet, "/api/raw/readme.md", nil)
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

func TestRawDir(t *testing.T) {
	srv := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/raw/sub", nil)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400 for raw dir, got %d", rec.Code)
	}
}

func TestRawNested(t *testing.T) {
	srv := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/raw/sub/nested.txt", nil)
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
		srv.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		if rec.Code != http.StatusNotFound {
			t.Errorf("%s: want 404, got %d", path, rec.Code)
		}
	}
}

func TestPathTraversal(t *testing.T) {
	srv := newTestServer(t)
	for _, path := range []string{
		"/api/browse/../../../etc/passwd",
		"/api/raw/../../../etc/passwd",
	} {
		rec := httptest.NewRecorder()
		srv.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		// Should either resolve within root or be forbidden — never serve /etc/passwd.
		if rec.Code == http.StatusOK {
			body := rec.Body.String()
			if len(body) > 0 && body[0] == 'r' {
				t.Errorf("%s: path traversal may have leaked a file", path)
			}
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
		srv.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, p, nil))
		if rec.Code == http.StatusOK {
			t.Errorf("%s: symlink escape should not return 200", p)
		}
	}
}

func TestTrailingSlashIndex(t *testing.T) {
	srv := newTestServer(t)

	// No trailing slash on dir with index.html → type=index.
	req := httptest.NewRequest(http.MethodGet, "/api/browse/site", nil)
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
	req := httptest.NewRequest(http.MethodGet, "/api/browse/site/", nil)
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

func TestSPAFallback(t *testing.T) {
	// Create a minimal embedded FS with index.html.
	dir := t.TempDir()
	distDir := filepath.Join(dir, "app", "dist")
	if err := os.MkdirAll(distDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(distDir, "index.html"), []byte("<!doctype html><div id=app></div>"), 0o644); err != nil {
		t.Fatal(err)
	}

	srv, err := New(setupTestDir(t), os.DirFS(dir), nil)
	if err != nil {
		t.Fatal(err)
	}

	// Non-API, non-asset path should return index.html (SPA fallback).
	req := httptest.NewRequest(http.MethodGet, "/some/deep/path", nil)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rec.Code)
	}
	if body := rec.Body.String(); body != "<!doctype html><div id=app></div>" {
		t.Errorf("want SPA index.html, got %q", body)
	}
}
