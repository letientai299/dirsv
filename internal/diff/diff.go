// Package diff computes bounded line diffs.
package diff

import "slices"

const (
	maxTraceInts = 1 << 20
	maxDiffWork  = 2 << 20
)

// ChangedLines returns insertions; exhausted budgets omit highlights.
func ChangedLines(oldLines, newLines []string) []int {
	offset := 0
	for offset < min(len(oldLines), len(newLines)) && oldLines[offset] == newLines[offset] {
		offset++
	}
	oldLines, newLines = oldLines[offset:], newLines[offset:]
	for len(oldLines) > 0 && len(newLines) > 0 && oldLines[len(oldLines)-1] == newLines[len(newLines)-1] {
		oldLines, newLines = oldLines[:len(oldLines)-1], newLines[:len(newLines)-1]
	}
	n, m := len(oldLines), len(newLines)
	if m == 0 || n+m > maxTraceInts/4 {
		return nil
	}
	if n == 0 {
		out := make([]int, m)
		for i := range m {
			out[i] = i + offset
		}
		return out
	}
	maxD := n + m
	size := 2*maxD + 1
	v := make([]int, size)
	trace := make([][]int, 0, min(maxD+1, maxTraceInts/size))
	work := 0
	for d := range maxD + 1 {
		if (len(trace)+2)*size > maxTraceInts {
			return nil
		}
		for k := -d; k <= d; k += 2 {
			work++
			if work > maxDiffWork {
				return nil
			}
			var x int
			if k == -d || (k != d && v[k-1+maxD] < v[k+1+maxD]) {
				x = v[k+1+maxD]
			} else {
				x = v[k-1+maxD] + 1
			}
			y := x - k
			for x < n && y < m && oldLines[x] == newLines[y] {
				x++
				y++
				work++
				if work > maxDiffWork {
					return nil
				}
			}
			v[k+maxD] = x
			if x >= n && y >= m {
				trace = append(trace, v)
				return backtrack(trace, n, m, maxD, offset)
			}
		}
		trace = append(trace, slices.Clone(v))
	}
	return nil
}

func backtrack(trace [][]int, n, m, maxD, offset int) []int {
	x, y := n, m
	var inserted []int
	for d := len(trace) - 1; d > 0; d-- {
		v := trace[d-1]
		k := x - y
		prevK := k - 1
		if k == -d || (k != d && v[k-1+maxD] < v[k+1+maxD]) {
			prevK = k + 1
		}
		prevX := v[prevK+maxD]
		prevY := prevX - prevK
		for x > prevX && y > prevY {
			x--
			y--
		}
		if y > prevY {
			inserted = append(inserted, y-1+offset)
		}
		x, y = prevX, prevY
	}
	slices.Reverse(inserted)
	return inserted
}

// IsBinary checks the initial bytes for nulls.
func IsBinary(
	data []byte,
) bool {
	return slices.Contains(data[:min(8192, len(data))], 0)
}
