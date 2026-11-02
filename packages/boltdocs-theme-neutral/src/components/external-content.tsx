import type { ReactNode } from 'react'
import { cn } from '../utils/cn'

/**
 * The content container for a file-routed external MDX page.
 *
 * The site's external layout renders the chrome, but these routes are not
 * nested inside `DocsLayout`, so the MDX needs its own page container with the
 * title and the prose typography — otherwise it renders edge-to-edge directly
 * below the navbar.
 */
export function ExternalContent({
  title,
  children,
  className,
  contentClassName,
}: {
  title?: string
  children?: ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <div className={cn('bdocs-external__content', className)}>
      <div className={cn('bdocs-external__column', contentClassName)}>
        {title && <h1 className="bdocs-external__title">{title}</h1>}
        <div className="bdocs-prose">{children}</div>
      </div>
    </div>
  )
}
