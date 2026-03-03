import { renderGraphviz } from "../lib/graphviz-render"
import { DiagramView } from "./diagram-view"

export function GraphvizView({ content }: { content: string }) {
  return (
    <DiagramView
      content={content}
      render={renderGraphviz}
      label="Graphviz"
      class="graphviz-standalone"
    />
  )
}
