import { useEffect, useRef } from 'react'

type AnimationType =
  | 'fade-up'
  | 'fade-down'
  | 'fade-in'
  | 'scale-up'
  | 'scale-down'
  | 'slide-left'
  | 'slide-right'
  | 'rotate-up'
  | 'blur-in'
  | 'reveal-clip'
  | 'stagger'

type ScrollAnimRef = React.RefObject<HTMLElement | null>

/**
 * Applies a CSS scroll-driven animation (`animation-timeline: view()`)
 * to the element referenced. Replaces `useGSAPScroll`.
 */
export function useScrollAnimation(
  ref: ScrollAnimRef,
  animation: AnimationType = 'fade-up',
) {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    el.setAttribute('data-sa', animation)

    return () => {
      el.removeAttribute('data-sa')
    }
  }, [ref, animation])
}

/**
 * Applies staggered scroll-driven animations to the children of the
 * referenced element. Replaces `useGSAPStaggerIn`.
 */
export function useScrollStagger(
  ref: ScrollAnimRef,
  options: {
    stagger?: number
  } = {},
) {
  const { stagger = 0.08 } = options

  const staggerRef = useRef(stagger)
  staggerRef.current = stagger

  useEffect(() => {
    const parent = ref.current
    if (!parent || !parent.children.length) return

    parent.setAttribute('data-sa', 'stagger')

    // Set --sa-index on each child so CSS can calculate staggered delay
    const children = Array.from(parent.children) as HTMLElement[]
    children.forEach((child, i) => {
      child.style.setProperty('--sa-index', String(i))
    })

    return () => {
      parent.removeAttribute('data-sa')
      children.forEach((child) => {
        child.style.removeProperty('--sa-index')
      })
    }
  }, [ref])
}
