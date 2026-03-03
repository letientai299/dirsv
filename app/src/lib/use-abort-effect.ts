import { useEffect } from "preact/hooks"

/** Runs `fn` with an AbortSignal and aborts on cleanup or dep change. */
export function useAbortEffect(
  fn: (signal: AbortSignal) => void,
  deps: unknown[],
): void {
  useEffect(() => {
    const controller = new AbortController()
    fn(controller.signal)
    return () => controller.abort()
    // biome-ignore lint/correctness/useExhaustiveDependencies: caller controls deps via the deps parameter
  }, deps)
}
