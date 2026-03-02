import { useCallback, useRef } from "preact/hooks"
import {
  computeVisiblePaths,
  getChildren,
  getType,
  type JsonValue,
  serializeValue,
} from "../lib/json-tree"
import { JsonNode } from "./json-node"

interface Props {
  value: JsonValue
  expanded: Set<string>
  onToggle: (path: string) => void
  filter: string
  allPaths: Set<string>
  focusedPath: string | null
  flatPaths: string[]
  onFocusPath: (path: string | null) => void
}

/** Resolve a dot-path to its JsonValue within the tree. */
function resolveValue(root: JsonValue, path: string): JsonValue | undefined {
  let current: JsonValue = root
  for (const seg of path.split(".")) {
    if (current === null || typeof current !== "object") return undefined
    if (Array.isArray(current)) {
      current = current[Number(seg)] as JsonValue
    } else {
      current = (current as Record<string, JsonValue>)[seg] as JsonValue
    }
    if (current === undefined) return undefined
  }
  return current
}

function isContainerValue(v: JsonValue | undefined): boolean {
  return v !== null && v !== undefined && typeof v === "object"
}

/** Get the parent path (everything before the last dot), or null for root-level. */
function parentPath(path: string): string | null {
  const dot = path.lastIndexOf(".")
  return dot === -1 ? null : path.slice(0, dot)
}

interface KeyContext {
  focusedPath: string | null
  value: JsonValue
  expanded: Set<string>
  flatPaths: string[]
  moveFocus: (delta: number) => void
  onToggle: (path: string) => void
  onFocusPath: (path: string | null) => void
  scrollToPath: (path: string) => void
}

function handleArrowRight(ctx: KeyContext) {
  if (!ctx.focusedPath) return
  const val = resolveValue(ctx.value, ctx.focusedPath)
  if (!isContainerValue(val)) return
  if (!ctx.expanded.has(ctx.focusedPath)) {
    ctx.onToggle(ctx.focusedPath)
  } else {
    ctx.moveFocus(1)
  }
}

function handleArrowLeft(ctx: KeyContext) {
  if (!ctx.focusedPath) return
  const val = resolveValue(ctx.value, ctx.focusedPath)
  if (isContainerValue(val) && ctx.expanded.has(ctx.focusedPath)) {
    ctx.onToggle(ctx.focusedPath)
    return
  }
  const parent = parentPath(ctx.focusedPath)
  if (parent) {
    ctx.onFocusPath(parent)
    ctx.scrollToPath(parent)
  }
}

function handleEnter(ctx: KeyContext) {
  if (!ctx.focusedPath) return
  const val = resolveValue(ctx.value, ctx.focusedPath)
  if (isContainerValue(val)) ctx.onToggle(ctx.focusedPath)
}

function handleHome(ctx: KeyContext) {
  const first = ctx.flatPaths[0]
  if (!first) return
  ctx.onFocusPath(first)
  ctx.scrollToPath(first)
}

function handleEnd(ctx: KeyContext) {
  const last = ctx.flatPaths[ctx.flatPaths.length - 1]
  if (!last) return
  ctx.onFocusPath(last)
  ctx.scrollToPath(last)
}

function handleCopy(ctx: KeyContext) {
  if (!ctx.focusedPath) return
  const val = resolveValue(ctx.value, ctx.focusedPath)
  if (val !== undefined) {
    void navigator.clipboard.writeText(serializeValue(val))
  }
}

const KEY_HANDLERS: Record<
  string,
  (ctx: KeyContext, e: KeyboardEvent) => void
> = {
  ArrowDown: (ctx, e) => {
    e.preventDefault()
    ctx.moveFocus(1)
  },
  ArrowUp: (ctx, e) => {
    e.preventDefault()
    ctx.moveFocus(-1)
  },
  ArrowRight: (ctx, e) => {
    e.preventDefault()
    handleArrowRight(ctx)
  },
  ArrowLeft: (ctx, e) => {
    e.preventDefault()
    handleArrowLeft(ctx)
  },
  Enter: (ctx, e) => {
    e.preventDefault()
    handleEnter(ctx)
  },
  Home: (ctx, e) => {
    e.preventDefault()
    handleHome(ctx)
  },
  End: (ctx, e) => {
    e.preventDefault()
    handleEnd(ctx)
  },
  c: (ctx) => handleCopy(ctx),
}

export function JsonTree({
  value,
  expanded,
  onToggle,
  filter,
  allPaths,
  focusedPath,
  flatPaths,
  onFocusPath,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const rootType = getType(value)

  const scrollToPath = useCallback((p: string) => {
    const el = rootRef.current?.querySelector(`#jt-row-${CSS.escape(p)}`)
    el?.scrollIntoView({ block: "nearest" })
  }, [])

  const moveFocus = useCallback(
    (delta: number) => {
      if (flatPaths.length === 0) return
      const idx = focusedPath ? flatPaths.indexOf(focusedPath) : -1
      const next =
        idx === -1
          ? 0
          : Math.max(0, Math.min(flatPaths.length - 1, idx + delta))
      const p = flatPaths[next]
      if (!p) return
      onFocusPath(p)
      scrollToPath(p)
    },
    [flatPaths, focusedPath, onFocusPath, scrollToPath],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return
      const handler = KEY_HANDLERS[e.key]
      if (!handler) return
      handler(
        {
          focusedPath,
          value,
          expanded,
          flatPaths,
          moveFocus,
          onToggle,
          onFocusPath,
          scrollToPath,
        },
        e,
      )
    },
    [
      moveFocus,
      focusedPath,
      value,
      expanded,
      onToggle,
      onFocusPath,
      flatPaths,
      scrollToPath,
    ],
  )

  // Primitive root — render directly
  if (rootType !== "object" && rootType !== "array") {
    return (
      <div class="jt-root">
        <span class={`jt-value jt-${rootType}`}>{String(value)}</span>
      </div>
    )
  }

  const visible = computeVisiblePaths(allPaths, filter)
  const children = getChildren(value, "")
  const focusedId = focusedPath ? `jt-row-${focusedPath}` : undefined

  return (
    <div
      class="jt-root"
      role="tree"
      tabIndex={0}
      aria-activedescendant={focusedId}
      onKeyDown={handleKeyDown}
      ref={rootRef}
    >
      {children
        .filter((child) => !visible || visible.has(child.path))
        .map((child) => (
          <JsonNode
            key={child.path}
            info={child}
            depth={0}
            expanded={expanded}
            onToggle={onToggle}
            filter={filter}
            focusedPath={focusedPath}
            onFocusPath={onFocusPath}
          />
        ))}
    </div>
  )
}
