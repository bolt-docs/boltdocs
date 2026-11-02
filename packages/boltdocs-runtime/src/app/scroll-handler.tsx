import { useEffect } from 'react'
import { useLocation } from '../router'

/**
 * Handles scroll restoration after navigation.
 *
 * Normal page navigation returns the active content container to the top
 * instantly. Explicit hash navigation is positioned at its anchor instead.
 */
export function ScrollHandler() {
  const { pathname, hash } = useLocation()

  const handleScroll = (behavior: ScrollBehavior = 'auto') => {
    const container =
      document.querySelector('.boltdocs-content') ||
      document.querySelector('.boltdocs-external-content') ||
      document.querySelector('.boltdocs-shell-content') ||
      window

    const getScrollTop = () => {
      if (container === window) return window.scrollY
      return (container as HTMLElement).scrollTop
    }

    const scrollTo = (top: number, scrollBehavior: ScrollBehavior) => {
      if (container === window) {
        window.scrollTo({ top, behavior: scrollBehavior })
      } else {
        ;(container as HTMLElement).scrollTo({ top, behavior: scrollBehavior })
      }
    }

    if (hash) {
      let id = hash.slice(1)
      try {
        id = decodeURIComponent(id)
      } catch {
        // Keep the raw fragment when it contains malformed encoding.
      }

      const element = document.getElementById(id)
      if (element) {
        const offset = 80
        const containerTop =
          container === window
            ? 0
            : (container as HTMLElement).getBoundingClientRect().top
        const elementRect = element.getBoundingClientRect().top
        const elementPosition = elementRect - containerTop
        const offsetPosition = elementPosition - offset + getScrollTop()

        scrollTo(offsetPosition, behavior)
        return true
      }
    }

    // A route without a resolved anchor starts at the top. Assigning the
    // property directly bypasses any CSS `scroll-behavior: smooth` rule.
    if (container === window) {
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    } else {
      ;(container as HTMLElement).scrollTop = 0
    }
    return false
  }

  // Run one synchronized scroll pass after the route has committed. The
  // router owns URL state; this component owns DOM scrolling.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is used as a route trigger
  useEffect(() => {
    const handleRouteCommit = (event: Event) => {
      const detail = (
        event as CustomEvent<{ pathname?: string; hash?: string }>
      ).detail
      if (detail?.pathname && detail.pathname !== pathname) return
      if (detail?.hash !== undefined && detail.hash !== hash) return
      handleScroll('auto')
    }

    window.addEventListener('boltdocs:route-commit', handleRouteCommit)
    let frame = 0
    if (hash) {
      let attempts = 0
      const retry = () => {
        if (handleScroll('auto') || attempts >= 8) return
        attempts++
        frame = requestAnimationFrame(retry)
      }
      frame = requestAnimationFrame(retry)
    }

    return () => {
      window.removeEventListener('boltdocs:route-commit', handleRouteCommit)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [pathname, hash])

  return null
}
