import type { Root } from "mdast"
import type { Plugin } from "unified"
import type { VFile } from "vfile"

const BLOCK_TYPES = new Set([
  "mdxjsEsm",
  "mdxJsxFlowElement",
  "mdxFlowExpression",
])

const INLINE_TYPES = new Set(["mdxJsxTextElement", "mdxTextExpression"])

/**
 * Remark plugin that converts MDX AST nodes into standard mdast nodes.
 * Block-level JSX/imports/expressions become fenced code blocks (```tsx),
 * inline JSX/expressions become inline code. Reads source from the vfile
 * so the processor can be cached.
 */
export const remarkMdxToCode: Plugin<[], Root> = () => {
  return (tree: Root, file: VFile) => {
    const source = String(file)
    convertChildren(tree.children, source)
  }
}

function convertChildren(
  // biome-ignore lint/suspicious/noExplicitAny: MDX node types aren't in mdast
  children: any[],
  source: string,
): void {
  for (let i = 0; i < children.length; i++) {
    const node = children[i]

    if (BLOCK_TYPES.has(node.type)) {
      children[i] = {
        type: "code",
        lang: "tsx",
        value: extractSource(source, node),
        position: node.position,
      }
      continue
    }

    if (INLINE_TYPES.has(node.type)) {
      children[i] = {
        type: "inlineCode",
        value: extractSource(source, node),
        position: node.position,
      }
      continue
    }

    if (node.children) {
      convertChildren(node.children, source)
    }
  }
}

function extractSource(
  source: string,
  // biome-ignore lint/suspicious/noExplicitAny: MDX nodes have position but no shared type
  node: any,
): string {
  if (node.position) {
    return source.slice(node.position.start.offset, node.position.end.offset)
  }
  return node.value ?? ""
}
