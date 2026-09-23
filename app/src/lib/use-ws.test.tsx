import { render } from "preact"
import { act } from "preact/test-utils"
import { afterEach, expect, it, vi } from "vitest"
import { clearCache, getCached, prefetch } from "./content-cache"
import { isFileEvent, matchesPath, useWS, type WsEvent } from "./use-ws"

class Socket {
  static OPEN = 1
  static instances: Socket[] = []
  readyState = 1
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  send = vi.fn()
  close() {
    this.onclose?.()
  }
  constructor() {
    Socket.instances.push(this)
  }
  emit(event: WsEvent) {
    this.onmessage?.({ data: JSON.stringify(event) })
  }
}

const host = document.createElement("div")
afterEach(async () => {
  await act(() => render(null, host))
  await vi.runAllTimersAsync()
  clearCache()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  Socket.instances = []
})

it("invalidates before batching root events and refreshes on reconnect", async () => {
  function Subscriber({
    onEvent: callback,
  }: {
    onEvent: (event: WsEvent) => void
  }) {
    useWS(".", callback)
    return null
  }
  vi.useFakeTimers()
  vi.stubGlobal("WebSocket", Socket)
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          new Response("old", { headers: { "Content-Type": "text/plain" } }),
        ),
      ),
  )
  const events: WsEvent[] = []
  const onEvent = (event: WsEvent) => {
    if (!isFileEvent(event)) return
    expect(getCached("/b.txt")).toBeUndefined()
    events.push(event)
  }
  await act(async () => {
    render(<Subscriber onEvent={onEvent} />, host)
  })
  const socket = Socket.instances[0]
  if (!socket) throw new Error("Missing socket")
  socket.onopen?.()
  await prefetch("/b.txt")
  socket.emit({ type: "cursor", path: "a.txt", line: 1 })
  socket.emit({ type: "change", path: "b.txt" })
  socket.emit({ type: "change", path: "c.txt" })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(20)
  })
  expect(events).toHaveLength(1)
  await prefetch("/b.txt")
  socket.close()
  await vi.advanceTimersByTimeAsync(1000)
  Socket.instances[1]?.onopen?.()
  expect(events[events.length - 1]?.type).toBe("refresh")
  expect(matchesPath("a.txt", "a.txt.bak")).toBe(false)
  expect(matchesPath("dir/a", "dir")).toBe(true)
})
