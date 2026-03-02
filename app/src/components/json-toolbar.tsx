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
  return (
    <div class="jt-toolbar">
      <input
        type="text"
        class="jt-filter"
        placeholder="Filter by key path..."
        value={filter}
        onInput={(e) => onFilterChange((e.target as HTMLInputElement).value)}
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
          onClick={() => onModeChange("tree")}
        >
          Tree
        </button>
        <button
          type="button"
          class={`jt-tab ${mode === "raw" ? "jt-tab--active" : ""}`}
          onClick={() => onModeChange("raw")}
        >
          Raw
        </button>
      </div>
    </div>
  )
}
