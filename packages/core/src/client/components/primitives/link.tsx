import {
  useNavigate,
  useLocation,
  usePrefetch,
  hasUriScheme,
} from '../../router'
import { useLocalizedTo } from '../../hooks/use-localized-to'
import { cn } from '../../utils/cn'
import { useViewTransition } from '../../view-transitions'
import type { BoltdocsRoutePathWithFallback } from '../../types'
export interface LinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href?: BoltdocsRoutePathWithFallback
  /** Alias for href, supported for React Router-style collection components. */
  to?: BoltdocsRoutePathWithFallback
  /** Should prefetch the page on hover? Default 'hover' */
  prefetch?: 'hover' | 'none'
  /** Wrap local navigation in the experimental View Transition API. */
  transition?: boolean
  /** Native transition types for this link. */
  transitionTypes?: string[]
}

/**
 * A primitive Link component that wraps a standard anchor tag
 * and adds framework-specific logic for path localization and preloading.
 */
export function Link(props: LinkProps) {
  const {
    href,
    to,
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
        navigate(localizedHref, transition ? { viewTransition: false } : undefined)
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
    if (prefetch === 'hover' && localizedHref) {
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

  return (
    <a
      {...rest}
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
