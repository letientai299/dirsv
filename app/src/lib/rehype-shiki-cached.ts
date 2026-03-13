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

/** Stable content key for a code block. Strips the trailing newline that
 *  remark-rehype appends but Shiki's `stripEndNewline` removes, so keys
 *  match across the pre→Shiki→post pipeline. */
function cacheKey(lang: string, source: string): string {
  return simpleHash(`${lang}\0${source.replace(/\n$/, "")}`)
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

  return {
    lang: langClass.slice("language-".length),
    source: collectText(code.children),
  }
}

/** Source lines queued by the pre-pass for uncached blocks. Shiki replaces
 *  `<pre>` nodes entirely (wrapped in a Root fragment that changes parent/index)
 *  and doesn't set `dataLanguage`, so we can't key by content or position.
 *  Instead we rely on visit order: both passes traverse depth-first, so the
 *  Nth uncached block in the pre-pass becomes the Nth Shiki block in the
 *  post-pass. The queue is reset at the start of each render. */
let pendingSourceLines: (number | null)[] = []

/** Try to replace a code block with a cached Shiki clone. Returns true if
 *  replaced, false if uncached (Shiki will process it). */
function tryReplaceWithCached(
  node: Element,
  info: { lang: string; source: string },
  index: number,
  parent: { children: unknown[] },
): boolean {
  const cached = cache.get(cacheKey(info.lang, info.source))
  if (!cached) return false

  const clone = cloneElement(cached)
  clone.properties["dataShikiCached"] = "true"
  if (node.properties["dataSourceLine"] != null) {
    clone.properties["dataSourceLine"] = node.properties["dataSourceLine"]
  }
  parent.children[index] = clone
  return true
}

/** Pre-pass: replace code blocks with cached Shiki output where available.
 *  For uncached blocks, queue their source line for the post-pass. */
export function rehypeShikiCachedPre() {
  return (tree: Root) => {
    pendingSourceLines = []
    visit(tree, "element", (node: Element, index, parent) => {
      if (!parent || index === undefined || index === null) return
      const info = extractCodeInfo(node)
      if (!info) return

      if (tryReplaceWithCached(node, info, index, parent)) return

      // Uncached: Shiki will replace this node. Queue the source line.
      const line = node.properties["dataSourceLine"]
      pendingSourceLines.push(line != null ? Number(line) : null)
    })
  }
}

/** Cache a single newly-highlighted Shiki block if it's valid and uncached.
 *  Caller must ensure `node.tagName === "pre"`. */
function cacheNewBlock(node: Element): void {
  if (!getClassList(node).includes("shiki")) return
  if (node.properties["dataShikiCached"]) return

  const lang = node.properties["dataLanguage"] as string | undefined
  if (!lang) return

  const code = node.children[0]
  if (!code || code.type !== "element" || code.tagName !== "code") return

  const source = collectTextDeep(code.children)
  cache.set(cacheKey(lang, source), cloneElement(node))
}

/** True when a `<pre>` was freshly processed by Shiki (not from cache). */
function isNewShikiBlock(node: Element): boolean {
  return (
    node.properties["dataSourceLine"] == null &&
    getClassList(node).includes("shiki") &&
    !node.properties["dataShikiCached"]
  )
}

/** Post-pass: store newly highlighted blocks and restore source lines.
 *  Both operations only apply to <pre> nodes — the tagName check is shared. */
export function rehypeShikiCachedPost() {
  return (tree: Root) => {
    let queueIdx = 0
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "pre") return
      cacheNewBlock(node)
      if (!isNewShikiBlock(node)) return

      const line =
        node.position?.start?.line ?? pendingSourceLines[queueIdx] ?? null
      if (line != null) node.properties["dataSourceLine"] = line
      queueIdx++
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
