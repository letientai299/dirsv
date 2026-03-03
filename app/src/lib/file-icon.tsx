/** Maps file extensions to Devicon SVG icons from CDN. */

const DEVICON_CDN = "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons"
const FILE_ICONS_CDN = "https://cdn.jsdelivr.net/gh/file-icons/icons@master/svg"

const SI = "https://cdn.simpleicons.org"

// Extensions with direct SVG URLs (not available in Devicon)
const EXT_URL_MAP: Record<string, string> = {
  toml: `${SI}/toml/9C4121`,
  editorconfig: `${SI}/editorconfig/000000`,
  sql: `${SI}/postgresql/4169E1`,
  graphql: `${SI}/graphql/E10098`,
  gql: `${SI}/graphql/E10098`,
  v: `${SI}/v/5D87BF`,
  proto: `${SI}/protobuf/4285F4`,
  mdx: `${SI}/mdx/F9AC00`,
  gv: `${FILE_ICONS_CDN}/GraphViz.svg`,
  dot: `${FILE_ICONS_CDN}/GraphViz.svg`,
  env: `${SI}/dotenv/ECD53F`,
  // Platform binaries
  exe: `${SI}/windows/0078D4`,
  msi: `${SI}/windows/0078D4`,
  dll: `${SI}/windows/0078D4`,
  dmg: `${SI}/apple/000000`,
  pkg: `${SI}/apple/000000`,
  app: `${SI}/apple/000000`,
  deb: `${SI}/debian/A81D33`,
  rpm: `${SI}/redhat/EE0000`,
  appimage: `${SI}/linux/FCC624`,
  snap: `${SI}/snapcraft/82BEA0`,
  flatpak: `${SI}/flatpak/4A90D9`,
}

// Extension → [deviconName, variant]
const EXT_MAP: Record<string, [string, string]> = {
  // Languages
  go: ["go", "original"],
  mod: ["go", "original"],
  sum: ["go", "original"],
  ts: ["typescript", "original"],
  tsx: ["typescript", "original"],
  js: ["javascript", "original"],
  jsx: ["javascript", "original"],
  mjs: ["javascript", "original"],
  cjs: ["javascript", "original"],
  mts: ["typescript", "original"],
  cts: ["typescript", "original"],
  py: ["python", "original"],
  rb: ["ruby", "original"],
  rs: ["rust", "original"],
  java: ["java", "original"],
  kt: ["kotlin", "original"],
  kts: ["kotlin", "original"],
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
  pl: ["perl", "original"],
  pm: ["perl", "original"],
  jl: ["julia", "original"],
  clj: ["clojure", "original"],
  cljs: ["clojure", "original"],
  erl: ["erlang", "original"],
  hrl: ["erlang", "original"],
  ml: ["ocaml", "original"],
  mli: ["ocaml", "original"],
  fs: ["fsharp", "original"],
  fsx: ["fsharp", "original"],
  m: ["objectivec", "plain"],
  groovy: ["groovy", "original"],
  nim: ["nim", "original"],
  cr: ["crystal", "original"],
  // Markup & data
  yml: ["yaml", "original"],
  yaml: ["yaml", "original"],
  json: ["json", "original"],
  xml: ["xml", "original"],
  md: ["markdown", "original"],
  html: ["html5", "original"],
  css: ["css3", "original"],
  scss: ["sass", "original"],
  sass: ["sass", "original"],
  less: ["less", "plain-wordmark"],
  tex: ["latex", "original"],
  // Web frameworks
  vue: ["vuejs", "original"],
  svelte: ["svelte", "original"],
  astro: ["astro", "original"],
  // Shell & infra
  sh: ["bash", "original"],
  bash: ["bash", "original"],
  zsh: ["bash", "original"],
  ps1: ["powershell", "original"],
  gradle: ["gradle", "original"],
  // Git
  gitignore: ["git", "original"],
  gitattributes: ["git", "original"],
  gitmodules: ["git", "original"],
  // Containers & infra
  dockerfile: ["docker", "original"],
  tf: ["terraform", "original"],
  nix: ["nixos", "original"],
}

// Special full-filename matches (case-insensitive)
const NAME_MAP: Record<string, [string, string] | string> = {
  dockerfile: ["docker", "original"],
  "docker-compose.yml": ["docker", "original"],
  "docker-compose.yaml": ["docker", "original"],
  makefile: ["cmake", "original"],
  "cmakelists.txt": ["cmake", "original"],
  gemfile: `${SI}/rubygems/E9573F`,
  "gemfile.lock": `${SI}/rubygems/E9573F`,
  "pom.xml": `${SI}/apachemaven/C71A36`,
  ".npmrc": `${SI}/npm/CB3837`,
  ".nvmrc": `${SI}/nodedotjs/5FA04E`,
  ".node-version": `${SI}/nodedotjs/5FA04E`,
  "package.json": `${SI}/npm/CB3837`,
  "package-lock.json": `${SI}/npm/CB3837`,
  "yarn.lock": `${SI}/yarn/2C8EBB`,
  ".yarnrc.yml": `${SI}/yarn/2C8EBB`,
  "pnpm-lock.yaml": `${SI}/pnpm/F69220`,
  ".prettierrc": `${SI}/prettier/F7B93E`,
  "prettier.config.js": `${SI}/prettier/F7B93E`,
  "prettier.config.ts": `${SI}/prettier/F7B93E`,
  "prettier.config.mjs": `${SI}/prettier/F7B93E`,
  ".babelrc": `${SI}/babel/F9DC3E`,
  "babel.config.js": `${SI}/babel/F9DC3E`,
  "nginx.conf": `${SI}/nginx/009639`,
  "requirements.txt": ["python", "original"],
  "pyproject.toml": ["python", "original"],
  pipfile: ["python", "original"],
  "pipfile.lock": ["python", "original"],
  "cargo.toml": ["rust", "original"],
  "cargo.lock": ["rust", "original"],
  "go.mod": ["go", "original"],
  "go.sum": ["go", "original"],
  "tsconfig.json": ["typescript", "original"],
  "biome.json": `${SI}/biome/60A5FA`,
  "biome.jsonc": `${SI}/biome/60A5FA`,
  "bun.lock": `${SI}/bun/000000`,
  "bun.lockb": `${SI}/bun/000000`,
}

function deviconUrl(name: string, variant: string): string {
  return `${DEVICON_CDN}/${name}/${name}-${variant}.svg`
}

function resolveExt(fileName: string): string | null {
  const lower = fileName.toLowerCase()
  return lower.includes(".") ? (lower.split(".").pop() ?? null) : null
}

// Prefix → icon URL for config files with variable extensions (e.g. eslint.config.*)
const PREFIX_MAP: Record<string, string> = {
  "eslint.config.": `${SI}/eslint/4B32C3`,
  ".eslintrc": `${SI}/eslint/4B32C3`,
  "prettier.config.": `${SI}/prettier/F7B93E`,
  ".prettierrc": `${SI}/prettier/F7B93E`,
  "babel.config.": `${SI}/babel/F9DC3E`,
}

function resolve(fileName: string): [string, string] | string | null {
  const lower = fileName.toLowerCase()
  const nameMatch = NAME_MAP[lower]
  if (nameMatch) return nameMatch

  for (const prefix in PREFIX_MAP) {
    if (lower.startsWith(prefix)) return PREFIX_MAP[prefix] ?? null
  }

  const ext = resolveExt(lower)
  if (ext) {
    const urlMatch = EXT_URL_MAP[ext]
    if (urlMatch) return urlMatch

    const extMatch = EXT_MAP[ext]
    if (extMatch) return extMatch
  }

  return null
}

// Inline Octicon SVGs for folder, generic file, and parent navigation.
export const FolderIcon = () => FOLDER_SVG

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

// Octicon image icon for image files.
const IMAGE_EXTS = new Set([
  "apng",
  "avif",
  "bmp",
  "gif",
  "ico",
  "jpeg",
  "jpg",
  "png",
  "svg",
  "webp",
])

const IMAGE_SVG = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M16 13.25A1.75 1.75 0 0 1 14.25 15H1.75A1.75 1.75 0 0 1 0 13.25V2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75ZM1.75 2.5a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h.94l3.88-6.46a1.25 1.25 0 0 1 2.14 0L9.44 8.75l.97-1.617a1.25 1.25 0 0 1 2.14 0L15.5 12.1V2.75a.25.25 0 0 0-.25-.25ZM.94 14.5h4.08L2.34 9.843a.25.25 0 0 0-.428 0Zm5.52 0h4.08L8.5 11.102 6.888 13.788Zm5.52 0h3.08l-2.68-4.467a.25.25 0 0 0-.428 0Z" />
  </svg>
)

// Octicon video icon for video files.
const VIDEO_EXTS = new Set(["mp4", "webm", "ogg", "mov"])

const VIDEO_SVG = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M0 3.75C0 2.784.784 2 1.75 2h12.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0 1 14.25 14H1.75A1.75 1.75 0 0 1 0 12.25Zm1.75-.25a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25v-8.5a.25.25 0 0 0-.25-.25ZM6 10.559V5.442a.25.25 0 0 1 .379-.215l4.264 2.559a.25.25 0 0 1 0 .428L6.379 10.774A.25.25 0 0 1 6 10.559Z" />
  </svg>
)

// Octicon terminal icon for extensionless executables.
const EXEC_SVG = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M0 2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 14.25 15H1.75A1.75 1.75 0 0 1 0 13.25Zm1.75-.25a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V2.75a.25.25 0 0 0-.25-.25ZM7.25 8a.749.749 0 0 1-.22.53l-2.25 2.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L5.44 8 3.72 6.28a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215l2.25 2.25c.141.14.22.331.22.53Zm1.5 1.5h3a.75.75 0 0 1 0 1.5h-3a.75.75 0 0 1 0-1.5Z" />
  </svg>
)

/** Returns the appropriate icon element for a directory entry. */
export function FileIcon({
  name,
  isDir,
  isExec,
}: {
  name: string
  isDir: boolean
  isExec?: boolean
}) {
  if (isDir) return FOLDER_SVG

  const match = resolve(name)
  if (!match) {
    if (isExec) return EXEC_SVG
    const ext = resolveExt(name)
    if (ext && IMAGE_EXTS.has(ext)) return IMAGE_SVG
    if (ext && VIDEO_EXTS.has(ext)) return VIDEO_SVG
    return FILE_SVG
  }

  const src = typeof match === "string" ? match : deviconUrl(match[0], match[1])
  return (
    <img
      src={src}
      width={16}
      height={16}
      alt=""
      aria-hidden="true"
      loading="lazy"
    />
  )
}
