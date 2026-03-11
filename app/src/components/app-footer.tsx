import { useEffect, useState } from "preact/hooks"
import { fetchInfo, type ServerInfo } from "../lib/api"

export function AppFooter() {
  const [info, setInfo] = useState<ServerInfo | null>(null)

  useEffect(() => {
    void fetchInfo().then(setInfo)
  }, [])

  return (
    <footer class="app-footer">
      <a
        href="https://github.com/letientai299/dirsv"
        target="_blank"
        rel="noopener"
      >
        <img
          src="/logo.svg"
          alt=""
          width="24"
          height="24"
          class="footer-logo"
        />
        dirsv
      </a>
      {info?.version && (
        <a
          href={info.version.url}
          target="_blank"
          rel="noopener"
          class="footer-version"
        >
          {info.version.label}
        </a>
      )}
      {info?.pid != null && <span>| PID {info.pid}</span>}
    </footer>
  )
}
