import { useNavigate, useLocation } from 'react-router-dom'
import { useLocalizedTo } from '../../hooks/use-localized-to'
import { cn } from '../../utils/cn'
import type { BoltdocsRoutePathWithFallback } from '../../types'
export interface LinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href?: BoltdocsRoutePathWithFallback
  /** Should prefetch the page on hover? Default 'hover' */
  prefetch?: 'hover' | 'none'
}

/**
 * A primitive Link component that wraps a standard anchor tag
 * and adds framework-specific logic for path localization and preloading.
 */
export function Link(props: LinkProps) {
  const { href, onMouseEnter, onFocus, onClick, ...rest } = props

  const navigate = useNavigate()
  const localizedHref = useLocalizedTo(href ?? '')

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented) return

    const isExternal =
      localizedHref &&
      (localizedHref.startsWith('http://') ||
        localizedHref.startsWith('https://') ||
        localizedHref.startsWith('//'))

    if (!isExternal) {
      e.preventDefault()
      navigate(localizedHref)
    }
  }

  const handleMouseEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    onMouseEnter?.(e)
  }

  const handleFocus = (e: React.FocusEvent<HTMLAnchorElement>) => {
    onFocus?.(e)
  }

  return (
    <a
      {...rest}
      href={localizedHref}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onFocus={handleFocus}
    />
  )
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
  const { href, end = false, className, children, ...rest } = props
  const location = useLocation()

  const localizedHref = useLocalizedTo(href ?? '')

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
    <Link {...rest} href={href} className={resolvedClassName}>
      {resolvedChildren}
    </Link>
  )
}
