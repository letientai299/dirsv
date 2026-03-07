package middleware

import (
	"log"
	"net"
	"net/http"
	"strings"
	"time"
)

// sanitizeLogValue replaces newlines and carriage returns to prevent
// log injection attacks where crafted URLs forge extra log lines.
func sanitizeLogValue(s string) string {
	if !strings.ContainsAny(s, "\r\n") {
		return s
	}
	s = strings.ReplaceAll(s, "\n", "\\n")
	s = strings.ReplaceAll(s, "\r", "\\r")
	return s
}

// statusWriter captures the HTTP status code and bytes written.
type statusWriter struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (sw *statusWriter) WriteHeader(code int) {
	sw.status = code
	sw.ResponseWriter.WriteHeader(code)
}

func (sw *statusWriter) Write(b []byte) (int, error) {
	n, err := sw.ResponseWriter.Write(b)
	sw.bytes += n
	return n, err
}

func (sw *statusWriter) Flush() {
	if f, ok := sw.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func (sw *statusWriter) Unwrap() http.ResponseWriter {
	return sw.ResponseWriter
}

// AccessLog logs each request: method, path, status, duration, bytes.
func AccessLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(sw, r)

		host, _, _ := net.SplitHostPort(r.RemoteAddr)
		if host == "" {
			host = r.RemoteAddr
		}
		// Sanitize path to prevent log injection via newlines or
		// control characters in the URL.
		safePath := sanitizeLogValue(r.URL.Path)
		//nolint:gosec // G706: inputs sanitized above
		log.Printf("%s %s %s %d %s %d",
			host, r.Method, safePath,
			sw.status, time.Since(start).Round(time.Millisecond), sw.bytes)
	})
}
