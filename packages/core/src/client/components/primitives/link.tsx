import {
  useNavigate,
  useLocation,
  usePrefetch,
  hasUriScheme,
} from '../../router'
import React from 'react'
import { observeForPrefetch } from '../../router/prefetch-viewport'
import { useLocalizedTo } from '../../hooks/use-localized-to'
import { cn } from '../../utils/cn'
import { useViewTransition } from '../../view-transitions'
import type { BoltdocsRoutePathWithFallback } from '../../types'
export interface LinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href?: BoltdocsRoutePathWithFallback
  /** Alias for href, supported for React Router-style collection components. */
  to?: BoltdocsRoutePathWithFallback
  /**
   * When to warm the destination's route chunk and loader data.
   *
   * - `hover` — on pointer enter or keyboard focus. Default.
   * - `viewport` — also as soon as the link is about to be scrolled into view,
   *   so readers who scroll and click never wait. Implies hover.
   * - `none` — never prefetch.
   */
  prefetch?: 'hover' | 'viewport' | 'none'
  /** Wrap local navigation in the experimental View Transition API. */
  transition?: boolean
  /** Native transition types for this link. */
  transitionTypes?: string[]
  /** Ref to the rendered anchor element. */
  ref?: React.Ref<HTMLAnchorElement>
  /** Arbitrary `data-*` state attributes (e.g. `data-active`, `data-depth`). */
  [key: `data-${string}`]: string | number | boolean | undefined
}

/**
 * A primitive Link component that wraps a standard anchor tag
 * and adds framework-specific logic for path localization and preloading.
 */
export function Link(props: LinkProps) {
  const {
    href,
    to,
    ref,
    prefetch = 'hover',
    onMouseEnter,
    onFocus,
    onClick,
    target: linkTarget,
    download,
    transition = false,
    transitionTypes,
    ...rest
  } = props
  const target = href ?? to ?? ''

  const navigate = useNavigate()
  const prefetchRoute = usePrefetch()
  const runTransition = useViewTransition()
  const localizedHref = useLocalizedTo(target)

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      download !== undefined ||
      (linkTarget && linkTarget !== '_self')
    )
      return

    const isExternal =
      localizedHref &&
      (localizedHref.startsWith('http://') ||
        localizedHref.startsWith('https://') ||
        localizedHref.startsWith('//') ||
        hasUriScheme(localizedHref))

    if (!isExternal) {
      e.preventDefault()
      const navigateTo = () =>
        navigate(
          localizedHref,
          transition ? { viewTransition: false } : undefined,
        )
      if (transition) {
        runTransition(navigateTo, {
          enabled: true,
          types: transitionTypes,
        })
      } else {
        navigateTo()
      }
    }
  }

  const handlePrefetch = () => {
    if (prefetch !== 'none' && localizedHref) {
      void prefetchRoute(localizedHref)
    }
  }

  const handleMouseEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    onMouseEnter?.(e)
    handlePrefetch()
  }

  const handleFocus = (e: React.FocusEvent<HTMLAnchorElement>) => {
    onFocus?.(e)
    handlePrefetch()
  }

  const anchorRef = React.useRef<HTMLAnchorElement | null>(null)

  // The observer needs the real node, but `ref` belongs to the caller, so both
  // have to be honoured.
  const setRef = React.useCallback(
    (node: HTMLAnchorElement | null) => {
      anchorRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    },
    [ref],
  )

  React.useEffect(() => {
    if (prefetch !== 'viewport' || !localizedHref) return
    return observeForPrefetch(anchorRef.current, () => {
      void prefetchRoute(localizedHref)
    })
  }, [prefetch, localizedHref, prefetchRoute])

  return (
    <a
      {...rest}
      ref={setRef}
      href={localizedHref}
      target={linkTarget}
      download={download}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onFocus={handleFocus}
    />
  )
}

/**
 * A convenience link that opts into the experimental View Transition API.
 * It keeps normal anchor behavior when the feature is disabled or unsupported.
 */
export function TransitionLink(props: LinkProps) {
  return <Link {...props} transition />
}

/**
 * Props for the NavLink component, extending standard Link props.
 */
export interface NavLinkProps
  extends Omit<LinkProps, 'className' | 'children'> {
  /**
   * When true, the active state will only be applied if the paths match exactly.
   * Default is false.
   */
  end?: boolean
  /**
   * Provides access to the active state for conditional children rendering.
   */
  children?:
    | React.ReactNode
    | ((props: { isActive: boolean }) => React.ReactNode)
  /**
   * Provides access to the active state for conditional styling.
   */
  className?: string | ((props: { isActive: boolean }) => string)
}

/**
 * A primitive NavLink component that provides active state detection.
 */
export function NavLink(props: NavLinkProps) {
  const { href, to, end = false, className, children, ...rest } = props
  const location = useLocation()
  const target = href ?? to ?? ''

  const localizedHref = useLocalizedTo(target)

  const isActive = end
    ? location.pathname === localizedHref
    : location.pathname.startsWith(localizedHref)

  const resolvedClassName =
    typeof className === 'function'
      ? className({ isActive })
      : cn(className, isActive && 'active')
  const resolvedChildren =
    typeof children === 'function' ? children({ isActive }) : children

  return (
    <Link {...rest} href={href} to={to} className={resolvedClassName}>
      {resolvedChildren}
    </Link>
  )
}
