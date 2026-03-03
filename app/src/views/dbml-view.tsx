import { renderDbml } from "../lib/dbml-render"
import { DiagramView } from "./diagram-view"

export function DbmlView({ content }: { content: string }) {
  return (
    <DiagramView
      content={content}
      render={renderDbml}
      label="DBML"
      class="dbml-standalone"
    />
  )
}
