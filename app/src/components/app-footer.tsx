import { useEffect, useState } from "preact/hooks"
import { fetchInfo } from "../lib/api"

export function AppFooter() {
  const [pid, setPid] = useState<number | null>(null)

  useEffect(() => {
    void fetchInfo().then((info) => setPid(info.pid))
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
      {pid !== null && <span>| PID {pid}</span>}
    </footer>
  )
}
