const COPY_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>`
const CHECK_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>`

/**
 * Injects a copy button into every `pre.shiki` block inside `container`.
 * Idempotent — skips blocks that already have a button.
 */
export function injectCopyButtons(container: HTMLElement): void {
  const blocks = container.querySelectorAll<HTMLPreElement>("pre.shiki")
  for (const pre of blocks) {
    if (pre.querySelector(".code-copy")) continue

    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "code-copy"
    btn.setAttribute("aria-label", "Copy code")
    btn.innerHTML = COPY_ICON

    btn.addEventListener("click", () => {
      const code = pre.querySelector("code")
      if (!code) return

      void navigator.clipboard.writeText(code.textContent ?? "").then(() => {
        btn.innerHTML = CHECK_ICON
        btn.classList.add("code-copy--copied")
        setTimeout(() => {
          btn.innerHTML = COPY_ICON
          btn.classList.remove("code-copy--copied")
        }, 2000)
      })
    })

    pre.appendChild(btn)
  }
}
