import rehypeStringify from "rehype-stringify"
import remarkDirective from "remark-directive"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { unified } from "unified"
import { describe, expect, it } from "vitest"
import { normalizeDirectives } from "./markdown"
import { remarkDirectivesHandler } from "./remark-directives"

/** Minimal pipeline: parse → directive → handler → rehype → HTML. */
function process(md: string): Promise<string> {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkDirective)
    .use(remarkDirectivesHandler)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify)
    .process(normalizeDirectives(md))
    .then((r) => String(r))
}

describe("remarkDirectivesHandler", () => {
  describe("diagram directives", () => {
    const cases = [
      { lang: "mermaid", body: "graph TD\n  A --> B" },
      { lang: "d2", body: "shape: sequence_diagram" },
      { lang: "graphviz", body: "digraph { A -> B }" },
      { lang: "dot", body: "digraph { X -> Y }" },
      { lang: "plantuml", body: "@startuml\nBob -> Alice\n@enduml" },
      { lang: "dbml", body: "Table users {\n  id integer\n}" },
      { lang: "typst", body: "#set page(width: 10cm)\nHello" },
    ]

    for (const { lang, body } of cases) {
      it(`:::${lang} produces <pre><code class="language-${lang}">`, async () => {
        const md = `:::${lang}\n${body}\n:::`
        const html = await process(md)
        expect(html).toContain(`class="language-${lang}"`)
        expect(html).toContain("<pre>")
        expect(html).toContain("<code")
      })
    }

    it("preserves raw body with blank lines", async () => {
      const md = ":::mermaid\ngraph TD\n\n  A --> B\n:::"
      const html = await process(md)
      expect(html).toContain("graph TD\n\n  A --> B")
    })

    it("works with extra colons (::::)", async () => {
      const md = "::::mermaid\ngraph TD\n  A --> B\n::::"
      const html = await process(md)
      expect(html).toContain(`class="language-mermaid"`)
    })
  })

  describe("admonition directives", () => {
    const types = ["note", "tip", "warning", "caution", "important"]

    for (const type of types) {
      it(`:::${type} produces markdown-alert-${type}`, async () => {
        const md = `:::${type}\nSome content.\n:::`
        const html = await process(md)
        expect(html).toContain(`markdown-alert markdown-alert-${type}`)
        expect(html).toContain("markdown-alert-title")
        expect(html).toContain(type.charAt(0).toUpperCase() + type.slice(1))
        expect(html).toContain("Some content.")
      })
    }

    it("parses markdown inside admonitions", async () => {
      const md = ":::note\nHello **bold** world.\n:::"
      const html = await process(md)
      expect(html).toContain("<strong>bold</strong>")
    })
  })

  describe("unknown directives", () => {
    it("container → div with directive class", async () => {
      const md = ":::custom\nContent here.\n:::"
      const html = await process(md)
      expect(html).toContain("directive directive-custom")
      expect(html).toContain("Content here.")
    })

    it("leaf → div with directive class", async () => {
      const md = "::leaf-thing"
      const html = await process(md)
      expect(html).toContain("directive directive-leaf-thing")
    })

    it("text → span with directive class", async () => {
      const md = "Hello :abbr[HTML] world"
      const html = await process(md)
      expect(html).toContain("directive directive-abbr")
      expect(html).toContain("<span")
    })
  })

  describe("ADO-style space after colons", () => {
    it("::: mermaid (with space) produces code block", async () => {
      const md = "::: mermaid\ngraph TD\n  A --> B\n:::"
      const html = await process(md)
      expect(html).toContain(`class="language-mermaid"`)
      expect(html).toContain("<pre>")
    })

    it("::: note (with space) produces admonition", async () => {
      const md = "::: note\nSome text.\n:::"
      const html = await process(md)
      expect(html).toContain("markdown-alert markdown-alert-note")
    })
  })

  describe("backtick fences still work", () => {
    it("```mermaid produces code block", async () => {
      const md = "```mermaid\ngraph TD\n  A --> B\n```"
      const html = await process(md)
      expect(html).toContain(`class="language-mermaid"`)
      expect(html).toContain("<pre>")
    })
  })
})
