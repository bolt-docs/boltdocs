/**
 * Abort-related utilities for the Ask AI client.
 *
 * The streaming reader relies on a cancellable fetch + stream so that the
 * user ("Stop") or the UI ("close while streaming") can halt an in-flight
 * request. The native `AbortController` gives us a real `AbortSignal` to pass
 * to `fetch`, but it is a very recent platform API. On environments where it
 * is missing we fall back to a cooperative flag + `reader.cancel()` so that
 * cancellation (and the component) never crashes. Everything here is
 * side-effect safe and must never throw.
 */

/**
 * Minimal stream-abort surface used across the fetch signal and the SSE
 * reader. `signal` is only provided when the host exposes a native
 * `AbortController`; otherwise cancellation is driven by `attachReader` +
 * `abort()`.
 */
export interface ClientController {
  /** Native `AbortSignal` for `fetch`, or `undefined` when unsupported. */
  signal?: AbortSignal
  /** Whether `abort()` has been called. */
  readonly aborted: boolean
  /** Registers the active stream reader so `abort()` can cancel it. */
  attachReader(reader: { cancel?: () => void } | null): void
  /** Requests cancellation. Safe to call more than once and when idle. */
  abort(): void
}

interface Cancellable {
  cancel?: () => void
}

/**
 * Creates a cooperative cancellation controller for a single submission.
 *
 * Prefers the native `AbortController` (real `AbortSignal` for `fetch`).
 * When it is unavailable we degrade gracefully: `abort()` cancels the stream
 * reader and sets a flag that the read loop checks. Never throws.
 */
export function createClientController(): ClientController {
  let holder: Cancellable | null = null
  let aborted = false

  const attachReader = (reader: Cancellable | null): void => {
    holder = reader
    // If we were already aborted before a reader existed, stop it eagerly.
    if (aborted) {
      try {
        holder?.cancel?.()
      } catch {
        // Ignore reader errors on an already-cancelled stream.
      }
    }
  }

  const abort = (): void => {
    if (aborted) return
    aborted = true
    try {
      holder?.cancel?.()
    } catch {
      // Ignore reader errors during cancellation.
    }
  }

  // Prefer the native controller for a real `AbortSignal`.
  try {
    if (typeof AbortController !== 'undefined') {
      const native = new AbortController()
      return {
        get signal() {
          return native.signal
        },
        get aborted() {
          return aborted
        },
        attachReader,
        abort() {
          abort()
          try {
            native.abort()
          } catch {
            // The flag + reader cancel already covered failure.
          }
        },
      }
    }
  } catch {
    // Fall through to the flag-based fallback below.
  }

  return {
    signal: undefined,
    get aborted() {
      return aborted
    },
    attachReader,
    abort,
  }
}
