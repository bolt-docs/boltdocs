import * as React from 'react'
import { Link as LucideLink } from '../ui-base/icons'
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
  /** Custom classes for the default anchor icon. */
  anchorIconClassName?: string
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
      anchorIconClassName,
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
          anchorPosition === 'wrap'
            ? 'bdocs-heading__anchor-glyph bdocs-heading__anchor-glyph--hidden'
            : 'bdocs-heading__anchor-glyph',
          anchorIconClassName,
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
            className={cn('bdocs-heading__anchor', anchorClassName)}
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
                'bdocs-heading__anchor bdocs-heading__anchor--before',
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
                'bdocs-heading__anchor bdocs-heading__anchor--after',
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
        className={cn('bdocs-heading boltdocs-heading', className)}
        {...props}
      >
        {renderContent()}
      </Tag>
    )
  },
)

Heading.displayName = 'Heading'
