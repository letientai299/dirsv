import { describe, expect, it } from "vitest"
import { parentOf } from "./path"

describe("parentOf", () => {
  const cases: [input: string, expected: string][] = [
    ["/a/b/c", "/a/b/"],
    ["/a/b", "/a/"],
    ["/a", "/"],
    ["/", "/"],
    ["/a/b/c/", "/a/b/"],
    ["/foo.txt", "/"],
    ["/deep/nested/dir/file.ts", "/deep/nested/dir/"],

    // Edge cases
    ["", "/"],
    ["/a/", "/"],
    ["/a%20b/c", "/a%20b/"],

    // File paths — same one-level-up behavior
    ["/a/b/foo.txt", "/a/b/"],
    ["/docs/guide.md", "/docs/"],
    ["/a/b/index.html", "/a/b/"],
    ["/a/b/index.htm", "/a/b/"],
    ["/a/b/INDEX.HTML", "/a/b/"],
    ["/a/index.html", "/a/"],
    ["/index.html", "/"],
    ["/a/b/index.js", "/a/b/"],
    ["/a/b/index.tsx", "/a/b/"],
  ]

  it.each(cases)("parentOf(%j) → %j", (input, expected) => {
    expect(parentOf(input)).toBe(expected)
  })
})
