package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"testing"
)

func request(
	t *testing.T,
	s *Server,
	target string,
) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	s.ServeHTTP(
		rec,
		httptest.NewRequestWithContext(t.Context(), http.MethodGet, target, nil),
	)
	return rec
}

func writeFixture(t *testing.T, name, content string) {
	t.Helper()
	if err := os.WriteFile(name, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
}

func TestRootedServing(t *testing.T) {
	root, outside := t.TempDir(), t.TempDir()
	writeFixture(t, filepath.Join(outside, "secret.html"), "outside")
	writeFixture(t, filepath.Join(root, "safe.txt"), "inside")
	s, err := New(root, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(s.Close)
	if got := request(t, s, "/api/raw/safe.txt"); got.Body.String() != "inside" {
		t.Fatal(got.Body.String())
	}
	if err := os.Rename(
		filepath.Join(root, "safe.txt"),
		filepath.Join(root, "saved.txt"),
	); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(
		filepath.Join(outside, "secret.html"),
		filepath.Join(root, "safe.txt"),
	); err != nil {
		t.Fatal(err)
	}
	if got := request(t, s, "/api/raw/safe.txt"); got.Code != 403 {
		t.Fatalf("cached replacement: %d", got.Code)
	}
	if err := os.Mkdir(filepath.Join(root, "site"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(
		filepath.Join(outside, "secret.html"),
		filepath.Join(root, "site", "index.html"),
	); err != nil {
		t.Fatal(err)
	}
	if got := request(t, s, "/api/htmlpreview/site/"); got.Code != 403 {
		t.Fatalf("preview escape: %d", got.Code)
	}
	if err := os.Symlink(
		"saved.txt",
		filepath.Join(root, "internal.txt"),
	); err != nil {
		t.Fatal(err)
	}
	if got := request(
		t,
		s,
		"/api/raw/internal.txt",
	); got.Body.String() != "inside" {
		t.Fatal(got.Body.String())
	}
	if err := os.Rename(
		filepath.Join(root, "site"),
		filepath.Join(root, "oldsite"),
	); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(root, "site")); err != nil {
		t.Fatal(err)
	}
	if got := request(t, s, "/api/raw/site/secret.html"); got.Code != 403 {
		t.Fatalf("directory escape: %d", got.Code)
	}
}

func TestEncodedPreview(t *testing.T) {
	root := t.TempDir()
	s, err := New(root, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(s.Close)
	for _, name := range []string{"a b.html", "a#b.html", "a?b.html", "a%b.html", "tiếng.html"} {
		writeFixture(t, filepath.Join(root, name), "hello")
		for _, prefix := range []string{"/api/raw/", "/api/htmlpreview/%2F/"} {
			rec := request(t, s, prefix+url.PathEscape(name))
			if rec.Code != 200 {
				t.Errorf("%s%s: %d", prefix, name, rec.Code)
			}
		}
	}
}

func TestBoundedListing(t *testing.T) {
	root := t.TempDir()
	for i := range 10001 {
		writeFixture(t, filepath.Join(root, fmt.Sprintf("%05d.txt", i)), "")
	}
	writeFixture(t, filepath.Join(root, "index.html"), "index")
	s, err := New(filepath.Dir(root), nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(s.Close)
	base := "/api/browse/" + url.PathEscape(filepath.Base(root))
	var listing BrowseResponse
	if err := json.Unmarshal(
		request(t, s, base+"/").Body.Bytes(),
		&listing,
	); err != nil {
		t.Fatal(err)
	}
	if len(listing.Entries) != 10000 || !listing.Truncated {
		t.Fatalf(
			"listing: %d, truncated=%v",
			len(listing.Entries),
			listing.Truncated,
		)
	}
	var index BrowseResponse
	if err := json.Unmarshal(
		request(t, s, base).Body.Bytes(),
		&index,
	); err != nil {
		t.Fatal(err)
	}
	if index.Type != "index" {
		t.Fatalf("missing index: %+v", index)
	}
}
