import { afterEach, describe, expect, it, vi } from "vitest"
import { fetchRaw, type RawResult } from "./api"
import {
  clearCache,
  getCached,
  invalidate,
  invalidateTree,
  prefetch,
  warmContent,
} from "./content-cache"

vi.mock("./api", () => ({ fetchRaw: vi.fn(), MAX_TEXT_BYTES: 1_000_000 }))
const fetchMock = vi.mocked(fetchRaw)
afterEach(() => {
  clearCache()
  vi.resetAllMocks()
})

describe("content cache", () => {
  it("keeps foreground downloads alive when prefetch unsubscribes", async () => {
    let finish!: (result: RawResult) => void
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const controller = new AbortController()
    const speculative = prefetch("/next", controller.signal).catch(
      (e: Error) => e.name,
    )
    const foreground = prefetch("/next")
    controller.abort()
    finish({ kind: "text", content: "fresh" })
    expect(await speculative).toBe("AbortError")
    expect(await foreground).toEqual({ kind: "text", content: "fresh" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("does not remove replacement inflight requests", async () => {
    let rejectOld!: (error: Error) => void
    let finishNew!: (result: RawResult) => void
    fetchMock
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectOld = reject
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishNew = resolve
          }),
      )
    const old = prefetch("/file").catch(() => undefined)
    invalidate("/file")
    const next = prefetch("/file")
    rejectOld(new DOMException("aborted", "AbortError"))
    await old
    const shared = prefetch("/file")
    finishNew({ kind: "text", content: "new" })
    expect(await shared).toEqual(await next)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("invalidates siblings and descendants without prefix collisions", async () => {
    fetchMock.mockResolvedValue({ kind: "text", content: "old" })
    await prefetch("/dir/b")
    await prefetch("/dir/child/c")
    await prefetch("/directory/d")
    invalidateTree("/dir/b")
    fetchMock.mockResolvedValue({ kind: "text", content: "new" })
    expect(await prefetch("/dir/b")).toEqual({ kind: "text", content: "new" })
    invalidateTree("/dir")
    expect(getCached("/dir/child/c")).toBeUndefined()
    expect(getCached("/directory/d")).toBeDefined()
  })

  it("evicts by bytes and skips oversized prefetch", async () => {
    fetchMock.mockResolvedValue({
      kind: "text",
      content: "x".repeat(1_000_000),
    })
    for (let i = 0; i < 5; i++) await prefetch(`/${i}`)
    expect(getCached("/0")).toBeUndefined()
    expect(getCached("/4")).toBeDefined()
    warmContent("/large", 1_000_001)
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })
})
