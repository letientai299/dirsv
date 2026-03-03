import { useCallback, useRef, useState } from "preact/hooks"
import { browse, type DirEntry } from "./api"
import { useAbortEffect } from "./use-abort-effect"
import { useSSE } from "./use-sse"

/** Fetches sibling entries from `parentDir` and refreshes on SSE changes. */
export function useSiblings(parentDir: string): DirEntry[] {
  const [siblings, setSiblings] = useState<DirEntry[]>([])
  const sseController = useRef<AbortController | null>(null)

  const load = useCallback(
    (signal?: AbortSignal) => {
      browse(parentDir, signal)
        .then((data) => {
          if (data.type === "dir") setSiblings(data.entries)
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === "AbortError") return
          // biome-ignore lint/suspicious/noConsole: intentional diagnostic for network failures
          console.warn("useSiblings: browse failed", err)
        })
    },
    [parentDir],
  )

  useAbortEffect(
    (signal) => {
      // Abort any in-flight SSE-triggered reload when deps change.
      sseController.current?.abort()
      sseController.current = null
      load(signal)
    },
    [load],
  )

  useSSE(parentDir.replace(/^\//, "") || ".", () => {
    sseController.current?.abort()
    const controller = new AbortController()
    sseController.current = controller
    load(controller.signal)
  })

  return siblings
}
