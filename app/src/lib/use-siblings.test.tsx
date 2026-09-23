import { render } from "preact"
import { act } from "preact/test-utils"
import { afterEach, expect, it, vi } from "vitest"
import { type BrowseResponse, browse } from "./api"
import { useSiblings } from "./use-siblings"
import { useWS } from "./use-ws"

vi.mock("./api", () => ({ browse: vi.fn() }))
vi.mock("./use-ws", () => ({
  useWS: vi.fn(),
  isFileEvent: (event: { type: string }) =>
    ["change", "create", "delete", "rename", "refresh"].includes(event.type),
}))
const host = document.createElement("div")
afterEach(async () => {
  await act(() => render(null, host))
  vi.resetAllMocks()
})

it("ignores editor events and discards older directory responses", async () => {
  function Siblings() {
    return <div>{JSON.stringify(useSiblings("/"))}</div>
  }
  const browseMock = vi.mocked(browse)
  browseMock.mockResolvedValueOnce({ type: "dir", entries: [] })
  await act(async () => {
    render(<Siblings />, host)
  })
  const listener = vi.mocked(useWS).mock.calls[0]?.[1]
  if (!listener) throw new Error("Missing subscription")
  listener({ type: "cursor", path: "file", line: 1 })
  expect(browseMock).toHaveBeenCalledTimes(1)
  let oldResolve!: (value: BrowseResponse) => void
  let newResolve!: (value: BrowseResponse) => void
  browseMock
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          oldResolve = resolve
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          newResolve = resolve
        }),
    )
  listener({ type: "change", path: "a" })
  listener({ type: "change", path: "b" })
  await act(async () => {
    newResolve({
      type: "dir",
      entries: [{ name: "new", isDir: false, size: 1, modTime: "" }],
    })
  })
  await act(async () => {
    oldResolve({
      type: "dir",
      entries: [{ name: "old", isDir: false, size: 1, modTime: "" }],
    })
  })
  expect(host.textContent).toContain("new")
  expect(host.textContent).not.toContain("old")
  await act(() => render(null, host))
  expect(browseMock.mock.calls[2]?.[1]?.aborted).toBe(true)
})
