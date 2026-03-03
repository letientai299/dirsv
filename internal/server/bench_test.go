package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

// setupBenchServer creates a Server rooted at a temp dir with N files.
func setupBenchServer(b *testing.B, nFiles int) (srv *Server, dir string) {
	b.Helper()
	dir = b.TempDir()

	for i := range nFiles {
		name := filepath.Join(dir, "file"+string(rune('a'+i%26))+".txt")
		if i >= 26 {
			name = filepath.Join(
				dir,
				"file"+string(rune('a'+i/26))+string(rune('a'+i%26))+".txt",
			)
		}
		if err := os.WriteFile(name, []byte("hello world"), 0o644); err != nil {
			b.Fatal(err)
		}
	}

	var err error
	srv, err = New(dir, nil, nil)
	if err != nil {
		b.Fatal(err)
	}
	return srv, dir
}

// BenchmarkHandleBrowseSmallDir benchmarks directory listing with 10 files.
func BenchmarkHandleBrowseSmallDir(b *testing.B) {
	srv, _ := setupBenchServer(b, 10)
	req := httptest.NewRequest("GET", "/api/browse/", nil)

	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			b.Fatalf("status %d", w.Code)
		}
	}
}

// BenchmarkHandleBrowseLargeDir benchmarks directory listing with 500 files.
func BenchmarkHandleBrowseLargeDir(b *testing.B) {
	dir := b.TempDir()
	for i := range 500 {
		name := filepath.Join(dir, "file"+padInt(i)+".txt")
		if err := os.WriteFile(name, []byte("hello world"), 0o644); err != nil {
			b.Fatal(err)
		}
	}
	srv, err := New(dir, nil, nil)
	if err != nil {
		b.Fatal(err)
	}

	req := httptest.NewRequest("GET", "/api/browse/", nil)

	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			b.Fatalf("status %d", w.Code)
		}
	}
}

// BenchmarkHandleRawSmallFile benchmarks serving a small file (~11 bytes).
func BenchmarkHandleRawSmallFile(b *testing.B) {
	srv, dir := setupBenchServer(b, 1)
	entries, _ := os.ReadDir(dir)
	name := entries[0].Name()
	req := httptest.NewRequest("GET", "/api/raw/"+name, nil)

	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			b.Fatalf("status %d", w.Code)
		}
	}
}

// BenchmarkHandleRawLargeFile benchmarks serving a 1 MB file.
func BenchmarkHandleRawLargeFile(b *testing.B) {
	dir := b.TempDir()
	data := make([]byte, 1<<20) // 1 MB
	for i := range data {
		data[i] = byte(i % 256)
	}
	if err := os.WriteFile(
		filepath.Join(dir, "large.bin"),
		data,
		0o644,
	); err != nil {
		b.Fatal(err)
	}

	srv, err := New(dir, nil, nil)
	if err != nil {
		b.Fatal(err)
	}
	req := httptest.NewRequest("GET", "/api/raw/large.bin", nil)

	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			b.Fatalf("status %d", w.Code)
		}
	}
}

// BenchmarkResolvePath benchmarks path resolution (symlink eval + containment).
func BenchmarkResolvePath(b *testing.B) {
	srv, dir := setupBenchServer(b, 10)
	entries, _ := os.ReadDir(dir)
	name := entries[0].Name()

	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		_, _, err := srv.resolvePath(name)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkResolvePathDeep benchmarks path resolution with nested directories.
func BenchmarkResolvePathDeep(b *testing.B) {
	dir := b.TempDir()
	// Create 5-level nesting
	nested := filepath.Join(dir, "a", "b", "c", "d", "e")
	if err := os.MkdirAll(nested, 0o755); err != nil {
		b.Fatal(err)
	}
	if err := os.WriteFile(
		filepath.Join(nested, "f.txt"),
		[]byte("x"),
		0o644,
	); err != nil {
		b.Fatal(err)
	}
	srv, err := New(dir, nil, nil)
	if err != nil {
		b.Fatal(err)
	}

	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		_, _, err := srv.resolvePath("a/b/c/d/e/f.txt")
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkJSONEncodeBrowseResponse benchmarks JSON encoding of directory listing.
func BenchmarkJSONEncodeBrowseResponse(b *testing.B) {
	entries := make([]Entry, 200)
	for i := range entries {
		entries[i] = Entry{
			Name:  "file" + padInt(i) + ".txt",
			IsDir: false,
			Size:  1024,
		}
	}
	resp := BrowseResponse{Type: "dir", Entries: entries}

	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		data, err := json.Marshal(resp)
		if err != nil {
			b.Fatal(err)
		}
		_ = data
	}
}

func padInt(i int) string {
	return fmt.Sprintf("%03d", i)
}
