import { useEffect, useState } from "preact/hooks"
import { renderMarkdown } from "../lib/markdown"

interface Props {
	path: string
	content: string
}

export function MarkdownView({ path, content }: Props) {
	const [html, setHtml] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		setHtml(null)
		setError(null)
		renderMarkdown(content)
			.then(setHtml)
			.catch((err: Error) => setError(err.message))
	}, [content])

	if (error) return <div class="error">Render error: {error}</div>
	if (html === null) return <div class="loading">Rendering...</div>

	return (
		<div>
			<h1>{path}</h1>
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized by remarkRehype (no allowDangerousHtml) */}
			<div dangerouslySetInnerHTML={{ __html: html }} />
		</div>
	)
}
