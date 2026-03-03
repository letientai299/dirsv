# Relative Link Tests

Test cases for SPA navigation and media rewriting. Every link on this page
should work without a full page reload (check the network tab — no document
requests).

## Same-directory links

- [Complex markdown](complex.md) — sibling file
- [Mermaid diagrams](all-mermaid.md) — sibling file
- [GraphViz](graphviz.md)
- [D2 diagrams](d2.md)
- [DBML](dbml.md)
- [PlantUML](plantuml.md)
- [Typst](typst.md)
- [GitLab-flavored](gitlab.md)

## Same-directory with ./

- [Complex (dot-slash)](./complex.md)
- [JSON file](./dummy.json)

## Parent traversal

- [README](../README.md) — go up one level

## Absolute path

- [Root README](/README.md) — absolute, no rewriting needed

## External links (should open normally)

- [GitHub](https://github.com)
- [Protocol-relative](//example.com)

## Anchor links (should scroll, not navigate)

- [Back to top](#relative-link-tests)
- [Same-directory links section](#same-directory-links)

## Images (rewritten to /api/raw/)

Globe GIF from the same directory:

![globe](globe.gif)

With `./` prefix:

![globe dot-slash](./globe.gif)

From parent `demo/` directory:

![dir view](../demo/dir-view.png)

## PDF

[Trusting Trust (PDF)](trusting-trust.pdf) — same-directory link to a PDF.

## Modifier-key test

Hold Cmd (Mac) or Ctrl (Windows) and click any relative link above — it should
open in a new tab instead of SPA-navigating.
