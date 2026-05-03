import { useNavigate, useLocation } from 'react-router-dom'
import { useLocalizedTo } from '../../hooks/use-localized-to'
import { cn } from '../../utils/cn'
import { forwardRef, type React } from 'react'

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Should prefetch the page on hover? Default 'hover' */
  prefetch?: 'hover' | 'none'
}

/**
 * A primitive Link component that wraps a standard anchor tag
 * and adds framework-specific logic for path localization and preloading.
 */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>((props, ref) => {
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
      navigate(localizedHref as string)
    }
  }

  const handleMouseEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    onMouseEnter?.(e)
  }

  const handleFocus = (e: React.FocusEvent) => {
    onFocus?.(e)
  }

  return (
    <a
      {...rest}
      ref={ref}
      href={localizedHref as string}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onFocus={handleFocus}
    />
  )
})
Link.displayName = 'Link'

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
export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  (props, ref) => {
    const { href, end = false, className, children, ...rest } = props
    const location = useLocation()

    const localizedHref = useLocalizedTo(href ?? '')

    const isActive = end
      ? location.pathname === localizedHref
      : location.pathname.startsWith(localizedHref as string)

    const resolvedClassName =
      typeof className === 'function'
        ? className({ isActive })
        : cn(className, isActive && 'active')
    const resolvedChildren =
      typeof children === 'function' ? children({ isActive }) : children

    return (
      <Link
        {...rest}
        ref={ref}
        href={href}
        className={resolvedClassName as any}
      >
        {resolvedChildren as any}
      </Link>
    )
  },
)
NavLink.displayName = 'NavLink'