import bash from "devicon/icons/bash/bash-original.svg"
import cpp from "devicon/icons/cplusplus/cplusplus-original.svg"
import docker from "devicon/icons/docker/docker-original.svg"
import git from "devicon/icons/git/git-original.svg"
import python from "devicon/icons/python/python-original.svg"
import { render } from "preact"
import { afterEach, expect, it } from "vitest"
import { FileIcon } from "./file-icon"

const host = document.createElement("div")
afterEach(() => render(null, host))

it.each([
  ["kernel.cuh", cpp],
  ["kernel.CU", cpp],
  ["vector.hxx", cpp],
  ["vector.hh", cpp],
  ["vector.ipp", cpp],
  ["vector.tpp", cpp],
  ["types.pyi", python],
  [".bashrc", bash],
  [".zshrc", bash],
  [".gitconfig", git],
  ["Dockerfile.dev", docker],
  ["Containerfile.py", docker],
])("renders the icon for %s", (name, icon) => {
  render(<FileIcon name={name} isDir={false} />, host)
  expect(host.querySelector("img")?.getAttribute("src")).toBe(icon)
})
