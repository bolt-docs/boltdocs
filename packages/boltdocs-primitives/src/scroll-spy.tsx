import * as React from 'react'

/**
 * Headless scroll-spy for a table of contents.
 *
 * Owns the part that is easy to get wrong: which heading is active when several
 * are on screen, the SPA re-scan after content mounts, and the measurement of
 * the active-track indicator. It ships no markup, no classes and no router
 * dependency — the theme decides what a TOC looks like and how links navigate.
 */

export interface ScrollSpyItem {
  /** Hash or path with a hash, e.g. `#install` or `/docs#install`. */
  url: string
}

export interface ScrollSpyInfo {
  id: string
  active: boolean
  fallback: boolean
  /** Last time this item became active, used to break ties. */
  t: number
}

export interface ScrollSpyProps {
  items: ScrollSpyItem[]
  /** Keep at most one active item. */
  single?: boolean
  observerOptions?: IntersectionObserverInit
  children?: React.ReactNode
}

const ItemsContext = React.createContext<ScrollSpyInfo[] | null>(null)

/** Id of a heading from its link, or `null` for a non-anchor URL. */
export function getItemId(url: string): string | null {
  return url.startsWith('#') ? url.slice(1) : null
}

export function useScrollSpyItems(): ScrollSpyInfo[] {
  const ctx = React.useContext(ItemsContext)
  if (!ctx)
    throw new Error('Scroll-spy hooks must be used inside <ScrollSpyProvider>.')
  return ctx
}

export function useActiveAnchor(): string | undefined {
  const items = useScrollSpyItems()
  let active: ScrollSpyInfo | undefined
  for (const item of items) {
    if (!item.active) continue
    if (!active || item.t > active.t) active = item
  }
  return active?.id
}

export function useActiveAnchors(): string[] {
  return useScrollSpyItems()
    .filter((item) => item.active)
    .map((item) => item.id)
}

export function ScrollSpyProvider({
  items,
  single = false,
  observerOptions,
  children,
}: ScrollSpyProps): React.ReactElement {
  const [state, setState] = React.useState<ScrollSpyInfo[]>([])
  const stateRef = React.useRef<ScrollSpyInfo[]>([])
  const singleRef = React.useRef(single)
  const observeRef = React.useRef<(() => void) | null>(null)
  singleRef.current = single

  React.useEffect(() => {
    const next = items.flatMap((item) => {
      const id = getItemId(item.url)
      return id ? [{ id, active: false, fallback: false, t: 0 }] : []
    })
    stateRef.current = next
    setState(next)
    // Re-observe immediately: the heading elements for a new route may already
    // be in the DOM by the time the TOC changes.
    observeRef.current?.()
  }, [items])

  React.useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const options: IntersectionObserverInit = {
      rootMargin: '-80px 0% -60% 0%',
      threshold: 0,
      ...observerOptions,
    }

    const scan = () => {
      const previous = stateRef.current
      let changed = false
      const updated = previous.map((item) => {
        const element = document.getElementById(item.id)
        if (!element) {
          if (item.active || item.fallback) changed = true
          return { ...item, active: false, fallback: false }
        }
        const rect = element.getBoundingClientRect()
        const viewportHeight = window.innerHeight || 1000
        const active = rect.bottom > 0 && rect.top < viewportHeight
        const fallback =
          !active && rect.top > 0 && rect.top < viewportHeight * 2
        if (item.active !== active || item.fallback !== fallback) changed = true
        return {
          ...item,
          active,
          fallback,
          t: active ? Date.now() : item.t,
        }
      })

      let next = updated
      if (singleRef.current) {
        const visible = updated.findIndex((item) => item.active)
        const near =
          visible >= 0 ? visible : updated.findIndex((i) => i.fallback)
        const highlight = near >= 0 ? near : updated.length > 0 ? 0 : -1
        next = updated.map((item, index) => ({
          ...item,
          active: index === highlight,
          t: index === highlight ? Date.now() : item.t,
        }))
        if (next.some((item, i) => item.active !== updated[i].active)) {
          changed = true
        }
      }

      if (changed) {
        stateRef.current = next
        setState(next)
      }
    }

    const observer = new IntersectionObserver(scan, options)
    const observe = () => {
      for (const item of stateRef.current) {
        const element = document.getElementById(item.id)
        if (element) observer.observe(element)
      }
    }
    observeRef.current = observe
    observe()

    // In an SPA the TOC can update before the MDX headings are mounted.
    const timers = [100, 500, 1000].map((ms) => setTimeout(observe, ms))
    return () => {
      timers.forEach(clearTimeout)
      observer.disconnect()
      observeRef.current = null
    }
  }, [observerOptions])

  return <ItemsContext.Provider value={state}>{children}</ItemsContext.Provider>
}

ScrollSpyProvider.displayName = 'ScrollSpyProvider'

/**
 * Keeps the active TOC link visible inside its scroll container. Uses the
 * platform's own scrollIntoView; no extra scroll library ships for this.
 */
export function useAnchorScroll(
  anchorRef: React.RefObject<HTMLElement | null>,
  active: boolean,
): void {
  React.useEffect(() => {
    const element = anchorRef.current
    if (!active || !element || typeof element.scrollIntoView !== 'function') {
      return
    }
    // Native `nearest` is the boundary-aware scroll: it moves the link only if
    // the scroll container has actually pushed it out of view.
    element.scrollIntoView({
      behavior: 'auto',
      block: 'nearest',
      inline: 'nearest',
    })
  }, [anchorRef, active])
}

/**
 * Hash links should use the SPA router when one is installed, and fall back to
 * the browser's own hash navigation otherwise. The caller supplies `navigate`.
 */
export function useAnchorNavigation(
  href: string | undefined,
  onNavigate?: (href: string) => void,
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void,
): (event: React.MouseEvent<HTMLAnchorElement>) => void {
  return React.useCallback(
    (event) => {
      if (onClick) {
        onClick(event)
        return
      }
      if (href && href.includes('#') && onNavigate) {
        event.preventDefault()
        onNavigate(href)
      }
    },
    [href, onClick, onNavigate],
  )
}

/**
 * Geometry for the active-track indicator, measured against the element's
 * offsetParent so both rects share a reference frame. A hook rather than a
 * component: the theme owns the element and its styling.
 */
export function useActiveIndicator(
  containerRef: React.RefObject<HTMLElement | null>,
  style?: React.CSSProperties,
): React.CSSProperties {
  const [state, setState] = React.useState<React.CSSProperties>(() => ({
    opacity: 0,
    ...style,
  }))

  React.useEffect(() => {
    const parent = containerRef.current?.offsetParent as HTMLElement | null
    if (!parent) return
    const links = parent.querySelectorAll<HTMLElement>('a[data-active="true"]')
    if (links.length === 0) {
      setState({ opacity: 0, ...style })
      return
    }
    const first = links[0].getBoundingClientRect()
    const last = links[links.length - 1].getBoundingClientRect()
    const parentRect = parent.getBoundingClientRect()
    setState({
      transform: `translateY(${first.top - parentRect.top}px)`,
      height: `${last.bottom - first.top}px`,
      opacity: 1,
      ...style,
    })
  }, [containerRef, style])

  return state
}
