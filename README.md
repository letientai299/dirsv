# dirsv

A local directory browser with live reload. Single Go binary, embedded web UI.

Browse filesystem contents with a clean table view, render markdown with
syntax-highlighted code blocks, and see changes instantly via server-sent
events.

## Features

- **Directory browsing** -- table view with [Devicon][devicon] file-type icons,
  sizes, and modification dates
- **Markdown rendering** -- GFM via [unified/remark][remark] with [Shiki][shiki]
  syntax highlighting
- **Live reload** -- granular SSE updates per file and directory
- **Dark/light theme** -- system preference detection with manual override
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
[mise]: https://mise.jdx.dev/
[fsnotify]: https://github.com/fsnotify/fsnotify
[pflag]: https://github.com/spf13/pflag
[preact]: https://preactjs.com/
[vite]: https://vite.dev/
[bun]: https://bun.sh/
[biome]: https://biomejs.dev/
[gclint]: https://golangci-lint.run/
