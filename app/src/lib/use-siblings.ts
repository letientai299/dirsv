import { useCallback, useEffect, useRef, useState } from "preact/hooks"
import { browse, type DirEntry } from "./api"
import { useAbortEffect } from "./use-abort-effect"
import { isFileEvent, useWS } from "./use-ws"

/** Fetches sibling entries from `parentDir` and refreshes on WS changes. */
export function useSiblings(parentDir: string): DirEntry[] {
  const [siblings, setSiblings] = useState<DirEntry[]>([])
  const reloadController = useRef<AbortController | null>(null)
  const generation = useRef(0)

  const load = useCallback(
    (signal?: AbortSignal) => {
      const request = ++generation.current
      browse(parentDir, signal)
        .then((data) => {
          if (
            request === generation.current &&
            !signal?.aborted &&
            data.type === "dir"
          )
            setSiblings(data.entries)
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
      // Abort any in-flight WS-triggered reload when deps change.
      reloadController.current?.abort()
      reloadController.current = null
      load(signal)
    },
    [load],
  )

  useEffect(() => () => reloadController.current?.abort(), [])

  useWS(parentDir, (ev) => {
    if (!isFileEvent(ev)) return
    reloadController.current?.abort()
    const controller = new AbortController()
    reloadController.current = controller
    load(controller.signal)
  })

  return siblings
}
