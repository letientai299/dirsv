import {
  computeVisiblePaths,
  getChildren,
  getType,
  type JsonValue,
} from "../lib/json-tree"
import { JsonNode } from "./json-node"

interface Props {
  value: JsonValue
  expanded: Set<string>
  onToggle: (path: string) => void
  filter: string
  allPaths: Set<string>
}

export function JsonTree({
  value,
  expanded,
  onToggle,
  filter,
  allPaths,
}: Props) {
  const rootType = getType(value)

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

  return (
    <div class="jt-root">
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
          />
        ))}
    </div>
  )
}
