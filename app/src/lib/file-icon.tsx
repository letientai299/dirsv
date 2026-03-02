/** Maps file extensions to Devicon SVG icons from CDN. */

const DEVICON_CDN = "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons"

// Extension → [deviconName, variant]
const EXT_MAP: Record<string, [string, string]> = {
  go: ["go", "original"],
  mod: ["go", "original"],
  sum: ["go", "original"],
  ts: ["typescript", "original"],
  tsx: ["typescript", "original"],
  js: ["javascript", "original"],
  jsx: ["javascript", "original"],
  py: ["python", "original"],
  rb: ["ruby", "original"],
  rs: ["rust", "original"],
  java: ["java", "original"],
  kt: ["kotlin", "original"],
  swift: ["swift", "original"],
  php: ["php", "original"],
  c: ["c", "original"],
  h: ["c", "original"],
  cpp: ["cplusplus", "original"],
  cs: ["csharp", "original"],
  lua: ["lua", "original"],
  dart: ["dart", "original"],
  zig: ["zig", "original"],
  ex: ["elixir", "original"],
  exs: ["elixir", "original"],
  hs: ["haskell", "original"],
  scala: ["scala", "original"],
  r: ["r", "original"],
  yml: ["yaml", "original"],
  yaml: ["yaml", "original"],
  toml: ["toml", "original"],
  json: ["json", "original"],
  xml: ["xml", "original"],
  md: ["markdown", "original"],
  html: ["html5", "original"],
  css: ["css3", "original"],
  scss: ["sass", "original"],
  sass: ["sass", "original"],
  sh: ["bash", "original"],
  bash: ["bash", "original"],
  zsh: ["bash", "original"],
  ps1: ["powershell", "original"],
  gitignore: ["git", "original"],
  gitattributes: ["git", "original"],
  gitmodules: ["git", "original"],
  dockerfile: ["docker", "original"],
  tf: ["terraform", "original"],
  nix: ["nixos", "original"],
  vue: ["vuejs", "original"],
  svelte: ["svelte", "original"],
}

// Special full-filename matches (case-insensitive)
const NAME_MAP: Record<string, [string, string]> = {
  dockerfile: ["docker", "original"],
  "docker-compose.yml": ["docker", "original"],
  "docker-compose.yaml": ["docker", "original"],
  makefile: ["cmake", "original"],
}

function deviconUrl(name: string, variant: string): string {
  return `${DEVICON_CDN}/${name}/${name}-${variant}.svg`
}

function resolve(fileName: string): [string, string] | null {
  const lower = fileName.toLowerCase()
  const match = NAME_MAP[lower]
  if (match) return match

  // Strip leading dot for dotfiles like .gitignore → gitignore
  const stripped = lower.startsWith(".") ? lower.slice(1) : null
  if (stripped) {
    const dotMatch = EXT_MAP[stripped]
    if (dotMatch) return dotMatch
  }

  const ext = lower.includes(".") ? lower.split(".").pop() : null
  if (ext) {
    const extMatch = EXT_MAP[ext]
    if (extMatch) return extMatch
  }

  return null
}

// Inline Octicon SVGs for folder, generic file, and parent navigation.
const FOLDER_SVG = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75Z" />
  </svg>
)

const FILE_SVG = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z" />
  </svg>
)

export function ParentIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M3.22 9.78a.749.749 0 0 1 0-1.06l4.25-4.25a.749.749 0 0 1 1.06 0l4.25 4.25a.749.749 0 1 1-1.06 1.06L8 6.06 4.28 9.78a.749.749 0 0 1-1.06 0Z" />
    </svg>
  )
}

/** Returns the appropriate icon element for a directory entry. */
export function FileIcon({ name, isDir }: { name: string; isDir: boolean }) {
  if (isDir) return FOLDER_SVG

  const match = resolve(name)
  if (!match) return FILE_SVG

  const [iconName, variant] = match
  return (
    <img
      src={deviconUrl(iconName, variant)}
      width={16}
      height={16}
      alt=""
      aria-hidden="true"
      loading="lazy"
    />
  )
}
