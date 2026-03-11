// Package appinfo holds build-time version info injected via ldflags.
package appinfo

import (
	"fmt"
	"runtime/debug"
	"sync"
)

// Set via -ldflags at build time. When unset, the binary is a dev build.
var tag string // e.g. "v0.3.1"

const repo = "https://github.com/letientai299/dirsv"

// VersionInfo holds structured version data for API consumers.
type VersionInfo struct {
	Label string `json:"label"`
	URL   string `json:"url"`
}

var (
	infoOnce sync.Once
	infoVal  VersionInfo
)

func resolveInfo() VersionInfo {
	if tag != "" {
		return VersionInfo{
			Label: tag,
			URL:   fmt.Sprintf("%s/releases/tag/%s", repo, tag),
		}
	}

	rev, dirty := vcsBuildInfo()
	if rev == "" {
		return VersionInfo{Label: "dev", URL: repo}
	}
	suffix := ""
	if dirty {
		suffix = "*"
	}
	return VersionInfo{
		Label: rev + suffix,
		URL:   fmt.Sprintf("%s/commit/%s", repo, rev),
	}
}

// Info returns structured version info suitable for JSON serialization.
func Info() VersionInfo {
	infoOnce.Do(func() { infoVal = resolveInfo() })
	return infoVal
}

// String returns a human-readable version string.
// Release build: "v0.3.1  https://github.com/letientai299/dirsv/releases/tag/v0.3.1"
// Dev build:     "a857dcc*"
func String() string {
	v := Info()
	if tag != "" {
		return fmt.Sprintf("%s  %s", v.Label, v.URL)
	}
	return v.Label
}

// vcsBuildInfo extracts VCS revision and modified status from Go's embedded
// build info (populated by `go build` when building within a VCS checkout).
func vcsBuildInfo() (rev string, dirty bool) {
	info, ok := debug.ReadBuildInfo()
	if !ok {
		return "", false
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
			dirty = s.Value == "true"
		}
	}
	return rev, dirty
}
