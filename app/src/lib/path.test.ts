import { describe, expect, it } from "vitest"
import { parentOf, parentOfFile } from "./path"

describe("parentOf", () => {
  const cases: [input: string, expected: string][] = [
    ["/a/b/c", "/a/b"],
    ["/a/b", "/a"],
    ["/a", "/"],
    ["/", "/"],
    ["/a/b/c/", "/a/b"],
    ["/foo.txt", "/"],
    ["/deep/nested/dir/file.ts", "/deep/nested/dir"],

    // Edge cases
    ["", "/"],
    ["/a/", "/"],
    ["/a%20b/c", "/a%20b"],
  ]

  it.each(cases)("parentOf(%j) → %j", (input, expected) => {
    expect(parentOf(input)).toBe(expected)
  })
})

describe("parentOfFile", () => {
  const cases: [input: string, expected: string][] = [
    // Regular files go up one level
    ["/a/b/foo.txt", "/a/b"],
    ["/foo.txt", "/"],
    ["/docs/guide.md", "/docs"],

    // index.html goes up two levels to avoid re-triggering the index
    ["/a/b/index.html", "/a"],
    ["/a/b/index.htm", "/a"],
    ["/a/b/INDEX.HTML", "/a"],
    ["/a/index.html", "/"],
    ["/index.html", "/"],

    // Files named "index" without .html extension — one level only
    ["/a/b/index.js", "/a/b"],
    ["/a/b/index.tsx", "/a/b"],
  ]

  it.each(cases)("parentOfFile(%j) → %j", (input, expected) => {
    expect(parentOfFile(input)).toBe(expected)
  })
})
