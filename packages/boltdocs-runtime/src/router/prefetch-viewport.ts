/**
 * Viewport-triggered route prefetching.
 *
 * Hover prefetching only warms a link once the pointer commits to it, which
 * misses the most common case: a reader scrolls the sidebar, reads a heading,
 * and clicks without ever hovering. Every destination they are plausibly
 * heading for sits on screen, untouched.
 *
 * A single shared `IntersectionObserver` watches anchors registered by
 * `Link` and fires the normal prefetch pipeline when one becomes visible, so
 * the route chunk and its loader data are already cached by the time the click
 * lands. Hover keeps working and still wins: whichever signal arrives first
 * populates `prefetchCache`, and the other is a cache hit.
 *
 * The existing prefetch queue bounds the cost (two in flight, a shallow
 * backlog) and drops work when saturated, so this stays opportunistic
 * exactly like hover prefetching is.
 */

/**
 * Start slightly before the link is on screen so a short scroll already feels
 * instant, without warming the whole page below the fold.
 */
const VIEWPORT_PREFETCH_MARGIN = '200px 0px'

let observer: IntersectionObserver | null = null
const pending = new WeakMap<Element, () => void>()

function getObserver(): IntersectionObserver | null {
  if (typeof window === 'undefined') return null
  if (typeof IntersectionObserver === 'undefined') return null
  if (observer) return observer

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const run = pending.get(entry.target)
        if (!run) continue
        // One shot. The prefetch cache already dedupes repeat calls, but
        // unobserving keeps a long sidebar cheap instead of holding every
        // anchor for the life of the page.
        observer?.unobserve(entry.target)
        pending.delete(entry.target)
        run()
      }
    },
    { rootMargin: VIEWPORT_PREFETCH_MARGIN },
  )

  return observer
}

/**
 * Watches `element` and invokes `run` once it approaches the viewport.
 *
 * Returns a cleanup function. Safe to call during SSR, where it is a no-op.
 */
export function observeForPrefetch(
  element: Element | null,
  run: () => void,
): () => void {
  // Check the cheap argument first: creating the shared observer for a link
  // that never mounted would be pure waste.
  if (!element) return () => {}

  const target = getObserver()
  if (!target) return () => {}

  pending.set(element, run)
  target.observe(element)

  return () => {
    target.unobserve(element)
    pending.delete(element)
  }
}

/** Test seam: drops the shared observer so each case starts clean. */
export function resetViewportPrefetchObserver(): void {
  observer?.disconnect()
  observer = null
}
