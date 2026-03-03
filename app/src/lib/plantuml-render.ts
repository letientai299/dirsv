import { deflateRaw } from "pako"
import { isRenderedAndUnchanged } from "./content-hash"

const PLANTUML_SERVER = "https://www.plantuml.com/plantuml/svg"

/**
 * Renders all `.plantuml-placeholder` elements inside `container` by
 * encoding the source and loading an `<img>` from the public PlantUML server.
 * Falls back to a `<pre><code>` block if the image fails to load.
 */
export function renderPlantumlBlocks(container: HTMLElement): void {
  const placeholders = container.querySelectorAll<HTMLElement>(
    ".plantuml-placeholder",
  )
  if (placeholders.length === 0) return

  for (const el of placeholders) {
    const source = el.dataset["plantuml"]
    if (!source) continue
    if (isRenderedAndUnchanged(el, source, "plantuml")) continue

    const encoded = encodePlantuml(source)
    const url = `${PLANTUML_SERVER}/${encoded}`

    const img = document.createElement("img")
    img.alt = "PlantUML diagram"

    img.onload = () => {
      el.innerHTML = ""
      el.appendChild(img)
      el.classList.add("plantuml-rendered")
    }

    img.onerror = () => {
      const pre = document.createElement("pre")
      const code = document.createElement("code")
      code.textContent = source
      pre.appendChild(code)
      el.innerHTML = ""
      el.appendChild(pre)
      el.classList.add("plantuml-error")
    }

    img.src = url
  }
}

/** Encode PlantUML source: UTF-8 → deflateRaw → PlantUML custom base64. */
function encodePlantuml(source: string): string {
  const data = deflateRaw(new TextEncoder().encode(source), { level: 9 })
  return plantumlBase64Encode(data)
}

/**
 * PlantUML uses a custom base64 alphabet: `0-9A-Za-z-_`
 * (differs from standard base64's `+/` and `=` padding).
 * Encodes 3 bytes at a time into 4 characters.
 */
function plantumlBase64Encode(data: Uint8Array): string {
  let out = ""
  const len = data.length
  for (let i = 0; i < len; i += 3) {
    const b0 = data[i] ?? 0
    const b1 = i + 1 < len ? (data[i + 1] ?? 0) : 0
    const b2 = i + 2 < len ? (data[i + 2] ?? 0) : 0

    out += encode6bit((b0 >> 2) & 0x3f)
    out += encode6bit(((b0 & 0x3) << 4) | ((b1 >> 4) & 0xf))
    out += encode6bit(((b1 & 0xf) << 2) | ((b2 >> 6) & 0x3))
    out += encode6bit(b2 & 0x3f)
  }
  return out
}

function encode6bit(value: number): string {
  if (value < 10) return String.fromCharCode(48 + value) // 0-9
  value -= 10
  if (value < 26) return String.fromCharCode(65 + value) // A-Z
  value -= 26
  if (value < 26) return String.fromCharCode(97 + value) // a-z
  value -= 26
  if (value === 0) return "-"
  if (value === 1) return "_"
  return "?"
}
