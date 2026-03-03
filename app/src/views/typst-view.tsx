import { renderTypst } from "../lib/typst-render"
import { DiagramView } from "./diagram-view"

export function TypstView({ content }: { content: string }) {
  return (
    <DiagramView
      content={content}
      render={renderTypst}
      label="Typst"
      class="typst-standalone"
    />
  )
}
