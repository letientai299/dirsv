import { createRehypeDiagram } from "./rehype-diagram"

export const rehypeTypstDiagram = createRehypeDiagram({
  languages: ["typst"],
  className: "typst-placeholder",
  dataAttr: "data-typst",
})
