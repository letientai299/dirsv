package diff

import (
	"bytes"
	"strings"
	"testing"
)

func TestChangedLines(t *testing.T) {
	tests := []struct {
		name string
		old  []string
		new  []string
		want []int
	}{
		{
			name: "identity",
			old:  []string{"a", "b", "c"},
			new:  []string{"a", "b", "c"},
			want: nil,
		},
		{
			name: "insert middle",
			old:  []string{"a", "c"},
			new:  []string{"a", "b", "c"},
			want: []int{1},
		},
		{
			name: "insert beginning",
			old:  []string{"b", "c"},
			new:  []string{"a", "b", "c"},
			want: []int{0},
		},
		{
			name: "insert end",
			old:  []string{"a", "b"},
			new:  []string{"a", "b", "c"},
			want: []int{2},
		},
		{
			name: "delete only",
			old:  []string{"a", "b", "c"},
			new:  []string{"a", "c"},
			want: nil,
		},
		{
			name: "replace one line",
			old:  []string{"a", "b", "c"},
			new:  []string{"a", "x", "c"},
			want: []int{1},
		},
		{
			name: "full rewrite",
			old:  []string{"a", "b"},
			new:  []string{"x", "y", "z"},
			want: []int{0, 1, 2},
		},
		{
			name: "empty old",
			old:  nil,
			new:  []string{"a", "b"},
			want: []int{0, 1},
		},
		{
			name: "empty new",
			old:  []string{"a", "b"},
			new:  nil,
			want: nil,
		},
		{
			name: "both empty",
			old:  nil,
			new:  nil,
			want: nil,
		},
		{
			name: "insert does not highlight tail",
			old:  []string{"a", "b", "c", "d"},
			new:  []string{"a", "x", "b", "c", "d"},
			want: []int{1},
		},
		{
			name: "reorder with insert",
			old:  []string{"node_modules", ".ai.dump"},
			new:  []string{".ai.dump", "hello", "node_modules"},
			want: []int{1, 2},
		},
		{
			name: "pure swap",
			old:  []string{"a", "b"},
			new:  []string{"b", "a"},
			want: []int{1},
		},
		{
			name: "reverse three",
			old:  []string{"a", "b", "c"},
			new:  []string{"c", "b", "a"},
			want: []int{1, 2},
		},
		{
			name: "reorder detected via LIS",
			old:  []string{"a", "b", "c", "d"},
			new:  []string{"a", "c", "b", "d"},
			want: []int{2},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ChangedLines(tt.old, tt.new)
			if !intSliceEqual(got, tt.want) {
				t.Errorf("ChangedLines(%v, %v) = %v, want %v",
					tt.old, tt.new, got, tt.want)
			}
		})
	}
}

func TestIsBinary(t *testing.T) {
	tests := []struct {
		name string
		data []byte
		want bool
	}{
		{"text", []byte("hello world\n"), false},
		{"empty", nil, false},
		{"null byte", []byte("hel\x00lo"), true},
		{"null at 8KB boundary", append(make([]byte, 8191), 0), true},
		{
			"null after 8KB",
			append(append(bytes.Repeat([]byte{'a'}, 8192), 'b'), 0),
			false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsBinary(tt.data); got != tt.want {
				t.Errorf("IsBinary(%q) = %v, want %v", tt.data, got, tt.want)
			}
		})
	}
}

func intSliceEqual(a, b []int) bool {
	if len(a) == 0 && len(b) == 0 {
		return true
	}
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func BenchmarkChangedLines(b *testing.B) {
	// Simulate a realistic file edit: 100-line file with one line changed.
	old := make([]string, 100)
	for i := range old {
		old[i] = strings.Repeat("x", 80)
	}
	newLines := make([]string, 100)
	copy(newLines, old)
	newLines[50] = "changed line"

	b.ResetTimer()
	for b.Loop() {
		ChangedLines(old, newLines)
	}
}
