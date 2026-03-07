import { createRehypeDiagram } from "./rehype-diagram"

export const rehypePlantuml = createRehypeDiagram({
  languages: ["plantuml"],
  className: "plantuml-placeholder",
  dataAttr: "data-plantuml",
})
