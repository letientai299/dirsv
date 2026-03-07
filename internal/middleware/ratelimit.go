package middleware

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// ipLimiter tracks per-IP rate limiters with automatic cleanup.
type ipLimiter struct {
	mu       sync.Mutex
	limiters map[string]*limiterEntry
	rate     rate.Limit
	burst    int
	done     chan struct{}
}

type limiterEntry struct {
	lim      *rate.Limiter
	lastSeen time.Time
}

func newIPLimiter(r rate.Limit, burst int) *ipLimiter {
	il := &ipLimiter{
		limiters: make(map[string]*limiterEntry),
		rate:     r,
		burst:    burst,
		done:     make(chan struct{}),
	}
	go il.cleanup()
	return il
}

func (il *ipLimiter) get(ip string) *rate.Limiter {
	il.mu.Lock()
	defer il.mu.Unlock()

	if entry, ok := il.limiters[ip]; ok {
		entry.lastSeen = time.Now()
		return entry.lim
	}

	lim := rate.NewLimiter(il.rate, il.burst)
	il.limiters[ip] = &limiterEntry{lim: lim, lastSeen: time.Now()}
	return lim
}

// cleanup removes entries not seen for 5 minutes.
func (il *ipLimiter) cleanup() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-il.done:
			return
		case <-ticker.C:
			il.mu.Lock()
			cutoff := time.Now().Add(-5 * time.Minute)
			for ip, entry := range il.limiters {
				if entry.lastSeen.Before(cutoff) {
					delete(il.limiters, ip)
				}
			}
			il.mu.Unlock()
		}
	}
}

// clientIP extracts the real client IP from the request. When
// trustedProxy is set, it checks proxy headers (CF-Connecting-IP,
// X-Real-IP, X-Forwarded-For) before falling back to RemoteAddr.
func clientIP(r *http.Request, trustedProxy bool) string {
	if trustedProxy {
		// Cloudflare's canonical header.
		if ip := r.Header.Get("CF-Connecting-IP"); ip != "" {
			return ip
		}
		if ip := r.Header.Get("X-Real-IP"); ip != "" {
			return ip
		}
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			// First entry is the original client.
			if ip, _, ok := strings.Cut(xff, ","); ok {
				return strings.TrimSpace(ip)
			}
			return strings.TrimSpace(xff)
		}
	}
	ip, _, _ := net.SplitHostPort(r.RemoteAddr)
	if ip == "" {
		ip = r.RemoteAddr
	}
	return ip
}

// RateLimit applies a per-IP token bucket rate limiter.
// When trustedProxy is true, real client IP is extracted from
// proxy headers (CF-Connecting-IP, X-Real-IP, X-Forwarded-For).
func RateLimit(
	rps float64,
	burst int,
	trustedProxy bool,
) func(http.Handler) http.Handler {
	il := newIPLimiter(rate.Limit(rps), burst)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := clientIP(r, trustedProxy)
			if !il.get(ip).Allow() {
				http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
