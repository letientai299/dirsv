import { createHighlighter } from "shiki"
import { describe, expect, it } from "vitest"
import { typstGrammar } from "./typst-shiki"

describe("typstGrammar", () => {
  it("resumes highlighting after raw blocks", async () => {
    const highlighter = await createHighlighter({
      langs: [typstGrammar()],
      themes: ["github-light"],
    })
    const source = [
      "````python",
      "``` remains inside the raw block",
      "````",
      "#set text(size: 17pt)",
    ].join("\n")

    const result = highlighter.codeToTokens(source, {
      lang: "typst",
      theme: "github-light",
    })
    const tokens = result.tokens[3] ?? []

    expect(tokens.length).toBeGreaterThan(1)
    expect(tokens.some((token) => token.content.includes("#set"))).toBe(true)
  })
})
