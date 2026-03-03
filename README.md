# dirsv

A local directory browser with live reload. Single Go binary, embedded web UI.

Browse filesystem contents with a clean table view, render markdown with
syntax-highlighted code blocks, and see changes instantly via WebSocket.

|            Directory browsing            |                JSON tree view                 |
| :--------------------------------------: | :-------------------------------------------: |
| ![Directory browsing](demo/dir-view.png) |     ![JSON tree view](demo/json-dark.png)     |
|       **Markdown with KaTeX math**       |             **PlantUML diagrams**             |
|   ![Markdown with math](demo/math.png)   | ![PlantUML diagrams](demo/plant-uml-dark.png) |

## Features

- **Directory browsing** — table view with [Devicon][devicon] file-type icons,
  sizes, and modification dates. Keyboard navigation (arrow keys, `j`/`k`,
  Enter to open). Directories with `index.html` auto-route to HTML preview
- **File sidebar** — resizable panel listing sibling files with type icons.
  Prev/next navigation across siblings
- **Breadcrumb navigation** — clickable path segments in the toolbar
- **Markdown rendering** — [GFM][gfm] via [unified/remark][remark] with
  [Shiki][shiki] syntax highlighting, [KaTeX][katex] math, definition lists,
  color chips, GitHub-style alerts, emoji, raw HTML blocks, video embeds, and a
  sticky table of contents sidebar
- **Diagrams in markdown** — fenced code blocks for [Mermaid][mermaid],
  [PlantUML][plantuml], [Graphviz][graphviz], [D2][d2], [DBML][dbml], and
  [Typst][typst]. All rendered client-side via WASM or JS
- **Standalone diagram files** — `.gv`/`.dot`, `.d2`, `.dbml`, and `.typ`
  files render directly
- **Code view** — syntax highlighting for 100+ languages, line numbers, and a
  copy button
- **JSON / YAML tree view** — collapsible tree with path filtering, Tree/Raw
  toggle, and copy-to-clipboard per node. Large files (>500 KB) default to raw
- **Image viewer** — gallery navigation between sibling images with arrow keys,
  preloading, and fade transitions
- **Video player** — HTML5 controls with gallery navigation for `.mp4`, `.webm`,
  `.ogg`, `.mov`
- **HTML preview** — iframe sandbox with automatic URL rewriting for static
  sites
- **Binary files** — detected by MIME type, shown with an "Open in app" link
- **Live reload** — per-path WebSocket updates with server-side filtering. Only
  watched paths are broadcast to each client
- **Dark/light theme** — toggle with persistent override, respects
  `prefers-color-scheme`
- **Keyboard shortcuts** — `?` opens a help popover listing all bindings
- **Single binary** — frontend assets embedded via `go:embed` with
  pre-compressed gzip, no runtime dependencies

## Install

**macOS / Linux:**

```sh
curl -fsSL https://raw.githubusercontent.com/letientai299/dirsv/main/scripts/install.sh | bash
```

**Windows (PowerShell 5.1+):**

```powershell
irm https://raw.githubusercontent.com/letientai299/dirsv/main/scripts/install.ps1 | iex
```

**Custom directory:**

```sh
curl -fsSL https://raw.githubusercontent.com/letientai299/dirsv/main/scripts/install.sh | bash -s -- -d ~/.local/bin
```

Or download a binary directly from [Releases][releases].

## Quick start

```sh
dirsv           # serve current directory on :8080, open browser
dirsv ./docs    # serve a specific directory
```

### Build from source

Requires [mise][mise] (manages Go, [Bun][bun], and [golangci-lint][gclint] automatically).

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
dirsv [path]             directory or file to serve (default ".")
    --host <addr>        listen address (default "localhost")
-p, --port <port>        listen port (default 8080, or $PORT)
-b, --browser <name>     browser to open (default: system default)
    --no-open            don't auto-open browser
-d, --debug              enable verbose watcher logs
-v, --version            print version and exit
```

When `[path]` is a file, the server restricts browsing to that single file.
If the port is taken and wasn't explicitly set, the server auto-finds a free
port in the 8080–8179 range.

## Development

```sh
mise dev   # Go server + Vite dev server in parallel (HMR)
```

The Go server runs on `:8080` and proxies non-API requests to [Vite][vite] on `:5173`.

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
[vite]: https://vite.dev/
[bun]: https://bun.sh/
[gclint]: https://golangci-lint.run/
[releases]: https://github.com/letientai299/dirsv/releases
