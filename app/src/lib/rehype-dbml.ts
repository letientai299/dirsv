import { createRehypeDiagram } from "./rehype-diagram"

export const rehypeDbml = createRehypeDiagram({
  languages: ["dbml"],
  className: "dbml-placeholder",
  dataAttr: "data-dbml",
})
