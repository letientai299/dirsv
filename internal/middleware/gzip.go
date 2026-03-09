// Package middleware provides HTTP middleware for the dirsv server.
package middleware

import (
	"compress/gzip"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
)

// gzipMinSize is the minimum response size worth compressing.
// Below this, gzip overhead (header + footer) can inflate the response.
const gzipMinSize = 1024

var gzipPool = sync.Pool{
	New: func() any {
		w, _ := gzip.NewWriterLevel(io.Discard, gzip.DefaultCompression)
		return w
	},
}

// gzipResponseWriter defers the compression decision until the first Write.
// This lets http.ServeContent set Content-Range and Content-Length before
// we decide whether to compress.
type gzipResponseWriter struct {
	http.ResponseWriter
	gw      *gzip.Writer
	decided bool
	useGzip bool
}

func (g *gzipResponseWriter) decide() {
	g.decided = true
	h := g.Header()
	// Skip if the handler already set Content-Encoding (pre-compressed)
	// or Content-Range (Range response — length must be exact).
	if h.Get("Content-Encoding") != "" || h.Get("Content-Range") != "" {
		return
	}
	// Skip small responses — gzip overhead exceeds savings below 1 KB.
	if cl := h.Get("Content-Length"); cl != "" {
		if n, err := strconv.ParseInt(cl, 10, 64); err == nil && n < gzipMinSize {
			return
		}
	}
	g.useGzip = true
	h.Set("Content-Encoding", "gzip")
	h.Add("Vary", "Accept-Encoding")
	h.Del("Content-Length")
	g.gw.Reset(g.ResponseWriter)
}

func (g *gzipResponseWriter) WriteHeader(code int) {
	if !g.decided {
		if code == http.StatusPartialContent || code == http.StatusNotModified {
			g.decided = true
		} else {
			g.decide()
		}
	}
	g.ResponseWriter.WriteHeader(code)
}

func (g *gzipResponseWriter) Write(b []byte) (int, error) {
	if !g.decided {
		g.decide()
	}
	if g.useGzip {
		return g.gw.Write(b)
	}
	return g.ResponseWriter.Write(b)
}

func (g *gzipResponseWriter) Flush() {
	if g.useGzip {
		_ = g.gw.Flush()
	}
	if f, ok := g.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func (g *gzipResponseWriter) Unwrap() http.ResponseWriter {
	return g.ResponseWriter
}

// Gzip wraps a handler with gzip compression for clients that accept it.
// Skips compression for WebSocket upgrades, Range responses, small
// responses (<1 KB), and responses that already have Content-Encoding.
func Gzip(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			next.ServeHTTP(w, r)
			return
		}
		if strings.EqualFold(r.Header.Get("Upgrade"), "websocket") {
			next.ServeHTTP(w, r)
			return
		}

		gz, ok := gzipPool.Get().(*gzip.Writer)
		if !ok {
			gz, _ = gzip.NewWriterLevel(io.Discard, gzip.DefaultCompression)
		}
		defer gzipPool.Put(gz)

		grw := &gzipResponseWriter{ResponseWriter: w, gw: gz}
		defer func() {
			if grw.useGzip {
				_ = gz.Close()
			}
		}()

		next.ServeHTTP(grw, r)
	})
}
