import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks"
import { AppFooter } from "../components/app-footer"
import { Toolbar } from "../components/toolbar"
import { browse, type DirEntry } from "../lib/api"
import { FileIcon, ParentIcon } from "../lib/file-icon"
import { formatSize } from "../lib/format"
import { getHighlightDuration } from "../lib/highlight-config"
import { parentOf, watchPrefix } from "../lib/path"
import { goToParent, listNavShortcuts } from "../lib/shortcuts"
import { useListKeys } from "../lib/use-list-keys"
import type { BoundShortcut } from "../lib/use-shortcuts"
import { useShortcuts } from "../lib/use-shortcuts"
import { useWS } from "../lib/use-ws"

interface Props {
  path: string
  entries: DirEntry[]
  onNavigate: (to: string) => void
}

const dateFmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: "short",
  timeStyle: "short",
})

function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso))
}

export function DirView({ path, entries: initialEntries, onNavigate }: Props) {
  const [entries, setEntries] = useState(initialEntries)
  const [addedNames, setAddedNames] = useState<Set<string>>(new Set())
  const [changedNames, setChangedNames] = useState<Set<string>>(new Set())
  const [deletedNames, setDeletedNames] = useState<Set<string>>(new Set())
  const prevEntriesRef = useRef<DirEntry[]>(initialEntries)

  // Sync local entries when the parent provides a new listing (e.g. dir→dir navigation).
  useEffect(() => {
    setEntries(initialEntries)
    prevEntriesRef.current = initialEntries
    setAddedNames(new Set())
    setChangedNames(new Set())
    setDeletedNames(new Set())
  }, [initialEntries])

  const scrollRef = useRef<HTMLDivElement>(null)
  useListKeys(scrollRef, "a")

  // Auto-focus the first link on path change so j/k work immediately
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional focus on path change
  useEffect(() => {
    scrollRef.current?.querySelector<HTMLElement>("a")?.focus()
  }, [path])

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const refresh = useCallback(() => {
    browse(path)
      .then((res) => {
        if (res.type !== "dir") return
        for (const t of timersRef.current) clearTimeout(t)
        timersRef.current = []

        const prev = prevEntriesRef.current
        const oldNames = new Set(prev.map((e) => e.name))
        const newNames = new Set(res.entries.map((e) => e.name))

        const added = new Set(
          res.entries.filter((e) => !oldNames.has(e.name)).map((e) => e.name),
        )
        const deleted = new Set(
          prev.filter((e) => !newNames.has(e.name)).map((e) => e.name),
        )
        const oldMap = new Map(prev.map((e) => [e.name, e]))
        const changed = new Set(
          res.entries
            .filter((e) => {
              const old = oldMap.get(e.name)
              return old && (old.size !== e.size || old.modTime !== e.modTime)
            })
            .map((e) => e.name),
        )

        const merged = mergeWithDeleted(prev, res.entries, deleted)

        setEntries(merged)
        setAddedNames(added)
        setChangedNames(changed)
        setDeletedNames(deleted)
        prevEntriesRef.current = res.entries

        const ms = getHighlightDuration()
        // Deleted entries collapse at half-duration; remove them from DOM after.
        timersRef.current.push(
          setTimeout(() => {
            setDeletedNames(new Set())
            setEntries(res.entries)
          }, ms / 2),
          setTimeout(() => {
            setAddedNames(new Set())
            setChangedNames(new Set())
          }, ms),
        )
      })
      .catch(() => {
        // Silently ignore — directory may be inaccessible after rename/delete.
      })
  }, [path])

  useWS(watchPrefix(path), refresh)

  const parentPath = path === "/" ? null : parentOf(path)

  const shortcuts = useMemo<BoundShortcut[]>(
    () => [
      {
        def: goToParent,
        action(e) {
          if (!parentPath) return
          e.preventDefault()
          onNavigate(parentPath)
        },
      },
    ],
    [parentPath, onNavigate],
  )

  const defs = useShortcuts(shortcuts)

  return (
    <div class="dir-layout">
      <Toolbar path={path} shortcuts={[...defs, ...listNavShortcuts]} />
      <hr class="file-separator" />
      <div class="dir-scroll" ref={scrollRef}>
        <table class="dir-table">
          <thead>
            <tr>
              <th>Name</th>
              <th class="col-size">Size</th>
              <th>Modified</th>
            </tr>
          </thead>
          <tbody>
            {parentPath && (
              <tr>
                <td>
                  <a
                    rel="up"
                    href={parentPath}
                    onClick={(e) => {
                      e.preventDefault()
                      onNavigate(parentPath)
                    }}
                  >
                    <span class="entry-icon">
                      <ParentIcon />
                    </span>
                    ..
                  </a>
                </td>
                <td class="col-size" />
                <td class="col-date" />
              </tr>
            )}
            {entries.map((entry) => {
              const href = `${path}${entry.name}`
              const cls = entryClass(
                entry.name,
                deletedNames,
                addedNames,
                changedNames,
              )
              return (
                <tr key={entry.name} class={cls}>
                  <td>
                    <a
                      href={href}
                      onClick={(e) => {
                        e.preventDefault()
                        onNavigate(href)
                      }}
                    >
                      <span
                        class={`entry-icon${entry.isDir ? " entry-icon--folder" : ""}`}
                      >
                        <FileIcon
                          name={entry.name}
                          isDir={entry.isDir}
                          isExec={entry.isExec ?? false}
                        />
                      </span>
                      {entry.name}
                      {entry.isDir ? "/" : ""}
                    </a>
                  </td>
                  <td class="col-size">
                    {entry.isDir ? "\u2013" : formatSize(entry.size)}
                  </td>
                  <td class="col-date">{formatDate(entry.modTime)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <AppFooter />
    </div>
  )
}

/**
 * Merge new entries with deleted entries kept at their original position.
 * For each deleted entry, finds the next surviving entry in `prev` and
 * inserts the deleted entry before it in the merged result.
 */
function mergeWithDeleted(
  prev: DirEntry[],
  next: DirEntry[],
  deleted: Set<string>,
): DirEntry[] {
  if (deleted.size === 0) return next

  const nextNames = new Set(next.map((e) => e.name))
  const insertBefore = new Map<string, DirEntry[]>()
  const atEnd: DirEntry[] = []

  for (let i = 0; i < prev.length; i++) {
    const entry = prev[i]
    if (!entry || !deleted.has(entry.name)) continue
    const anchor = findAnchor(prev, i + 1, nextNames)
    if (anchor) {
      const list = insertBefore.get(anchor) ?? []
      list.push(entry)
      insertBefore.set(anchor, list)
    } else {
      atEnd.push(entry)
    }
  }

  const merged: DirEntry[] = []
  for (const entry of next) {
    const before = insertBefore.get(entry.name)
    if (before) merged.push(...before)
    merged.push(entry)
  }
  merged.push(...atEnd)
  return merged
}

/** Find the name of the first entry from `start` onward that exists in `alive`. */
function findAnchor(
  prev: DirEntry[],
  start: number,
  alive: Set<string>,
): string {
  for (let j = start; j < prev.length; j++) {
    const e = prev[j]
    if (e && alive.has(e.name)) return e.name
  }
  return ""
}

function entryClass(
  name: string,
  deleted: Set<string>,
  added: Set<string>,
  changed: Set<string>,
): string {
  if (deleted.has(name)) return "entry-deleted"
  if (added.has(name)) return "entry-added"
  if (changed.has(name)) return "changed"
  return ""
}
