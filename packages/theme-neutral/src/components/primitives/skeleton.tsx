import { cn } from '../../utils/cn'

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'rect' | 'circle'
}

/**
 * Placeholder for content that is loading.
 *
 * Shape travels as `data-variant` rather than as a modifier class, so the theme
 * owns what "circle" looks like. The pulse is the one animation the component
 * implies, and it is disabled by `prefers-reduced-motion` in the stylesheet.
 */
export function Skeleton({
  className,
  variant = 'rect',
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn('bdocs-skeleton', className)}
      data-variant={variant}
      {...props}
    />
  )
}
