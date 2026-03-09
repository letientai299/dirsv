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
  styl: "stylus",
  vue: "vue",
  svelte: "svelte",
  astro: "astro",
  mdx: "mdx",
  coffee: "coffeescript",

  // Web templates
  pug: "pug",
  jade: "pug",
  hbs: "handlebars",
  liquid: "liquid",
  twig: "twig",
  erb: "erb",
  cshtml: "razor",
  razor: "razor",
  j2: "jinja",
  jinja: "jinja",
  marko: "marko",

  // Data / config
  json: "json",
  jsonc: "jsonc",
  json5: "json5",
  jsonl: "jsonl",
  hjson: "hjson",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  xml: "xml",
  csv: "csv",
  ini: "ini",
  env: "dotenv",
  properties: "properties",
  prisma: "prisma",
  kdl: "kdl",
  ron: "ron",
  pkl: "pkl",
  cue: "cue",
  jsonnet: "jsonnet",

  // Systems
  go: "go",
  rs: "rust",
  c: "c",
  h: "c",
  cpp: "cpp",
  cxx: "cpp",
  cc: "cpp",
  hpp: "cpp",
  cs: "csharp",
  csx: "csharp",
  m: "objective-c",
  mm: "objective-cpp",
  zig: "zig",
  cr: "crystal",
  d: "d",
  asm: "asm",
  s: "asm",
  f90: "fortran-free-form",
  f95: "fortran-free-form",
  f03: "fortran-free-form",
  pas: "pascal",
  ada: "ada",
  odin: "odin",
  vala: "vala",
  haxe: "haxe",

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
  hrl: "erlang",
  clj: "clojure",
  cljs: "clojure",
  hs: "haskell",
  scala: "scala",
  kt: "kotlin",
  kts: "kotlin",
  swift: "swift",
  dart: "dart",
  groovy: "groovy",
  nim: "nim",
  v: "v",
  gleam: "gleam",
  mojo: "mojo",
  nu: "nushell",
  tcl: "tcl",
  gd: "gdscript",

  // Functional / ML
  ml: "ocaml",
  mli: "ocaml",
  fs: "fsharp",
  fsx: "fsharp",
  elm: "elm",
  purs: "purescript",
  lisp: "common-lisp",
  scm: "scheme",
  ss: "scheme",
  rkt: "racket",
  el: "emacs-lisp",
  fennel: "fennel",

  // JVM / .NET
  java: "java",
  gradle: "groovy",
  vb: "vb",

  // Shell
  sh: "shellscript",
  bash: "shellscript",
  zsh: "shellscript",
  fish: "fish",
  ps1: "powershell",
  psm1: "powershell",
  bat: "bat",
  cmd: "bat",
  awk: "awk",

  // Markup / docs
  tex: "latex",
  latex: "latex",
  rst: "rst",

  // DevOps / config
  dockerfile: "dockerfile",
  tf: "hcl",
  tfvars: "tfvars",
  hcl: "hcl",
  nix: "nix",
  bicep: "bicep",
  pp: "puppet",
  just: "just",
  proto: "protobuf",
  graphql: "graphql",
  gql: "graphql",

  // SQL
  sql: "sql",

  // Smart contracts
  sol: "solidity",
  move: "move",
  vy: "vyper",

  // GPU / shaders
  glsl: "glsl",
  vert: "glsl",
  frag: "glsl",
  hlsl: "hlsl",
  wgsl: "wgsl",

  // Hardware description
  sv: "system-verilog",
  vhd: "vhdl",
  vhdl: "vhdl",

  // Legacy
  cbl: "cobol",
  cob: "cobol",

  // Misc
  diff: "diff",
  patch: "diff",
  log: "log",
  http: "http",
  vim: "vimscript",
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
