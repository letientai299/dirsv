declare module "asciinema-player" {
  interface Player {
    dispose(): void
    play(): Promise<void>
    pause(): Promise<void>
    seek(time: number): Promise<void>
    getCurrentTime(): Promise<number>
    getDuration(): Promise<number>
  }

  interface CreateOptions {
    fit?: "width" | "height" | "both" | false | "none"
    autoPlay?: boolean
    preload?: boolean
    loop?: boolean | number
    startAt?: number | string
    speed?: number
    idleTimeLimit?: number
    theme?: string
    poster?: string
    cols?: number
    rows?: number
    terminalFontSize?: string
    terminalFontFamily?: string
    terminalLineHeight?: number
    logger?: Console
  }

  type Source = string | { data: string | (() => string | Promise<string>) }

  function create(
    source: Source,
    container: HTMLElement,
    options?: CreateOptions,
  ): Player

  export { create, type Player, type CreateOptions, type Source }
}

declare module "asciinema-player/dist/bundle/asciinema-player.css"
