import { createRehypeDiagram } from "./rehype-diagram"

export const rehypeGraphviz = createRehypeDiagram({
  languages: ["graphviz", "dot"],
  className: "graphviz-placeholder",
  dataAttr: "data-graphviz",
})
