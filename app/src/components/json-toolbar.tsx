import type { JSX } from "preact"
import { useCallback } from "preact/hooks"

interface Props {
  filter: string
  onFilterChange: (value: string) => void
  onExpandAll: () => void
  onCollapseAll: () => void
  mode: "tree" | "raw"
  onModeChange: (mode: "tree" | "raw") => void
  treeDisabled?: boolean
}

export function JsonToolbar({
  filter,
  onFilterChange,
  onExpandAll,
  onCollapseAll,
  mode,
  onModeChange,
  treeDisabled,
}: Props) {
  const onFilterInput = useCallback(
    (e: JSX.TargetedInputEvent<HTMLInputElement>) => {
      onFilterChange((e.target as HTMLInputElement).value)
    },
    [onFilterChange],
  )
  const selectTree = useCallback(() => onModeChange("tree"), [onModeChange])
  const selectRaw = useCallback(() => onModeChange("raw"), [onModeChange])

  return (
    <div class="jt-toolbar">
      <input
        type="text"
        class="jt-filter"
        placeholder="Filter by key path..."
        value={filter}
        onInput={onFilterInput}
      />
      {mode === "tree" && (
        <>
          <button type="button" class="jt-btn" onClick={onExpandAll}>
            Expand All
          </button>
          <button type="button" class="jt-btn" onClick={onCollapseAll}>
            Collapse All
          </button>
        </>
      )}
      <div class="jt-tab-group">
        <button
          type="button"
          class={`jt-tab ${mode === "tree" ? "jt-tab--active" : ""}`}
          disabled={treeDisabled}
          onClick={selectTree}
        >
          Tree
        </button>
        <button
          type="button"
          class={`jt-tab ${mode === "raw" ? "jt-tab--active" : ""}`}
          onClick={selectRaw}
        >
          Raw
        </button>
      </div>
    </div>
  )
}
