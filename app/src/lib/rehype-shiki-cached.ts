import type { Element, ElementContent, Root } from "hast"
import { visit } from "unist-util-visit"
import { simpleHash } from "./content-hash"

/**
 * Module-level cache: `Map<hash, Element>` where hash = simpleHash(lang + source).
 * Persists across `processor.process()` calls since the processor is a singleton.
 */
const cache = new Map<string, Element>()

/**
 * Rehype plugin pair that caches Shiki-highlighted code blocks:
 *
 *   .use(rehypeShikiCachedPre)    // swap cached nodes in
 *   .use(rehypeShiki, { ... })    // Shiki only processes uncached blocks
 *   .use(rehypeShikiCachedPost)   // store newly highlighted blocks
 */

function cacheKey(lang: string, source: string): string {
  return simpleHash(`${lang}\0${source}`)
}

/** Deep-clone a HAST element for reuse. */
function cloneElement(el: Element): Element {
  return {
    type: "element",
    tagName: el.tagName,
    properties: { ...el.properties },
    children: el.children.map((c) =>
      c.type === "element" ? cloneElement(c) : { ...c },
    ) as ElementContent[],
  }
}

/** Extract (lang, source) from a `<pre><code class="language-X">` node. */
function extractCodeInfo(
  node: Element,
): { lang: string; source: string } | null {
  if (node.tagName !== "pre") return null
  const code = node.children[0]
  if (!code || code.type !== "element" || code.tagName !== "code") return null

  const classes = getClassList(code)
  const langClass = classes.find((c) => c.startsWith("language-"))
  if (!langClass) return null

  return { lang: langClass.slice("language-".length), source: collectText(code.children) }
}

/** Pre-pass: replace code blocks with cached Shiki output where available. */
export function rehypeShikiCachedPre() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (!parent || index === undefined || index === null) return
      const info = extractCodeInfo(node)
      if (!info) return

      const key = cacheKey(info.lang, info.source)
      const cached = cache.get(key)
      if (!cached) return

      const clone = cloneElement(cached)
      clone.properties["dataShikiCached"] = "true"
      parent.children[index] = clone
    })
  }
}

/** Post-pass: store newly highlighted blocks in cache. */
export function rehypeShikiCachedPost() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "pre") return
      if (!getClassList(node).includes("shiki")) return
      if (node.properties["dataShikiCached"]) return

      const lang = node.properties["dataLanguage"] as string | undefined
      if (!lang) return

      const code = node.children[0]
      if (!code || code.type !== "element" || code.tagName !== "code") return

      const source = collectTextDeep(code.children)
      cache.set(cacheKey(lang, source), cloneElement(node))
    })
  }
}

function getClassList(node: Element): string[] {
  const val = node.properties?.["className"]
  return Array.isArray(val) ? (val as string[]) : []
}

function collectText(children: ElementContent[]): string {
  let out = ""
  for (const child of children) {
    if (child.type === "text") out += child.value
  }
  return out
}

/** Recursively collect text from nested elements (Shiki wraps in spans). */
function collectTextDeep(children: ElementContent[]): string {
  let out = ""
  for (const child of children) {
    if (child.type === "text") out += child.value
    else if (child.type === "element") out += collectTextDeep(child.children)
  }
  return out
}
