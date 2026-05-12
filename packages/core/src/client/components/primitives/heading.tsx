import * as React from 'react'
import { Link as LucideLink } from 'lucide-react'
import { Link } from './link'
import { cn } from '../../utils/cn'

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level: 1 | 2 | 3 | 4 | 5 | 6
  id?: string
  /** Whether to show the anchor icon/link. Defaults to true if id is provided. */
  showAnchor?: boolean
  /** Position of the anchor link relative to children. Defaults to 'wrap'. */
  anchorPosition?: 'wrap' | 'after' | 'before'
  /** Custom icon to display for the anchor. */
  anchorIcon?: React.ReactNode
  /** Custom classes for the anchor link wrapper. */
  anchorClassName?: string
}

export const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  (
    {
      level,
      id,
      children,
      className,
      showAnchor = true,
      anchorPosition = 'wrap',
      anchorIcon,
      anchorClassName,
      ...props
    },
    ref,
  ) => {
    const safeLevel = Math.min(Math.max(Math.floor(level), 1), 6) as
      | 1
      | 2
      | 3
      | 4
      | 5
      | 6
    const Tag = `h${safeLevel}` as const

    const hasAnchor = !!(id && showAnchor)

    // Default icon with hover transition
    const defaultIcon = (
      <LucideLink
        className={cn(
          'transition-all duration-200',
          anchorPosition === 'wrap'
            ? 'opacity-0 ml-2 text-muted/50 group-hover:text-primary-500 group-hover:opacity-100'
            : 'text-muted/50 hover:text-primary-500',
        )}
        size={16}
      />
    )

    const icon = anchorIcon ?? defaultIcon

    const renderContent = () => {
      if (!hasAnchor) {
        return children
      }

      if (anchorPosition === 'wrap') {
        return (
          <Link
            href={`#${id}`}
            className={cn(
              'header-anchor flex flex-row items-center no-underline text-inherit',
              anchorClassName,
            )}
            aria-label="Anchor"
          >
            {children}
            {icon}
          </Link>
        )
      }

      return (
        <>
          {anchorPosition === 'before' && (
            <Link
              href={`#${id}`}
              className={cn(
                'header-anchor mr-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200',
                anchorClassName,
              )}
              aria-label="Anchor"
            >
              {icon}
            </Link>
          )}
          {children}
          {anchorPosition === 'after' && (
            <Link
              href={`#${id}`}
              className={cn(
                'header-anchor ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200',
                anchorClassName,
              )}
              aria-label="Anchor"
            >
              {icon}
            </Link>
          )}
        </>
      )
    }

    return (
      <Tag
        ref={ref}
        id={id}
        className={cn(
          'boltdocs-heading relative group flex items-center scroll-mt-24',
          className,
        )}
        {...props}
      >
        {renderContent()}
      </Tag>
    )
  },
)

Heading.displayName = 'Heading'
