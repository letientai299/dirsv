/** Map file extensions to Shiki language IDs. */
const extMap: Record<string, string> = {
  // Web
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",
  vue: "vue",
  svelte: "svelte",
  astro: "astro",

  // Data / config
  json: "json",
  jsonc: "jsonc",
  json5: "json5",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  xml: "xml",
  csv: "csv",
  ini: "ini",
  env: "dotenv",
  properties: "properties",

  // Systems
  go: "go",
  rs: "rust",
  c: "c",
  h: "c",
  cpp: "cpp",
  cxx: "cpp",
  cc: "cpp",
  hpp: "cpp",
  zig: "zig",

  // Scripting
  py: "python",
  rb: "ruby",
  php: "php",
  lua: "lua",
  pl: "perl",
  pm: "perl",
  r: "r",
  jl: "julia",
  ex: "elixir",
  exs: "elixir",
  erl: "erlang",
  clj: "clojure",
  hs: "haskell",
  scala: "scala",
  kt: "kotlin",
  kts: "kotlin",
  swift: "swift",
  dart: "dart",
  groovy: "groovy",
  nim: "nim",

  // JVM
  java: "java",
  gradle: "groovy",

  // Shell
  sh: "shellscript",
  bash: "shellscript",
  zsh: "shellscript",
  fish: "fish",
  ps1: "powershell",
  psm1: "powershell",
  bat: "bat",
  cmd: "bat",

  // Markup / docs
  tex: "latex",
  latex: "latex",
  rst: "rst",

  // DevOps / config
  dockerfile: "dockerfile",
  tf: "hcl",
  hcl: "hcl",
  nix: "nix",
  proto: "protobuf",
  graphql: "graphql",
  gql: "graphql",

  // SQL
  sql: "sql",

  // Misc
  diff: "diff",
  patch: "diff",
  log: "log",
  makefile: "makefile",
  mk: "makefile",
  cmake: "cmake",
}

/** Well-known filenames without extensions. */
const nameMap: Record<string, string> = {
  Makefile: "makefile",
  CMakeLists: "cmake",
  Dockerfile: "dockerfile",
  Containerfile: "dockerfile",
  Vagrantfile: "ruby",
  Rakefile: "ruby",
  Gemfile: "ruby",
  Justfile: "just",
  ".gitignore": "gitignore",
  ".gitattributes": "gitignore",
  ".editorconfig": "ini",
  ".env": "dotenv",
  ".env.local": "dotenv",
  ".env.example": "dotenv",
}

/**
 * Detect a Shiki language ID from a file path.
 * Returns undefined when no match is found (caller should fall back to plaintext).
 */
export function langFromPath(path: string): string | undefined {
  const basename = path.split("/").pop() ?? path

  // Check exact filename first (Makefile, Dockerfile, etc.)
  if (nameMap[basename]) return nameMap[basename]

  // .env.* variants (.env.production, .env.staging, etc.)
  if (basename.startsWith(".env")) return "dotenv"

  // Grab the last extension segment
  const ext = basename.includes(".")
    ? basename.split(".").pop()?.toLowerCase()
    : undefined

  return ext ? extMap[ext] : undefined
}
