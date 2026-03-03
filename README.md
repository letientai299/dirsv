# dirsv

A local directory browser with live reload. Single Go binary, embedded web UI.

Browse filesystem contents with a clean table view, render markdown with
syntax-highlighted code blocks, and see changes instantly via server-sent
events.

## Features

- **Directory browsing** -- table view with [Devicon][devicon] file-type icons,
  sizes, and modification dates. Keyboard navigation (arrow keys, `j`/`k`,
  Enter to open)
- **Markdown rendering** -- GFM via [unified/remark][remark] with [Shiki][shiki]
  syntax highlighting, [KaTeX][katex] math, [Mermaid][mermaid] and
  [PlantUML][plantuml] diagrams, GitHub-style alerts, emoji, and a sticky table
  of contents sidebar
- **Code view** -- syntax highlighting for 100+ languages, line numbers, and a
  copy button
- **JSON / YAML tree view** -- collapsible tree with path filtering, keyboard
  shortcuts, and copy-to-clipboard per node
- **HTML preview** -- iframe sandbox with automatic URL rewriting for static
  sites
- **Live reload** -- granular SSE updates per file and directory
- **Dark/light theme** -- system / light / dark cycle with persistent override
- **Single binary** -- frontend assets embedded via `go:embed`, no runtime
  dependencies

## Quick start

Requires [mise][mise] (manages Go, Bun, and golangci-lint automatically).

```sh
mise build   # build frontend + Go binary
./bin/server # serves current directory on :8080, opens browser
```

Or in one step:

```sh
mise run
```

### CLI flags

```
-a, --addr      listen address (default ":8080")
-r, --root      root directory to serve (default ".")
-b, --browser   browser to open (default: system default)
    --dev       proxy frontend to Vite dev server
    --no-open   don't auto-open browser
```

## Development

```sh
mise dev   # Go server + Vite dev server in parallel (HMR)
```

The Go server runs on `:8080` and proxies non-API requests to Vite on `:5173`.

### Tasks

| Task         | Description                  |
| ------------ | ---------------------------- |
| `mise build` | Build frontend + Go binary   |
| `mise dev`   | Dev servers with HMR         |
| `mise test`  | Go tests (race, cover)       |
| `mise lint`  | Lint Go + TypeScript + Biome |
| `mise fmt`   | Format all code              |

## Tech stack

**Backend:** Go, [fsnotify][fsnotify] (file watching), [pflag][pflag] (CLI)

**Frontend:** [Preact][preact], [Vite][vite], TypeScript,
[unified][remark]/[Shiki][shiki] (markdown + syntax highlighting)

**Tooling:** [mise][mise], [Bun][bun], [Biome][biome], [golangci-lint][gclint]

## API

```
GET /api/browse/{path...}   directory listing or file metadata (JSON)
GET /api/raw/{path...}      raw file content with MIME type
GET /api/events?watch=path  SSE stream for filesystem changes
GET /{path...}              SPA (index.html)
```

## License

MIT

[devicon]: https://devicon.dev/
[remark]: https://github.com/remarkjs/remark
[shiki]: https://shiki.style/
[katex]: https://katex.org/
[mermaid]: https://mermaid.js.org/
[plantuml]: https://plantuml.com/
[mise]: https://mise.jdx.dev/
[fsnotify]: https://github.com/fsnotify/fsnotify
[pflag]: https://github.com/spf13/pflag
[preact]: https://preactjs.com/
[vite]: https://vite.dev/
[bun]: https://bun.sh/
[biome]: https://biomejs.dev/
[gclint]: https://golangci-lint.run/
