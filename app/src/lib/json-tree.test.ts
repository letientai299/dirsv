import { expect, it } from "vitest"
import { collectAllPaths, type JsonValue } from "./json-tree"

it("collects paths in depth-first order with prefixes", () => {
  expect([
    ...collectAllPaths({ a: [null, { b: true }], c: {} }, "root"),
  ]).toEqual(["root.a", "root.a.0", "root.a.1", "root.a.1.b", "root.c"])
  expect([...collectAllPaths(null)]).toEqual([])
  expect([...collectAllPaths({ "": 1 })]).toEqual([""])
})

it("handles deeply nested input without recursive calls", () => {
  let value: JsonValue = null
  for (let i = 0; i < 2000; i++) value = { a: value }
  expect(collectAllPaths(value).size).toBe(2000)
})
