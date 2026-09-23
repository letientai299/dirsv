import { render } from "preact"
import { act } from "preact/test-utils"
import { codeToHtml } from "shiki"
import { afterEach, expect, it, vi } from "vitest"
import { useShiki } from "./use-shiki"

vi.mock("shiki", () => ({ codeToHtml: vi.fn() }))
const host = document.createElement("div")
afterEach(async () => {
  await act(() => render(null, host))
  vi.useRealTimers()
  vi.resetAllMocks()
})

it("falls back to current content after highlighting fails", async () => {
  function Preview({ content }: { content: string }) {
    const html = useShiki(content, "text")
    return <div>{html ?? content}</div>
  }
  vi.useFakeTimers()
  vi.mocked(codeToHtml)
    .mockResolvedValueOnce("highlighted first")
    .mockRejectedValueOnce(new Error("failed"))
  await act(async () => {
    render(<Preview content="first" />, host)
  })
  await act(async () => {
    await vi.runAllTimersAsync()
  })
  expect(host.textContent).toBe("highlighted first")
  await act(async () => {
    render(<Preview content="second" />, host)
  })
  await act(async () => {
    await vi.runAllTimersAsync()
  })
  expect(host.textContent).toBe("second")
})
