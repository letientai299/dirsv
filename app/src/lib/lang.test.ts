import { describe, expect, it } from "vitest"
import { langFromPath } from "./lang"

describe("langFromPath", () => {
  const cases: [path: string, expected: string][] = [
    ["/src/kernel.cu", "cpp"],
    ["/src/CMakeLists.txt", "cmake"],
    ["/cmake/toolchain.cmake", "cmake"],
    ["/docs/paper.typ", "typst"],
  ]

  it.each(cases)("maps %s to %s", (path, expected) => {
    expect(langFromPath(path)).toBe(expected)
  })
})
