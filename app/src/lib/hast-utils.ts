import type { Element } from "hast"

export function getClassList(node: Element): string[] {
  const val = node.properties?.["className"]
  return Array.isArray(val) ? (val as string[]) : []
}
