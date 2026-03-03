// Package appinfo holds build-time version info injected via ldflags.
package appinfo

import "fmt"

// Set via -ldflags at build time. When unset, the binary is a dev build.
var (
	tag    string // e.g. "v0.3.1"
	commit string // e.g. "a857dcc"
	dirty  string // "true" or ""
)

const repo = "https://github.com/tai/dirsv"

// String returns a human-readable version string.
// Release build: "v0.3.1  https://github.com/tai/dirsv/releases/tag/v0.3.1"
// Dev build:     "dev (a857dcc-dirty)"
func String() string {
	if tag != "" {
		return fmt.Sprintf("%s  %s/releases/tag/%s", tag, repo, tag)
	}
	if commit == "" {
		return "dev (unknown)"
	}
	suffix := ""
	if dirty == "true" {
		suffix = "-dirty"
	}
	return fmt.Sprintf("dev (%s%s)", commit, suffix)
}
