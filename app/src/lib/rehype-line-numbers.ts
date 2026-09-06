import type { ShikiTransformer } from "@shikijs/types"
import type { Element, Root } from "hast"
import { visit } from "unist-util-visit"
import { getClassList } from "./hast-utils"

const LINE_NUMBERS_SUFFIX = ":line-numbers"
const LINE_NUMBERS_META = /(?:^|\s)line-numbers(?:\s|$)/
const LINE_RANGE_META = /(?:^|\s)\{([^{}]+)\}(?=\s|$)/
const META_PROPERTY = "dataCodeMeta"

function isSelected(meta: string, line: number): boolean {
  const rangeList = meta.match(LINE_RANGE_META)?.[1]
  if (!rangeList) return false

  return rangeList.split(",").some((item) => {
    const range = item.trim().match(/^(\d+)(?:-(\d+))?$/)
    if (!range) return false

    const start = Number(range[1])
    const end = Number(range[2] ?? range[1])
    return start > 0 && start <= line && line <= end
  })
}

/** Preserve fenced-code metadata across rehype-sanitize. */
export function rehypeStashCodeMeta() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "code" || typeof node.data?.meta !== "string") return
      node.properties[META_PROPERTY] = node.data.meta
    })
  }
}

/** Parse line-number suffixes on fenced code. */
export function rehypeLineNumbers() {
  return (tree: Root) => {
    visit(tree, "element", applyFenceMeta)
  }
}

function applyFenceMeta(node: Element): void {
  if (node.tagName !== "pre") return

  const code = node.children[0]
  if (code?.type !== "element" || code.tagName !== "code") return

  restoreCodeMeta(code)
  enableLineNumbers(node, code)
}

function restoreCodeMeta(code: Element): void {
  const rawMeta = code.properties[META_PROPERTY]
  delete code.properties[META_PROPERTY]
  if (typeof rawMeta !== "string") return

  code.data ??= {}
  code.data.meta = rawMeta
}

function enableLineNumbers(pre: Element, code: Element): void {
  const classes = getClassList(code)
  const index = classes.findIndex(
    (name) =>
      name.startsWith("language-") && name.endsWith(LINE_NUMBERS_SUFFIX),
  )
  const langClass = classes[index]
  if (index < 0 || !langClass) return

  classes[index] = langClass.slice(0, -LINE_NUMBERS_SUFFIX.length)
  pre.properties["className"] = [...getClassList(pre), "line-numbers"]
  code.data ??= {}
  const meta = typeof code.data.meta === "string" ? code.data.meta : ""
  code.data.meta = [meta, "line-numbers"].filter(Boolean).join(" ")
}

export const codeMetaTransformer: ShikiTransformer = {
  name: "dirsv:code-meta",
  pre(node) {
    const meta = this.options.meta as { __raw?: string } | undefined
    if (meta?.__raw && LINE_NUMBERS_META.test(meta.__raw)) {
      this.addClassToHast(node, "line-numbers")
    }
  },
  line(node, line) {
    const meta = this.options.meta as { __raw?: string } | undefined
    if (meta?.__raw && isSelected(meta.__raw, line)) {
      this.addClassToHast(node, "highlighted")
    }
  },
}
