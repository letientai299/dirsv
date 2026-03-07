import { createRehypeDiagram } from "./rehype-diagram"

export const rehypeMermaid = createRehypeDiagram({
  languages: ["mermaid"],
  className: "mermaid-placeholder",
  dataAttr: "data-mermaid",
})
