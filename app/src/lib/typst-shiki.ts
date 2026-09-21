import typst from "@shikijs/langs/typst"
import type { LanguageRegistration } from "@shikijs/types"
import { createHighlighter } from "shiki"
import { SHIKI_THEME_LIST, SHIKI_THEMES } from "./shiki-config"

function patchRaw(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(patchRaw)
  if (value === null || typeof value !== "object") return value

  const record = value as Record<string, unknown>
  if (
    record["name"] === "markup.raw.block.typst" &&
    record["end"] === "\\x00"
  ) {
    return { ...record, begin: "(`{3,})", end: "\\1" }
  }

  return Object.fromEntries(
    Object.entries(record).map(([key, item]) => [key, patchRaw(item)]),
  )
}

export function typstGrammar(): LanguageRegistration {
  const grammar = typst[0]
  if (!grammar) throw new Error("Typst grammar unavailable")
  return patchRaw(grammar) as LanguageRegistration
}

let highlighter: ReturnType<typeof createHighlighter> | undefined

export async function highlightTypst(source: string): Promise<string> {
  highlighter ??= createHighlighter({
    langs: [typstGrammar()],
    themes: [...SHIKI_THEME_LIST],
  })

  return (await highlighter).codeToHtml(source, {
    lang: "typst",
    themes: { light: SHIKI_THEMES.light, dark: SHIKI_THEMES.dark },
    defaultColor: false,
  })
}
