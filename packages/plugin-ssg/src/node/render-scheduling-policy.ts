const MIN_RENDER_WINDOW = 2
const MAX_RENDER_WINDOW = 32
const RENDER_WINDOW_PER_WORKER = 2

export type RenderTaskOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; error: unknown }

/**
 * Observe a render promise without allowing a rejected task to become an
 * unhandled rejection while the bounded scheduler drains the remaining work.
 */
export function observeRenderTask<T>(
  task: Promise<T>,
): Promise<RenderTaskOutcome<T>> {
  return task.then(
    (value) => ({ ok: true, value }),
    (error) => ({ ok: false, error }),
  )
}

/**
 * Keep a small amount of work queued behind the active workers without
 * allowing every route's large SSR result to accumulate in the main thread.
 */
export function getRenderInFlightLimit(workerCount: number): number {
  if (!Number.isFinite(workerCount) || workerCount <= 0) {
    return MIN_RENDER_WINDOW
  }

  return Math.max(
    MIN_RENDER_WINDOW,
    Math.min(
      MAX_RENDER_WINDOW,
      Math.ceil(workerCount) * RENDER_WINDOW_PER_WORKER,
    ),
  )
}
