import { render } from "preact"
import { act } from "preact/test-utils"
import { afterEach, expect, it, vi } from "vitest"
import { useShiki } from "../lib/use-shiki"
import { StructuredView } from "./structured-view"

vi.mock("../lib/use-shiki", () => ({ useShiki: vi.fn(() => null) }))
const host = document.createElement("div")
afterEach(async () => {
  await act(() => render(null, host))
  vi.clearAllMocks()
})

async function click(text: string) {
  const button = [...host.querySelectorAll("button")].find(
    (node) => node.textContent === text,
  )
  expect(button).toBeDefined()
  await act(() => button?.click())
}

it("only highlights when raw mode is visible", async () => {
  await act(() =>
    render(
      <StructuredView content='{"a":1}' parse={JSON.parse} lang="json" />,
      host,
    ),
  )
  expect(host.querySelector('[role="tree"]')).not.toBeNull()
  expect(useShiki).not.toHaveBeenCalled()
  await click("Raw")
  expect(useShiki).toHaveBeenCalledWith('{"a":1}', "json")
  expect(host.querySelector("code")?.textContent).toBe('{"a":1}')
})

it("filters nested rows", async () => {
  await act(() =>
    render(
      <StructuredView
        content='{"group":{"match":1,"other":2}}'
        parse={JSON.parse}
        lang="json"
      />,
      host,
    ),
  )
  await click("Expand All")
  const input = host.querySelector("input")
  if (!input) throw new Error("Filter input missing")
  await act(() => {
    input.value = "match"
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
  expect(
    [...host.querySelectorAll(".jt-key")].map((node) => node.textContent),
  ).toEqual(["group", "match"])
})

it("retains raw fallback for invalid input", async () => {
  await act(() =>
    render(
      <StructuredView content="invalid" parse={JSON.parse} lang="json" />,
      host,
    ),
  )
  expect(useShiki).toHaveBeenCalledWith("invalid", "json")
  expect(host.querySelector("code")?.textContent).toBe("invalid")
})
