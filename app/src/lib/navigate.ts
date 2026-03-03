/** SPA navigation helper. Encodes each path segment for proper URL handling. */
export function navigate(to: string) {
  const encoded = to
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/")
  history.pushState(null, "", encoded)
  window.dispatchEvent(new PopStateEvent("popstate"))
}
