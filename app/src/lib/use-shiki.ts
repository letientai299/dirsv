import { useEffect, useState } from "preact/hooks"

/**
 * Above this size, skip highlighting entirely — tokenization is synchronous
 * and would freeze the UI for too long.
 */
const HARD_LIMIT = 1_000_000

/**
 * Progressively highlight source code with Shiki. Returns `null` while
 * loading (or if the file exceeds the hard limit), letting the caller
 * render a plaintext fallback first.
 */
export function useShiki(content: string, lang: string): string | null {
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    if (content.length > HARD_LIMIT) {
      setHtml(null)
      return
    }

    let cancelled = false
    // Defer to a macrotask so the plaintext fallback paints first. Shiki's
    // tokenization is synchronous inside the resolved promise — without
    // this yield the browser can't render the fallback before the freeze.
    const timer = setTimeout(() => {
      void import("shiki")
        .then(({ codeToHtml }) =>
          codeToHtml(content, {
            lang,
            themes: { light: "github-light", dark: "github-dark" },
            defaultColor: false,
          }),
        )
        .then((result) => {
          if (!cancelled) setHtml(result)
        })
        .catch(() => {
          // Grammar load failed — keep showing the plaintext fallback.
        })
    }, 0)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [content, lang])

  return html
}
