import { afterEach, describe, expect, it, vi } from "vitest"
import {
  handleRelativeLinkClick,
  resolveRelativeUrl,
  rewriteMediaSrc,
} from "./markdown-urls"

describe("resolveRelativeUrl", () => {
  it("resolves relative path from root file", () => {
    expect(resolveRelativeUrl("demo/img.png", "/README.md")).toBe(
      "/demo/img.png",
    )
  })

  it("resolves relative path from nested file", () => {
    expect(resolveRelativeUrl("img.png", "/docs/guide.md")).toBe(
      "/docs/img.png",
    )
  })

  it("resolves ./ prefix", () => {
    expect(resolveRelativeUrl("./img.png", "/docs/guide.md")).toBe(
      "/docs/img.png",
    )
  })

  it("resolves ../ traversal", () => {
    expect(resolveRelativeUrl("../img.png", "/docs/sub/guide.md")).toBe(
      "/docs/img.png",
    )
  })

  it("passes through absolute paths", () => {
    expect(resolveRelativeUrl("/foo/bar.png", "/docs/guide.md")).toBe(
      "/foo/bar.png",
    )
  })

  it("passes through external URLs", () => {
    expect(
      resolveRelativeUrl("https://example.com/img.png", "/README.md"),
    ).toBe("https://example.com/img.png")
  })

  it("passes through protocol-relative URLs", () => {
    expect(resolveRelativeUrl("//cdn.example.com/x.js", "/README.md")).toBe(
      "//cdn.example.com/x.js",
    )
  })

  it("passes through anchor-only links", () => {
    expect(resolveRelativeUrl("#heading", "/docs/guide.md")).toBe("#heading")
  })

  it("preserves hash fragment in relative links", () => {
    expect(resolveRelativeUrl("./idea.md#architecture", "/docs/guide.md")).toBe(
      "/docs/idea.md#architecture",
    )
  })

  it("preserves hash fragment with ../ traversal", () => {
    expect(
      resolveRelativeUrl("../other.md#section", "/docs/sub/guide.md"),
    ).toBe("/docs/other.md#section")
  })
})

describe("rewriteMediaSrc", () => {
  it("rewrites img[src] to /api/raw/", () => {
    const el = document.createElement("div")
    el.innerHTML = '<img src="demo/photo.jpg">'
    rewriteMediaSrc(el, "/README.md")
    expect(el.querySelector("img")?.getAttribute("src")).toBe(
      "/api/raw/demo/photo.jpg",
    )
  })

  it("rewrites video source[src] to /api/raw/", () => {
    const el = document.createElement("div")
    el.innerHTML = '<video><source src="clip.mp4"></video>'
    rewriteMediaSrc(el, "/docs/page.md")
    expect(el.querySelector("source")?.getAttribute("src")).toBe(
      "/api/raw/docs/clip.mp4",
    )
  })

  it("skips external URLs", () => {
    const el = document.createElement("div")
    el.innerHTML = '<img src="https://example.com/img.png">'
    rewriteMediaSrc(el, "/README.md")
    expect(el.querySelector("img")?.getAttribute("src")).toBe(
      "https://example.com/img.png",
    )
  })

  it("skips already-rewritten /api/ URLs", () => {
    const el = document.createElement("div")
    el.innerHTML = '<img src="/api/raw/demo/photo.jpg">'
    rewriteMediaSrc(el, "/README.md")
    expect(el.querySelector("img")?.getAttribute("src")).toBe(
      "/api/raw/demo/photo.jpg",
    )
  })
})

describe("handleRelativeLinkClick", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function makeClickEvent(
    target: HTMLElement,
    mods: Partial<MouseEvent> = {},
  ): MouseEvent {
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      ...mods,
    })
    // Override target since jsdom doesn't set it from constructor.
    Object.defineProperty(event, "target", { value: target })
    return event
  }

  it("calls navigate for relative link click", () => {
    const pushState = vi.spyOn(history, "pushState")
    const dispatchEvent = vi.spyOn(window, "dispatchEvent")

    const a = document.createElement("a")
    a.setAttribute("href", "other.md")
    const event = makeClickEvent(a)

    handleRelativeLinkClick(event, "/docs/guide.md")

    expect(event.defaultPrevented).toBe(true)
    expect(pushState).toHaveBeenCalledWith(null, "", "/docs/other.md")
    expect(dispatchEvent).toHaveBeenCalledWith(expect.any(PopStateEvent))
  })

  it("ignores external links", () => {
    const pushState = vi.spyOn(history, "pushState")

    const a = document.createElement("a")
    a.setAttribute("href", "https://example.com")
    const event = makeClickEvent(a)

    handleRelativeLinkClick(event, "/README.md")

    expect(event.defaultPrevented).toBe(false)
    expect(pushState).not.toHaveBeenCalled()
  })

  it("ignores anchor-only links", () => {
    const pushState = vi.spyOn(history, "pushState")

    const a = document.createElement("a")
    a.setAttribute("href", "#heading")
    const event = makeClickEvent(a)

    handleRelativeLinkClick(event, "/README.md")

    expect(event.defaultPrevented).toBe(false)
    expect(pushState).not.toHaveBeenCalled()
  })

  it("ignores links with modifier keys", () => {
    const pushState = vi.spyOn(history, "pushState")

    const a = document.createElement("a")
    a.setAttribute("href", "other.md")

    for (const mod of ["metaKey", "ctrlKey", "shiftKey", "altKey"] as const) {
      const event = makeClickEvent(a, { [mod]: true })
      handleRelativeLinkClick(event, "/README.md")
      expect(event.defaultPrevented).toBe(false)
    }

    expect(pushState).not.toHaveBeenCalled()
  })

  it("navigates with hash fragment preserved", () => {
    const pushState = vi.spyOn(history, "pushState")

    const a = document.createElement("a")
    a.setAttribute("href", "./idea.md#architecture")
    const event = makeClickEvent(a)

    handleRelativeLinkClick(event, "/docs/guide.md")

    expect(event.defaultPrevented).toBe(true)
    expect(pushState).toHaveBeenCalledWith(
      null,
      "",
      "/docs/idea.md#architecture",
    )
  })

  it("handles click on child of anchor", () => {
    const pushState = vi.spyOn(history, "pushState")

    const a = document.createElement("a")
    a.setAttribute("href", "other.md")
    const span = document.createElement("span")
    a.appendChild(span)

    const event = makeClickEvent(span)
    handleRelativeLinkClick(event, "/docs/guide.md")

    expect(event.defaultPrevented).toBe(true)
    expect(pushState).toHaveBeenCalledWith(null, "", "/docs/other.md")
  })
})
