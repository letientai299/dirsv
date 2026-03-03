# dirsv

A local directory browser with live reload. Single Go binary, embedded web UI.

Browse filesystem contents with a clean table view, render markdown with
syntax-highlighted code blocks, and see changes instantly via server-sent
events.

## Features

- **Directory browsing** — table view with [Devicon][devicon] file-type icons,
  sizes, and modification dates. Keyboard navigation (arrow keys, `j`/`k`,
  Enter to open)
- **Markdown rendering** — [GFM][gfm] via [unified/remark][remark] with
  [Shiki][shiki] syntax highlighting, [KaTeX][katex] math, definition lists,
  color chips, GitHub-style alerts, emoji, raw HTML blocks, video embeds, and a
  sticky table of contents sidebar
- **Diagrams in markdown** — fenced code blocks for [Mermaid][mermaid],
  [PlantUML][plantuml], [Graphviz][graphviz], [D2][d2], [DBML][dbml], and
  [Typst][typst]. All rendered client-side via WASM or JS
- **Standalone diagram files** — `.gv`/`.dot`, `.d2`, `.dbml`, `.typ`, and
  `.excalidraw` files render directly
- **Code view** — syntax highlighting for 100+ languages, line numbers, and a
  copy button
- **JSON / YAML tree view** — collapsible tree with path filtering, keyboard
  shortcuts, and copy-to-clipboard per node
- **Image viewer** — gallery navigation between sibling images with arrow keys,
  preloading, and fade transitions
- **Video player** — HTML5 controls for `.mp4`, `.webm`, `.ogg`, `.mov`
- **HTML preview** — iframe sandbox with automatic URL rewriting for static
  sites
- **Live reload** — granular SSE updates per file and directory
- **Dark/light theme** — toggle with persistent override
- **Single binary** — frontend assets embedded via `go:embed`, no runtime
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
server [path]            directory or file to serve (default ".")
    --host <addr>        listen address (default "localhost")
-p, --port <port>        listen port (default 8080, or $PORT)
-b, --browser <name>     browser to open (default: system default)
    --no-open            don't auto-open browser
-s, --silent             suppress watcher logs
```

When `[path]` is a file, the server restricts browsing to that single file.
If the port is taken and wasn't explicitly set, the server auto-finds a free
port in the 8080–8179 range.

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
[gfm]: https://github.github.com/gfm/
[shiki]: https://shiki.style/
[katex]: https://katex.org/
[mermaid]: https://mermaid.js.org/
[plantuml]: https://plantuml.com/
[graphviz]: https://graphviz.org/
[d2]: https://d2lang.com/
[dbml]: https://dbml.dbdiagram.io/
[typst]: https://typst.app/
[mise]: https://mise.jdx.dev/
[fsnotify]: https://github.com/fsnotify/fsnotify
[pflag]: https://github.com/spf13/pflag
[preact]: https://preactjs.com/
[vite]: https://vite.dev/
[bun]: https://bun.sh/
[biome]: https://biomejs.dev/
[gclint]: https://golangci-lint.run/
