import rehypeShiki from "@shikijs/rehype"
import rehypeStringify from "rehype-stringify"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { unified } from "unified"

let processorPromise: ReturnType<typeof createProcessor> | null = null

async function createProcessor() {
	return (
		unified()
			.use(remarkParse)
			.use(remarkGfm)
			// SECURITY: remarkRehype without allowDangerousHtml strips raw HTML from
			// markdown source, preventing XSS. Do not add allowDangerousHtml without
			// also adding rehype-sanitize.
			.use(remarkRehype)
			.use(rehypeShiki, {
				theme: "github-dark",
			})
			.use(rehypeStringify)
	)
}

export async function renderMarkdown(source: string): Promise<string> {
	if (!processorPromise) {
		processorPromise = createProcessor()
	}
	// biome-ignore lint/nursery/useAwaitThenable: processorPromise is a Promise after the null-guard above
	const processor = await processorPromise
	const result = await processor.process(source)
	return String(result)
}
