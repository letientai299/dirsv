// Package appinfo holds build-time version info injected via ldflags.
package appinfo

import (
	"fmt"
	"runtime/debug"
)

// Set via -ldflags at build time. When unset, the binary is a dev build.
var (
	tag    string // e.g. "v0.3.1"
	commit string // e.g. "a857dcc"
	dirty  string // "true" or ""
)

const repo = "https://github.com/letientai299/dirsv"

// String returns a human-readable version string.
// Release build: "v0.3.1  https://github.com/letientai299/dirsv/releases/tag/v0.3.1"
// Dev build:     "dev (a857dcc-dirty)"
func String() string {
	if tag != "" {
		return fmt.Sprintf("%s  %s/releases/tag/%s", tag, repo, tag)
	}

	rev, mod := vcsBuildInfo()
	if commit == "" {
		commit = rev
	}
	if dirty == "" {
		dirty = mod
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

// vcsBuildInfo extracts VCS revision and modified status from Go's embedded
// build info (populated by `go build` when building within a VCS checkout).
func vcsBuildInfo() (rev, modified string) {
	info, ok := debug.ReadBuildInfo()
	if !ok {
		return "", ""
	}
	for _, s := range info.Settings {
		switch s.Key {
		case "vcs.revision":
			if len(s.Value) > 7 {
				rev = s.Value[:7]
			} else {
				rev = s.Value
			}
		case "vcs.modified":
			if s.Value == "true" {
				modified = "true"
			}
		}
	}
	return rev, modified
}
