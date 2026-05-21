import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Handles scroll restoration and hash scrolling on navigation.
 * It ensures the page scrolls to top on pathname changes,
 * or specifically to an anchor element if a hash is present.
 */
export function ScrollHandler() {
  const { pathname, hash } = useLocation()

  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is used as a trigger for scroll-to-top on navigation
  useLayoutEffect(() => {
    const container = document.querySelector('.boltdocs-content') || window

    // Helper to get scroll top
    const getScrollTop = () => {
      if (container === window) return window.scrollY
      return (container as HTMLElement).scrollTop
    }

    // Helper to scroll
    const scrollTo = (top: number, behavior: ScrollBehavior = 'auto') => {
      if (container === window) {
        window.scrollTo({ top, behavior })
      } else {
        ;(container as HTMLElement).scrollTo({ top, behavior })
      }
    }

    if (hash) {
      const id = hash.replace('#', '')
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

        scrollTo(offsetPosition, 'auto')
        return
      }
    }

    // Scroll to top on navigation when no hash is specified
    scrollTo(0)
  }, [pathname, hash])

  return null
}
