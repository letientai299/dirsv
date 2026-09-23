import { afterEach, expect, it, vi } from "vitest"
import { browse, fetchRaw, MAX_TEXT_BYTES, rawUrl } from "./api"
import { encodePath, navigate } from "./navigate"

afterEach(() => vi.unstubAllGlobals())

it("encodes filenames once across navigation and APIs", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response('{"type":"dir","entries":[]}'))
  vi.stubGlobal("fetch", fetchMock)
  const path = "/space #?%/tiếng.txt"
  navigate(path)
  expect(decodeURIComponent(location.pathname)).toBe(path)
  expect(location.hash).toBe("")
  expect(location.search).toBe("")
  await browse(path)
  expect(fetchMock.mock.calls[0]?.[0]).toBe(`/api/browse${encodePath(path)}`)
  expect(rawUrl(path)).toBe(`/api/raw${encodePath(path)}`)
})

it("bounds streamed text without content length", async () => {
  const cancel = vi.fn()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(MAX_TEXT_BYTES + 1))
    },
    cancel,
  })
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(body, { headers: { "Content-Type": "text/plain" } }),
      ),
  )
  expect(await fetchRaw("/large")).toEqual({
    kind: "large",
    url: "/api/raw/large",
  })
  expect(cancel).toHaveBeenCalledOnce()
})

it("bounds line-heavy plaintext", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response("\n".repeat(10_001), {
        headers: { "Content-Type": "text/plain" },
      }),
    ),
  )
  expect((await fetchRaw("/lines")).kind).toBe("large")
})

it("decodes split UTF-8 chunks", async () => {
  const bytes = new TextEncoder().encode("tiếng")
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte]))
      controller.close()
    },
  })
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(body, { headers: { "Content-Type": "text/plain" } }),
      ),
  )
  expect(await fetchRaw("/small")).toEqual({ kind: "text", content: "tiếng" })
})
