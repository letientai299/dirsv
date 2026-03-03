import { renderD2 } from "../lib/d2-render"
import { DiagramView } from "./diagram-view"

export function D2View({ content }: { content: string }) {
  return (
    <DiagramView
      content={content}
      render={renderD2}
      label="D2"
      class="d2-standalone"
    />
  )
}
