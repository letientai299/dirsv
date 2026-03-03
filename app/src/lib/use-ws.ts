import { useEffect, useRef } from "preact/hooks"

interface WsEvent {
  type: "change" | "create" | "delete" | "rename"
  path: string
}

type Listener = (ev: WsEvent) => void

/**
 * Shared singleton WebSocket for the entire tab.
 *
 * Browsers limit HTTP/1.1 connections to ~6 per origin. SSE holds a slot
 * permanently; WebSocket frees the HTTP slot after the upgrade handshake.
 *
 * This module opens a single WebSocket watching the root ("") and
 * dispatches events to per-hook listeners with client-side prefix matching.
 */
let ws: WebSocket | null = null
const listeners = new Map<Listener, string>() // listener → watched prefix
let teardownTimer: ReturnType<typeof setTimeout> | undefined
let backoff = 0

const BACKOFF_BASE = 1000
const BACKOFF_MAX = 30000

function wsUrl(): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:"
  return `${proto}//${location.host}/api/events?watch=`
}

function connect() {
  if (ws) return

  const socket = new WebSocket(wsUrl())
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  let pending: WsEvent[] = []

  socket.onopen = () => {
    backoff = 0
  }

  socket.onmessage = (msg) => {
    try {
      pending.push(JSON.parse(msg.data))
    } catch {
      return
    }
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      const batch = pending
      pending = []
      for (const ev of batch) {
        for (const [fn, prefix] of listeners) {
          if (
            prefix === "" ||
            ev.path.startsWith(prefix) ||
            prefix.startsWith(ev.path)
          ) {
            fn(ev)
          }
        }
      }
    }, 100)
  }

  socket.onclose = () => {
    ws = null
    if (listeners.size === 0) return
    backoff = Math.min(backoff === 0 ? BACKOFF_BASE : backoff * 2, BACKOFF_MAX)
    setTimeout(connect, backoff)
  }

  socket.onerror = () => {
    // onclose fires after onerror — reconnect logic lives there.
  }

  ws = socket
}

function teardownIfEmpty() {
  if (listeners.size > 0 || !ws) return
  ws.close()
  ws = null
  backoff = 0
}

function subscribe(prefix: string, fn: Listener) {
  listeners.set(fn, prefix)
  connect()
}

function unsubscribe(fn: Listener) {
  listeners.delete(fn)
  // Defer teardown so rapid mount/unmount cycles don't churn connections.
  clearTimeout(teardownTimer)
  teardownTimer = setTimeout(teardownIfEmpty, 1000)
}

/**
 * Subscribes to WebSocket events for the given watch path.
 * Calls onEvent whenever a file system change is detected.
 * All hooks in the tab share a single WebSocket connection.
 */
export function useWS(watchPath: string, onEvent: (ev: WsEvent) => void) {
  const onEventRef = useRef(onEvent)
  useEffect(() => {
    onEventRef.current = onEvent
  })

  useEffect(() => {
    const fn: Listener = (ev) => onEventRef.current(ev)
    subscribe(watchPath, fn)
    return () => unsubscribe(fn)
  }, [watchPath])
}
