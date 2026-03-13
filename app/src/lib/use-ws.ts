import { useEffect, useRef } from "preact/hooks"
import { normalizePath } from "./navigate"

export interface WsEvent {
  type:
    | "change"
    | "create"
    | "delete"
    | "rename"
    | "scroll"
    | "cursor"
    | "selection"
    | "clear"
    | "close"
  path: string
  changedLines?: number[]
  line?: number
  startLine?: number
  endLine?: number
  total?: number
  topLine?: number
  bottomLine?: number
}

type Listener = (ev: WsEvent) => void

/**
 * Shared singleton WebSocket for the entire tab.
 *
 * Clients send {"watch":["path1","path2"]} to update the server-side
 * filter set whenever hooks subscribe or unsubscribe. The server only
 * forwards events matching at least one prefix, reducing wasted
 * broadcast work and client-side filtering.
 *
 * Client-side prefix matching is kept as a safety net.
 */
let ws: WebSocket | null = null
const listeners = new Map<Listener, string>() // listener → watched prefix
let teardownTimer: ReturnType<typeof setTimeout> | undefined
let backoff = 0

const BACKOFF_BASE = 1000
const BACKOFF_MAX = 30000

function wsUrl(): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:"
  return `${proto}//${location.host}/api/events`
}

function sendWatchList() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return
  const prefixes = [...new Set(listeners.values())]
  ws.send(JSON.stringify({ watch: prefixes }))
}

function dispatch(batch: WsEvent[]) {
  for (const ev of batch) {
    if (ev.type === "close") {
      const current = normalizePath(
        decodeURIComponent(location.pathname),
        "/",
      ).replace(/^\//, "")
      if (current === ev.path) {
        window.close()
      }
      continue
    }
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
}

function connect() {
  if (ws) return

  const socket = new WebSocket(wsUrl())
  let rafId = 0
  let pending: WsEvent[] = []

  socket.onopen = () => {
    backoff = 0
    sendWatchList()
  }

  socket.onmessage = (msg) => {
    try {
      pending.push(JSON.parse(msg.data))
    } catch {
      return
    }
    if (!rafId) {
      rafId = requestAnimationFrame(() => {
        rafId = 0
        const batch = pending
        pending = []
        dispatch(batch)
      })
    }
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
  sendWatchList()
}

function unsubscribe(fn: Listener) {
  listeners.delete(fn)
  sendWatchList()
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
