import { useEffect, useState } from "preact/hooks"
import { fetchInfo } from "../lib/api"

export function AppFooter() {
  const [pid, setPid] = useState<number | null>(null)

  useEffect(() => {
    void fetchInfo().then((info) => setPid(info.pid))
  }, [])

  return (
    <footer class="app-footer">
      <span>
        served by{" "}
        <a
          href="https://github.com/letientai299/dirsv"
          target="_blank"
          rel="noopener"
        >
          dirsv
        </a>
        {pid !== null && <> | PID {pid}</>}
      </span>
    </footer>
  )
}
