import { useEffect, useRef } from "preact/hooks"

interface SSEEvent {
  type: "change" | "create" | "delete" | "rename"
  path: string
}

/**
 * Subscribes to SSE events for the given watch path.
 * Calls onEvent whenever a file system change is detected.
 * Debounces rapid events (e.g., editor write+chmod+rename)
 * into a single callback invocation.
 */
export function useSSE(watchPath: string, onEvent: (ev: SSEEvent) => void) {
  const onEventRef = useRef(onEvent)
  useEffect(() => {
    onEventRef.current = onEvent
  })

  useEffect(() => {
    const url = `/api/events?watch=${encodeURIComponent(watchPath)}`
    const source = new EventSource(url)
    let timer: ReturnType<typeof setTimeout> | undefined
    let latestEvent: SSEEvent | undefined

    source.onmessage = (msg) => {
      try {
        latestEvent = JSON.parse(msg.data)
      } catch {
        return
      }
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (latestEvent) onEventRef.current(latestEvent)
      }, 300)
    }

    return () => {
      clearTimeout(timer)
      source.close()
    }
  }, [watchPath])
}
