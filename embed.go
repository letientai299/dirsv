// Package dirsv embeds the built frontend assets.
package dirsv

import "embed"

// AppDist contains the built frontend assets from app/dist.
//
//go:embed all:app/dist
var AppDist embed.FS
