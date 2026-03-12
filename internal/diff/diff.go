// Package diff provides a dependency-free line-level diff algorithm.
package diff

import "slices"

// ChangedLines returns 0-based line indices in newLines that were inserted or
// modified relative to oldLines, using the Myers O(ND) algorithm.
func ChangedLines(oldLines, newLines []string) []int {
	n := len(oldLines)
	m := len(newLines)
	if n == 0 {
		// Everything is new.
		out := make([]int, m)
		for i := range m {
			out[i] = i
		}
		return out
	}
	if m == 0 {
		return nil
	}

	// Myers shortest-edit-script. We record the path through the edit
	// graph and then walk it backwards to classify each new line.
	maxD := n + m
	// v stores the furthest-reaching endpoint for each diagonal k.
	// Indexed as v[k + maxD] to allow negative diagonals.
	size := 2*maxD + 1
	v := make([]int, size)
	// trace[d] is a snapshot of v after step d completes.
	trace := make([][]int, 0, maxD+1)

	for d := range maxD + 1 {
		for k := -d; k <= d; k += 2 {
			var x int
			if k == -d || (k != d && v[k-1+maxD] < v[k+1+maxD]) {
				x = v[k+1+maxD] // move down (insert)
			} else {
				x = v[k-1+maxD] + 1 // move right (delete)
			}
			y := x - k
			// Follow diagonal (matching lines).
			for x < n && y < m && oldLines[x] == newLines[y] {
				x++
				y++
			}
			v[k+maxD] = x
			if x >= n && y >= m {
				snap := make([]int, size)
				copy(snap, v)
				trace = append(trace, snap)
				return collectChanged(trace, n, m, maxD)
			}
		}
		snap := make([]int, size)
		copy(snap, v)
		trace = append(trace, snap)
	}
	// Unreachable for valid inputs, but return all-changed as fallback.
	out := make([]int, m)
	for i := range m {
		out[i] = i
	}
	return out
}

// backtrack walks the Myers trace backwards to build the edit script.
// Returns two slices: inserted (new lines not in old) and matches
// (pairs of oldIdx→newIdx for lines in the LCS).
func backtrack(
	trace [][]int,
	n, m, maxD int,
) (inserted []int, matches [][2]int) {
	x, y := n, m

	for d := len(trace) - 1; d > 0; d-- {
		v := trace[d-1]
		k := x - y
		var prevK int
		if k == -d || (k != d && v[k-1+maxD] < v[k+1+maxD]) {
			prevK = k + 1
		} else {
			prevK = k - 1
		}
		prevX := v[prevK+maxD]
		prevY := prevX - prevK

		// Diagonal = matched lines.
		for x > prevX && y > prevY {
			x--
			y--
			matches = append(matches, [2]int{x, y})
		}
		if y > prevY {
			inserted = append(inserted, y-1)
		}
		x = prevX
		y = prevY
	}
	// Remaining diagonal from the d=0 step.
	for x > 0 && y > 0 {
		x--
		y--
		matches = append(matches, [2]int{x, y})
	}
	return inserted, matches
}

// collectChanged runs backtrack then flags reordered matches.
// A matched line is "reordered" if its old index breaks the ascending
// order of old indices in the LCS — meaning it swapped position with
// another matched line, not just shifted due to an insertion/deletion.
func collectChanged(trace [][]int, n, m, maxD int) []int {
	inserted, matches := backtrack(trace, n, m, maxD)
	changed := make([]bool, m)
	for _, idx := range inserted {
		changed[idx] = true
	}

	// matches are collected in reverse order by backtrack; reverse to
	// get them in ascending newIdx order.
	slices.Reverse(matches)

	// Find the longest increasing subsequence (LIS) of oldIdx values
	// within the matches. Lines NOT in the LIS were reordered.
	if len(matches) > 0 {
		oldIdxs := make([]int, len(matches))
		for i, p := range matches {
			oldIdxs[i] = p[0]
		}
		inLIS := longestIncreasingSubseq(oldIdxs)
		for i, p := range matches {
			if !inLIS[i] {
				changed[p[1]] = true
			}
		}
	}

	var out []int
	for i, c := range changed {
		if c {
			out = append(out, i)
		}
	}
	return out
}

// longestIncreasingSubseq returns a bool slice marking which elements
// participate in a longest strictly increasing subsequence.
func longestIncreasingSubseq(a []int) []bool {
	n := len(a)
	if n == 0 {
		return nil
	}
	// tails[i] = smallest tail element of an increasing subseq of length i+1
	tails := make([]int, 0, n)
	// tailIdx[i] = index in a[] of tails[i]
	tailIdx := make([]int, 0, n)
	// prev[i] = index of predecessor of a[i] in the LIS
	prev := make([]int, n)

	for i, v := range a {
		// Binary search for leftmost tail >= v
		lo, hi := 0, len(tails)
		for lo < hi {
			mid := (lo + hi) / 2
			if tails[mid] < v {
				lo = mid + 1
			} else {
				hi = mid
			}
		}
		if lo == len(tails) {
			tails = append(tails, v)
			tailIdx = append(tailIdx, i)
		} else {
			tails[lo] = v
			tailIdx[lo] = i
		}
		if lo > 0 {
			prev[i] = tailIdx[lo-1]
		} else {
			prev[i] = -1
		}
	}

	// Reconstruct which indices are in the LIS.
	inLIS := make([]bool, n)
	k := tailIdx[len(tailIdx)-1]
	for range len(tails) {
		inLIS[k] = true
		k = prev[k]
	}
	return inLIS
}

// IsBinary reports whether data looks like a binary file by scanning the
// first 8 KB for null bytes.
func IsBinary(data []byte) bool {
	return slices.Contains(data[:min(8192, len(data))], 0)
}
