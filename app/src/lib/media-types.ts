/** Image extensions without dot prefix (for file-icon lookups). */
export const IMAGE_EXTS = new Set([
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

/** Video extensions without dot prefix (for file-icon lookups). */
export const VIDEO_EXTS = new Set(["mp4", "webm", "ogg", "mov"])

/** Image extensions with dot prefix (for media-view matching). */
export const imageExts = new Set([...IMAGE_EXTS].map((e) => `.${e}`))

/** Video extensions with dot prefix (for media-view matching). */
export const videoExts = new Set([...VIDEO_EXTS].map((e) => `.${e}`))

function extsToRe(exts: Set<string>): RegExp {
  return new RegExp(`\\.(${[...exts].join("|")})$`, "i")
}

/** Regex matching image file extensions (derived from IMAGE_EXTS). */
export const imageRe = extsToRe(IMAGE_EXTS)

/** Regex matching video file extensions (derived from VIDEO_EXTS). */
export const videoRe = extsToRe(VIDEO_EXTS)
