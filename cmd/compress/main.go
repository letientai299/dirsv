// Command compress pre-compresses frontend assets with gzip.
//
// It walks the given directory, removes any stale .gz files from a previous
// run, then gzips files matching the target extensions (JS, CSS) and removes
// the originals. This ensures the directory always ends up with fresh .gz
// variants only, ready for embedding.
//
// Usage: go run ./cmd/compress <dir>
package main

import (
	"compress/gzip"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// extensions to compress — these dominate embedded asset size.
var compressExt = map[string]bool{
	".js":  true,
	".css": true,
}

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: compress <dir>")
		os.Exit(1)
	}
	if err := run(os.Args[1]); err != nil {
		fmt.Fprintf(os.Stderr, "compress: %v\n", err)
		os.Exit(1)
	}
}

func run(root string) error {
	// First pass: remove stale .gz files only when the original source file
	// exists (meaning a fresh build produced new originals to compress).
	// This keeps the directory idempotent without destroying .gz files when
	// build:fe was skipped by the task runner.
	//nolint:gosec // G703,G122: build-time tool, root is a trusted project path
	if err := filepath.WalkDir(
		root,
		func(path string, d fs.DirEntry, err error) error {
			if err != nil || d.IsDir() {
				return err
			}
			if strings.ToLower(filepath.Ext(path)) != ".gz" {
				return nil
			}
			orig := strings.TrimSuffix(path, filepath.Ext(path))
			if _, e := os.Stat(orig); e == nil {
				return os.Remove(path)
			}
			return nil
		},
	); err != nil {
		return err
	}

	// Second pass: compress matching files and remove originals.
	var count int
	//nolint:gosec // G703,G122,G304: build-time tool, trusted path
	err := filepath.WalkDir(
		root,
		func(path string, d fs.DirEntry, err error) error {
			if err != nil || d.IsDir() {
				return err
			}
			if !compressExt[strings.ToLower(filepath.Ext(path))] {
				return nil
			}

			data, err := os.ReadFile(path)
			if err != nil {
				return err
			}

			gzPath := path + ".gz"
			f, err := os.Create(gzPath)
			if err != nil {
				return err
			}

			w, _ := gzip.NewWriterLevel(f, gzip.BestCompression)
			if _, err := w.Write(data); err != nil {
				_ = f.Close()
				return err
			}
			if err := w.Close(); err != nil {
				_ = f.Close()
				return err
			}
			if err := f.Close(); err != nil {
				return err
			}

			if err := os.Remove(path); err != nil {
				return err
			}
			count++
			return nil
		},
	)
	if err != nil {
		return err
	}
	fmt.Printf("compressed %d files in %s\n", count, root)
	return nil
}
