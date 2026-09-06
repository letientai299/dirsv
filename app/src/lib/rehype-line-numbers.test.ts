import { describe, expect, it } from "vitest"
import { renderMarkdown, renderMarkdownHighlighted } from "./markdown"

describe("fenced code line numbers", () => {
  it("parses the language suffix without highlighting", async () => {
    const { html } = await renderMarkdown(
      "```c:line-numbers\nint value = 1;\n```",
    )
    const doc = new DOMParser().parseFromString(html, "text/html")

    expect(doc.querySelector("pre")?.classList).toContain("line-numbers")
    expect(doc.querySelector("code")?.classList).toContain("language-c")
  })

  it("adds line numbers to highlighted code", async () => {
    const { html } = await renderMarkdownHighlighted(
      "```c:line-numbers\nint first = 1;\nint second = 2;\n```",
    )
    const doc = new DOMParser().parseFromString(html, "text/html")

    expect(doc.querySelector("pre")?.classList).toContain("line-numbers")
    expect(doc.querySelectorAll("pre .line")).toHaveLength(2)
  })

  it("highlights selected lines", async () => {
    const { html } = await renderMarkdownHighlighted(
      "```c {2,4-5}\none\ntwo\nthree\nfour\nfive\n```",
    )
    const doc = new DOMParser().parseFromString(html, "text/html")
    const lines = [...doc.querySelectorAll("pre .line")]

    expect(
      lines.map((line, index) =>
        line.classList.contains("highlighted") ? index + 1 : null,
      ),
    ).toEqual([null, 2, null, 4, 5])
  })

  it("combines selected lines with line numbers", async () => {
    const { html } = await renderMarkdownHighlighted(
      "```c:line-numbers {2}\none\ntwo\n```",
    )
    const doc = new DOMParser().parseFromString(html, "text/html")

    expect(doc.querySelector("pre")?.classList).toContain("line-numbers")
    expect(doc.querySelectorAll("pre .line.highlighted")).toHaveLength(1)
    expect(doc.querySelector("pre .line.highlighted")?.textContent).toBe("two")
  })

  it("applies selections after the plain block was rendered", async () => {
    const source = "cache one\ncache two"
    await renderMarkdownHighlighted(`\`\`\`c\n${source}\n\`\`\``)
    const { html } = await renderMarkdownHighlighted(
      `\`\`\`c {2}\n${source}\n\`\`\``,
    )
    const doc = new DOMParser().parseFromString(html, "text/html")

    expect(doc.querySelector("pre .line.highlighted")?.textContent).toBe(
      "cache two",
    )
  })

  it("keeps cached blocks without line numbers unchanged", async () => {
    const source = "int cached = 1;"
    await renderMarkdownHighlighted(`\`\`\`c:line-numbers\n${source}\n\`\`\``)
    const { html } = await renderMarkdownHighlighted(
      `\`\`\`c\n${source}\n\`\`\``,
    )
    const doc = new DOMParser().parseFromString(html, "text/html")

    expect(doc.querySelector("pre")?.classList).not.toContain("line-numbers")
  })
})
