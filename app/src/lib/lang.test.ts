import { describe, expect, it } from "vitest"
import { langFromPath } from "./lang"

describe("langFromPath", () => {
  const cases: [path: string, expected: string][] = [
    ["/src/kernel.cu", "cpp"],
    ...[
      "cuh",
      "hpp",
      "hxx",
      "hh",
      "ipp",
      "tpp",
      "cc",
      "cxx",
      "cpp",
      "CUH",
      "HXX",
    ].map((ext): [string, string] => [`/src/kernel.${ext}`, "cpp"]),
    ["/src/types.pyi", "python"],
    ...[".bashrc", ".zshrc", ".bash_profile"].map((name): [string, string] => [
      `/home/${name}`,
      "shellscript",
    ]),
    ...[".gitconfig", ".gitmodules"].map((name): [string, string] => [
      `/repo/${name}`,
      "ini",
    ]),
    ...[
      "Dockerfile",
      "Containerfile",
      "Dockerfile.dev",
      "Containerfile.cuda",
      "dockerfile.prod",
      "cuda.dockerfile",
    ].map((name): [string, string] => [`/build/${name}`, "dockerfile"]),
    ["/src/CMakeLists.txt", "cmake"],
    ["/cmake/toolchain.cmake", "cmake"],
    ["/docs/paper.typ", "typst"],
  ]

  it.each(cases)("maps %s to %s", (path, expected) => {
    expect(langFromPath(path)).toBe(expected)
  })

  it.each(["Dockerfileish", "ContainerfileBackup", "Dockerfile."])(
    "does not match %s",
    (path) => {
      expect(langFromPath(path)).toBeUndefined()
    },
  )
})
