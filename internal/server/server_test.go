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

	// Create files and subdirectories.
	if err := os.WriteFile(filepath.Join(dir, "hello.txt"), []byte("hello world"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(dir, "sub"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "sub", "nested.txt"), []byte("nested content"), 0o644); err != nil {
		t.Fatal(err)
	}
	return dir
}

func TestListRoot(t *testing.T) {
	srv, err := New(setupTestDir(t))
	if err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/browse/", nil)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rec.Code)
	}

	var entries []Entry
	if err := json.NewDecoder(rec.Body).Decode(&entries); err != nil {
		t.Fatal(err)
	}

	names := map[string]bool{}
	for _, e := range entries {
		names[e.Name] = e.IsDir
	}

	if !names["sub"] {
		t.Error("expected sub/ to be a directory entry")
	}
	if names["hello.txt"] {
		t.Error("expected hello.txt to not be a directory")
	}
	if _, ok := names["hello.txt"]; !ok {
		t.Error("expected hello.txt in listing")
	}
}

func TestServeFile(t *testing.T) {
	srv, err := New(setupTestDir(t))
	if err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/browse/hello.txt", nil)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "text/plain; charset=utf-8" {
		t.Errorf("want text/plain, got %s", ct)
	}
	if rec.Body.String() != "hello world" {
		t.Errorf("want 'hello world', got %q", rec.Body.String())
	}
}

func TestNestedPath(t *testing.T) {
	srv, err := New(setupTestDir(t))
	if err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/browse/sub/nested.txt", nil)
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
	srv, err := New(setupTestDir(t))
	if err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/browse/nope.txt", nil)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("want 404, got %d", rec.Code)
	}
}

func TestPathTraversal(t *testing.T) {
	srv, err := New(setupTestDir(t))
	if err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/browse/../../../etc/passwd", nil)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)

	// Should either be 403 or resolve within root (not leak /etc/passwd).
	if rec.Code == http.StatusOK && rec.Body.String() != "" {
		// If it resolved to root listing, that's fine. But it must not serve /etc/passwd.
		if rec.Header().Get("Content-Type") == "text/plain; charset=utf-8" {
			t.Error("path traversal: served a file outside root")
		}
	}
}
