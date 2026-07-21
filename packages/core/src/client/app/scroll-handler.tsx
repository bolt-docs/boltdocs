import { useEffect, useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Handles scroll restoration and hash scrolling on navigation.
 * It ensures the page scrolls to top on pathname changes,
 * or specifically to an anchor element if a hash is present.
 */
export function ScrollHandler() {
  const { pathname, hash } = useLocation()

  // Helper to handle scroll logic
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

        scrollTo(offsetPosition, behavior)
        return true
      }
    }

    scrollTo(0, behavior)
    return false
  }

  // 1. Immediate sync scroll before paint
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is used as a trigger for scroll-to-top on navigation
  useLayoutEffect(() => {
    handleScroll('auto')
  }, [pathname, hash])

  // 2. Delayed async scroll as fallback/stabilizer after paint & passive effects
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is used as a trigger for scroll-to-top on navigation
  useEffect(() => {
    handleScroll('auto')
  }, [pathname, hash])

  return null
}
