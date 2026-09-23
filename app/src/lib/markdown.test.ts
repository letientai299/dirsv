import { describe, expect, it } from "vitest"
import {
  normalizeDirectives,
  renderMarkdown,
  renderMarkdownHighlighted,
  renderMdx,
  renderMdxHighlighted,
} from "./markdown"

describe("markdown source fidelity", () => {
  it.each([
    ["# Heading\n\nInline `code`", false],
    ["```mermaid\ngraph TD; A-->B\n```", false],
    ["```js\nconst value = 1\n```", true],
    ["    indented code", true],
    ["<pre><code>raw code</code></pre>", true],
  ])("detects remaining code in %s", async (source, expected) => {
    expect((await renderMarkdown(source)).needsHighlight).toBe(expected)
  })

  it("detects MDX code and isolates concurrent metadata", async () => {
    const results = await Promise.all([
      renderMdx("# Prose"),
      renderMdx("<Widget />"),
      renderMarkdown("# Prose"),
    ])
    expect(results.map((result) => result.needsHighlight)).toEqual([
      false,
      true,
      false,
    ])
  })
  it("preserves fenced and indented examples", () => {
    for (const source of [
      "```md\n::: note\n> [!WARNING] text\n```",
      "~~~md\n::: note\n~~~",
      "    ::: note\n    > [!WARNING] text",
      "> ```md\n> ::: note\n> ```",
    ])
      expect(normalizeDirectives(source)).toBe(source)
  })

  it("retains alert text and original heading lines", async () => {
    const result = await renderMarkdown(
      "> [!WARNING] Keep `this` text\n\n# Heading\n\n::: note\nBody\n:::",
    )
    const doc = new DOMParser().parseFromString(result.html, "text/html")
    expect(doc.querySelector(".markdown-alert-warning")?.textContent).toContain(
      "Keep this text",
    )
    expect(doc.querySelector("h1")?.getAttribute("data-source-line")).toBe("3")
    expect(doc.querySelector(".markdown-alert-note")?.textContent).toContain(
      "Body",
    )
  })

  it("keeps per-render headings isolated across formats", async () => {
    const renderers = [
      renderMarkdown,
      renderMarkdownHighlighted,
      renderMdx,
      renderMdxHighlighted,
    ]
    const results = await Promise.all(
      renderers.map((render, i) => render(`# Title ${i}\n\nText`)),
    )
    results.forEach((result, i) => {
      expect(result.headings).toEqual([
        { depth: 1, text: `Title ${i}`, id: `title-${i}` },
      ])
    })
  })
})
