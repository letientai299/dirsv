import { SHIKI_THEME_LIST, SHIKI_THEMES } from "./shiki-config"

const COPY_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>`
const CHECK_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>`
const CODE_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="m11.28 3.22 4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L13.94 8l-3.72-3.72a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215Zm-6.56 0a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L2.06 8l3.72 3.72a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L.47 8.53a.75.75 0 0 1 0-1.06Z"/></svg>`
// Octicon "eye" — used for "View diagram" toggle
const EYE_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 2c1.981 0 3.671.992 4.933 2.078 1.27 1.091 2.187 2.345 2.637 3.023a1.62 1.62 0 0 1 0 1.798c-.45.678-1.367 1.932-2.637 3.023C11.67 13.008 9.981 14 8 14c-1.981 0-3.671-.992-4.933-2.078C1.797 10.831.88 9.577.43 8.899a1.62 1.62 0 0 1 0-1.798c.45-.678 1.367-1.932 2.637-3.023C4.33 2.992 6.019 2 8 2ZM1.679 7.932a.12.12 0 0 0 0 .136c.411.622 1.241 1.75 2.366 2.717C5.176 11.758 6.527 12.5 8 12.5c1.473 0 2.825-.742 3.955-1.715 1.124-.967 1.954-2.096 2.366-2.717a.12.12 0 0 0 0-.136c-.412-.621-1.242-1.75-2.366-2.717C10.824 4.242 9.473 3.5 8 3.5c-1.473 0-2.824.742-3.955 1.715-1.124.967-1.954 2.096-2.366 2.717ZM8 10a2 2 0 1 1-.001-3.999A2 2 0 0 1 8 10Z"/></svg>`
// Octicon "screen-full" — used for "Expand" / focus mode
const EXPAND_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M1.75 10a.75.75 0 0 1 .75.75v2.5c0 .138.112.25.25.25h2.5a.75.75 0 0 1 0 1.5h-2.5A1.75 1.75 0 0 1 1 13.25v-2.5a.75.75 0 0 1 .75-.75Zm12.5 0a.75.75 0 0 1 .75.75v2.5A1.75 1.75 0 0 1 13.25 15h-2.5a.75.75 0 0 1 0-1.5h2.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 .75-.75ZM2.75 1h2.5a.75.75 0 0 1 0 1.5h-2.5a.25.25 0 0 0-.25.25v2.5a.75.75 0 0 1-1.5 0v-2.5C1 1.784 1.784 1 2.75 1Zm10.5 0C14.216 1 15 1.784 15 2.75v2.5a.75.75 0 0 1-1.5 0v-2.5a.25.25 0 0 0-.25-.25h-2.5a.75.75 0 0 1 0-1.5Z"/></svg>`

/**
 * Injects toolbars into `.figure-container` elements and makes images
 * tab-focusable. Idempotent — skips containers that already have a toolbar.
 */
export function injectFigureToolbars(container: HTMLElement): void {
  for (const fig of container.querySelectorAll<HTMLElement>(
    ".figure-container",
  )) {
    if (fig.querySelector(".figure-toolbar")) continue

    const isDiagram = !!fig.querySelector(
      ".diagram-rendered, .diagram-placeholder",
    )
    const hasCode = !!fig.querySelector("pre > code")

    // Remove tabindex from inner <pre> (Shiki adds tabindex="0") so the
    // wrapper is the only tab stop — avoids a double focus outline.
    const pre = fig.querySelector("pre")
    if (pre?.hasAttribute("tabindex")) pre.removeAttribute("tabindex")

    if (isDiagram) {
      injectDiagramToolbar(fig)
    } else if (hasCode) {
      injectCodeToolbar(fig)
    }
  }

  // Make images tab-focusable.
  for (const img of container.querySelectorAll<HTMLImageElement>(
    "img:not([tabindex])",
  )) {
    img.tabIndex = 0
  }
}

function createToolbar(): HTMLDivElement {
  const toolbar = document.createElement("div")
  toolbar.className = "figure-toolbar"
  return toolbar
}

function createButton(label: string, icon: string): HTMLButtonElement {
  const btn = document.createElement("button")
  btn.type = "button"
  btn.className = "figure-btn"
  btn.setAttribute("aria-label", label)
  btn.innerHTML = icon
  return btn
}

function flashCopied(btn: HTMLButtonElement): void {
  btn.innerHTML = CHECK_ICON
  btn.classList.add("figure-btn--copied")
  setTimeout(() => {
    btn.innerHTML = COPY_ICON
    btn.classList.remove("figure-btn--copied")
  }, 2000)
}

function injectCodeToolbar(fig: HTMLElement): void {
  const toolbar = createToolbar()
  const copyBtn = createButton("Copy code", COPY_ICON)

  copyBtn.addEventListener("click", () => {
    const code = fig.querySelector("code")
    if (!code) return
    void navigator.clipboard.writeText(code.textContent ?? "").then(() => {
      flashCopied(copyBtn)
    })
  })

  toolbar.appendChild(copyBtn)
  fig.appendChild(toolbar)
}

function injectDiagramToolbar(fig: HTMLElement): void {
  const toolbar = createToolbar()
  const source = readPlaceholderSource(fig)
  const lang = fig.dataset["figureLang"] ?? ""

  const viewSrcBtn = createButton("View source", CODE_ICON)
  const copyBtn = createButton("Copy code", COPY_ICON)

  viewSrcBtn.addEventListener("click", () => {
    const isSource = fig.classList.toggle("figure-container--source")
    viewSrcBtn.innerHTML = isSource ? EYE_ICON : CODE_ICON
    viewSrcBtn.setAttribute(
      "aria-label",
      isSource ? "View diagram" : "View source",
    )

    if (isSource && !fig.querySelector(".figure-source")) {
      const pre = document.createElement("pre")
      pre.className = "figure-source"
      const code = document.createElement("code")
      code.textContent = source
      pre.appendChild(code)
      fig.appendChild(pre)

      // Attempt Shiki highlighting asynchronously.
      if (lang) {
        void highlightSource(pre, code, source, lang)
      }
    }
  })

  copyBtn.addEventListener("click", () => {
    const isSource = fig.classList.contains("figure-container--source")
    const text = isSource
      ? source
      : (fig.querySelector("code")?.textContent ?? source)
    void navigator.clipboard.writeText(text).then(() => {
      flashCopied(copyBtn)
    })
  })

  const expandBtn = createButton("Expand diagram", EXPAND_ICON)
  expandBtn.addEventListener("click", () => {
    const diagramEl = fig.querySelector(".diagram-rendered")
    fig.dispatchEvent(
      new CustomEvent("focus-expand", {
        bubbles: true,
        detail: { element: diagramEl ?? fig },
      }),
    )
  })

  toolbar.appendChild(viewSrcBtn)
  toolbar.appendChild(copyBtn)
  toolbar.appendChild(expandBtn)
  fig.appendChild(toolbar)
}

/** Read diagram source from the placeholder's data attr (e.g. data-mermaid). */
function readPlaceholderSource(fig: HTMLElement): string {
  const placeholder = fig.querySelector<HTMLElement>(".diagram-placeholder")
  if (!placeholder) return ""
  const lang = fig.dataset["figureLang"] ?? ""
  return placeholder.getAttribute(`data-${lang}`) ?? ""
}

async function highlightSource(
  pre: HTMLPreElement,
  code: HTMLElement,
  source: string,
  lang: string,
): Promise<void> {
  try {
    const { getSingletonHighlighter } = await import("shiki")
    const highlighter = await getSingletonHighlighter({
      themes: [...SHIKI_THEME_LIST],
      langs: [lang],
    })
    const html = highlighter.codeToHtml(source, {
      lang,
      themes: { light: SHIKI_THEMES.light, dark: SHIKI_THEMES.dark },
      defaultColor: false,
    })
    // codeToHtml returns <pre class="shiki ..."><code>...</code></pre>.
    // Extract the inner code content and apply shiki class to our pre.
    const tmp = document.createElement("div")
    tmp.innerHTML = html
    const shikiPre = tmp.querySelector("pre")
    const shikiCode = shikiPre?.querySelector("code")
    if (shikiCode) {
      // TRUSTED: Shiki is a build-time dependency producing only syntax spans.
      code.innerHTML = shikiCode.innerHTML
      pre.classList.add("shiki")
      // Copy Shiki's inline style vars for theme support.
      if (shikiPre?.style.cssText) {
        pre.style.cssText = shikiPre.style.cssText
      }
    }
  } catch {
    // Shiki not available or lang not supported — keep plain text.
  }
}
