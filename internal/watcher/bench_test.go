package watcher

import (
	"encoding/json"
	"sync"
	"testing"
)

// BenchmarkMatchesClientNoFilter benchmarks prefix matching with no filters.
func BenchmarkMatchesClientNoFilter(b *testing.B) {
	c := &wsClient{}

	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		matchesClient(c, "src/components/App.vue")
	}
}

// BenchmarkMatchesClientFewPrefixes benchmarks prefix matching with 3 prefixes.
func BenchmarkMatchesClientFewPrefixes(b *testing.B) {
	c := &wsClient{
		prefixes: []string{"src/components", "src/views", "public"},
	}

	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		matchesClient(c, "src/components/App.vue")
	}
}

// BenchmarkMatchesClientManyPrefixes benchmarks prefix matching with 20 prefixes.
func BenchmarkMatchesClientManyPrefixes(b *testing.B) {
	prefixes := make([]string, 20)
	for i := range prefixes {
		prefixes[i] = "some/deep/path/number/" + string(rune('a'+i))
	}
	c := &wsClient{prefixes: prefixes}

	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		// Worst case: no match, must check all prefixes.
		matchesClient(c, "totally/different/path/file.txt")
	}
}

// BenchmarkBroadcastFewClients benchmarks broadcasting to 5 clients.
func BenchmarkBroadcastFewClients(b *testing.B) {
	benchBroadcast(b, 5)
}

// BenchmarkBroadcastManyClients benchmarks broadcasting to 100 clients.
func BenchmarkBroadcastManyClients(b *testing.B) {
	benchBroadcast(b, 100)
}

func benchBroadcast(b *testing.B, nClients int) {
	b.Helper()

	w := &Watcher{
		clients: make(map[*wsClient]struct{}, nClients),
		mu:      sync.RWMutex{},
	}

	for range nClients {
		c := &wsClient{
			ch:       make(chan []byte, 16),
			prefixes: []string{"src"},
		}
		w.clients[c] = struct{}{}
	}

	pending := map[string]Event{
		"src/main.go":  {Type: "change", Path: "src/main.go"},
		"src/util.go":  {Type: "change", Path: "src/util.go"},
		"docs/read.md": {Type: "change", Path: "docs/read.md"},
	}

	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		// Drain channels before each iteration.
		for c := range w.clients {
			for len(c.ch) > 0 {
				<-c.ch
			}
		}
		w.broadcast(pending)
	}
}

// BenchmarkEventMarshal benchmarks JSON marshalling of a single event.
func BenchmarkEventMarshal(b *testing.B) {
	ev := Event{Type: "change", Path: "src/components/App.vue"}

	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		data, err := json.Marshal(ev)
		if err != nil {
			b.Fatal(err)
		}
		_ = data
	}
}

// BenchmarkWatchMsgUnmarshal benchmarks JSON unmarshalling of a watch message.
func BenchmarkWatchMsgUnmarshal(b *testing.B) {
	data := []byte(`{"watch":["src/components","src/views","public/assets"]}`)

	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		var msg watchMsg
		if err := json.Unmarshal(data, &msg); err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkCleanWatchPath benchmarks path normalization.
func BenchmarkCleanWatchPath(b *testing.B) {
	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		cleanWatchPath("../../../etc/passwd")
		cleanWatchPath("src/components/")
		cleanWatchPath("./src/../src/views")
	}
}
