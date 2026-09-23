import { bench, describe } from "vitest"
import { renderMarkdown, renderMarkdownHighlighted } from "./markdown"

const prose = Array.from(
  { length: 100 },
  (_, i) =>
    `## Section ${i}\n\nText with **emphasis**, a [link](https://example.com), and inline \`code\`.\n`,
).join("\n")

describe("Markdown workloads", () => {
  bench("render 100 prose sections", async () => {
    const result = await renderMarkdown(prose)
    if (result.needsHighlight) await renderMarkdownHighlighted(prose)
  })
})
