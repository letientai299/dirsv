package watcher

// skippedDirs lists directories that contain only generated or managed
// content and should never be watched for file-system changes. Each
// entry is a directory base name (not a path).
var skippedDirs = map[string]struct{}{
	// Version control
	".git": {},

	// Node.js / JavaScript
	"node_modules":  {},
	".next":         {}, // Next.js build output
	".nuxt":         {}, // Nuxt build output
	".output":       {}, // Nuxt/Nitro output
	".svelte-kit":   {}, // SvelteKit generated
	".expo":         {}, // Expo (React Native) cache
	".parcel-cache": {}, // Parcel bundler cache
	".angular":      {}, // Angular CLI cache
	".turbo":        {}, // Turborepo cache
	".wireit":       {}, // Wireit cache

	// Go / PHP / Ruby
	"vendor": {}, // vendored dependencies

	// Python
	"__pycache__":   {}, // bytecode cache
	".mypy_cache":   {}, // mypy cache
	".pytest_cache": {}, // pytest cache
	".ruff_cache":   {}, // Ruff linter cache
	"venv":          {}, // virtual environment
	".venv":         {}, // virtual environment
	".tox":          {}, // tox test runner

	// Rust / Java / Scala
	"target": {}, // build output

	// Dart / Flutter
	".dart_tool":       {}, // Dart tooling
	".flutter-plugins": {}, // Flutter generated

	// iOS / Swift
	"Pods":     {}, // CocoaPods dependencies
	".swiftpm": {}, // Swift Package Manager

	// Android / JVM
	".gradle": {}, // Gradle cache

	// .NET
	"obj": {}, // build intermediates
	"bin": {}, // build output

	// Zig
	".zig-cache": {}, // build cache

	// IDE / editor
	".idea":   {}, // JetBrains
	".vscode": {}, // VS Code
	".fleet":  {}, // Fleet

	// Generic build output / caches
	"dist":   {}, // common build output
	"build":  {}, // common build output
	"out":    {}, // common build output
	".cache": {}, // generic caches (Turborepo, Prettier, etc.)
}

// shouldSkipDir reports whether a directory should be excluded from watching.
func shouldSkipDir(name string) bool {
	_, ok := skippedDirs[name]
	return ok
}
