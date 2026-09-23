import { bench, describe } from "vitest"
import { collectAllPaths, type JsonValue } from "./json-tree"

const wide = Array.from({ length: 2000 }, (_, id) => ({
  id,
  name: `item-${id}`,
  config: { enabled: true, labels: ["a", "b"] },
}))
let deep: JsonValue = { leaf: true }
for (let i = 0; i < 500; i++) deep = { child: deep }

describe("JSON tree workloads", () => {
  bench("index 16000 JSON paths", () => {
    collectAllPaths(wide)
  })
  bench("index depth-500 JSON", () => {
    collectAllPaths(deep)
  })
})
