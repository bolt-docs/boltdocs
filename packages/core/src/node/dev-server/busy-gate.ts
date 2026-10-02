/**
 * Tracks whether the dev server is currently serving a request.
 *
 * The client graph warmup is a background CPU consumer on the same event loop
 * as SSR, and Vite's `_pendingRequests` does not cover requests served by
 * Boltdocs' own middleware — the ones that do the full server-side render.
 * Without this signal the warmup competes with them instead of standing aside.
 *
 * Module-level rather than per-server because there is one dev server per
 * process, and the warmup and the middleware both import it directly.
 */
let inFlight = 0

/** Marks the start of a request served by Boltdocs itself. */
export function beginServedRequest(): void {
  inFlight++
}

/** Marks the end of a request served by Boltdocs itself. */
export function endServedRequest(): void {
  inFlight = Math.max(0, inFlight - 1)
}

/** True while at least one Boltdocs-served request is in progress. */
export function isServingRequest(): boolean {
  return inFlight > 0
}

/** Current count. Exposed for assertions. */
export function servedRequestCount(): number {
  return inFlight
}

/** Test-only: reset the counter between cases. */
export function resetServedRequests(): void {
  inFlight = 0
}
