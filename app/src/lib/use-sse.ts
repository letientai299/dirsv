import { useEffect, useRef } from "preact/hooks"

interface SSEEvent {
  type: "change" | "create" | "delete" | "rename"
  path: string
}

/**
 * Subscribes to SSE events for the given watch path.
 * Calls onEvent whenever a file system change is detected.
 */
export function useSSE(watchPath: string, onEvent: (ev: SSEEvent) => void) {
  const onEventRef = useRef(onEvent)
  useEffect(() => {
    onEventRef.current = onEvent
  })

  useEffect(() => {
    const url = `/api/events?watch=${encodeURIComponent(watchPath)}`
    const source = new EventSource(url)

    source.onmessage = (msg) => {
      try {
        const ev: SSEEvent = JSON.parse(msg.data)
        onEventRef.current(ev)
      } catch {
        // Ignore malformed events.
      }
    }

    return () => source.close()
  }, [watchPath])
}
