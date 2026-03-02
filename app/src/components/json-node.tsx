import { useCallback } from "preact/hooks"
import {
  getChildren,
  type JsonNodeInfo,
  type JsonValue,
  serializeValue,
} from "../lib/json-tree"

interface Props {
  info: JsonNodeInfo
  depth: number
  expanded: Set<string>
  onToggle: (path: string) => void
  filter: string
}

function ClipboardIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z" />
      <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
    </svg>
  )
}

function highlightKey(key: string, filter: string) {
  if (!filter) return key
  const lower = key.toLowerCase()
  const idx = lower.indexOf(filter.toLowerCase())
  if (idx === -1) return key
  return (
    <>
      {key.slice(0, idx)}
      <mark>{key.slice(idx, idx + filter.length)}</mark>
      {key.slice(idx + filter.length)}
    </>
  )
}

function ValueSpan({ value, type }: { value: JsonValue; type: string }) {
  if (type === "string") {
    return <span class="jt-value jt-string">"{String(value)}"</span>
  }
  return <span class={`jt-value jt-${type}`}>{String(value)}</span>
}

function containerSummary(
  type: "object" | "array",
  childCount: number,
  isEmpty: boolean,
  isOpen: boolean,
) {
  if (isEmpty) return type === "object" ? "{}" : "[]"
  if (isOpen) return type === "object" ? "{" : "["
  if (type === "object")
    return `{${childCount} key${childCount !== 1 ? "s" : ""}}`
  return `[${childCount} item${childCount !== 1 ? "s" : ""}]`
}

function Toggle({
  isContainer,
  isEmpty,
  isOpen,
  onToggle,
}: {
  isContainer: boolean
  isEmpty: boolean
  isOpen: boolean
  onToggle: () => void
}) {
  if (isContainer && !isEmpty) {
    return (
      <button type="button" class="jt-toggle" onClick={onToggle}>
        {isOpen ? "▼" : "▶"}
      </button>
    )
  }
  return <span class="jt-toggle jt-toggle--leaf" />
}

export function JsonNode({ info, depth, expanded, onToggle, filter }: Props) {
  const { path, key, value, type, childCount } = info
  const isContainer = type === "object" || type === "array"
  const isOpen = expanded.has(path)
  const isEmpty = isContainer && childCount === 0

  const handleToggle = useCallback(() => onToggle(path), [onToggle, path])

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(serializeValue(value))
  }, [value])

  const children =
    isContainer && isOpen && !isEmpty ? getChildren(value, path) : []

  return (
    <div class="jt-node">
      <div class="jt-row" style={{ paddingLeft: `${depth * 20}px` }}>
        <Toggle
          isContainer={isContainer}
          isEmpty={isEmpty}
          isOpen={isOpen}
          onToggle={handleToggle}
        />
        <span class="jt-key">{highlightKey(key, filter)}</span>
        <span class="jt-colon">: </span>
        {isContainer ? (
          <span class="jt-summary">
            {containerSummary(
              type as "object" | "array",
              childCount,
              isEmpty,
              isOpen,
            )}
          </span>
        ) : (
          <ValueSpan value={value} type={type} />
        )}
        <button
          type="button"
          class="jt-copy"
          onClick={handleCopy}
          title="Copy value"
        >
          <ClipboardIcon />
        </button>
      </div>
      {children.map((child) => (
        <JsonNode
          key={child.path}
          info={child}
          depth={depth + 1}
          expanded={expanded}
          onToggle={onToggle}
          filter={filter}
        />
      ))}
      {isContainer && isOpen && !isEmpty && (
        <div class="jt-row" style={{ paddingLeft: `${depth * 20}px` }}>
          <span class="jt-toggle jt-toggle--leaf" />
          <span class="jt-summary">{type === "object" ? "}" : "]"}</span>
        </div>
      )}
    </div>
  )
}
