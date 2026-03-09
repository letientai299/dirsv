import { useEffect, useRef } from "preact/hooks"
import "asciinema-player/dist/bundle/asciinema-player.css"

const NERD_FONT_CSS = "/fonts/firacode-nerd-font.css"
const NERD_FONT_FAMILY = "'FiraCode Nerd Font', monospace"

const NERD_FONT_LINK_ID = "nerd-font-css"

/** Load the Nerd Font stylesheet once, resolve when the font is ready. */
let fontReady: Promise<void> | undefined
function ensureNerdFont(): Promise<void> {
  if (fontReady !== undefined) return fontReady
  // Reuse existing link element (survives HMR module re-evaluation)
  const existing = document.getElementById(NERD_FONT_LINK_ID)
  if (existing) {
    fontReady = document.fonts
      .load(`1em ${NERD_FONT_FAMILY}`)
      .then(() => undefined)
    return fontReady
  }
  fontReady = new Promise<void>((resolve) => {
    const link = document.createElement("link")
    link.id = NERD_FONT_LINK_ID
    link.rel = "stylesheet"
    link.href = NERD_FONT_CSS
    link.onload = () => {
      document.fonts.load(`1em ${NERD_FONT_FAMILY}`).then(() => resolve())
    }
    // Resolve anyway on error so the player still works with fallback font
    link.onerror = () => resolve()
    document.head.appendChild(link)
  })
  return fontReady
}

interface Props {
  content: string
}

export function CastView({ content }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<{ dispose: () => void } | null>(null)

  useEffect(() => {
    let disposed = false
    void Promise.all([import("asciinema-player"), ensureNerdFont()]).then(
      ([mod]) => {
        if (disposed || !containerRef.current) return
        containerRef.current.innerHTML = ""
        playerRef.current = mod.create(
          { data: content },
          containerRef.current,
          {
            fit: "width",
            idleTimeLimit: 2,
            terminalFontFamily: NERD_FONT_FAMILY,
          },
        )
      },
    )
    return () => {
      disposed = true
      playerRef.current?.dispose()
      playerRef.current = null
    }
  }, [content])

  return <div ref={containerRef} class="cast-player" />
}
