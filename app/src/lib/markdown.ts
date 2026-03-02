import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeShiki from "@shikijs/rehype";

let processorPromise: ReturnType<typeof createProcessor> | null = null;

async function createProcessor() {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeShiki, {
      theme: "github-dark",
    })
    .use(rehypeStringify);
}

export async function renderMarkdown(source: string): Promise<string> {
  if (!processorPromise) {
    processorPromise = createProcessor();
  }
  const processor = await processorPromise;
  const result = await processor.process(source);
  return String(result);
}
