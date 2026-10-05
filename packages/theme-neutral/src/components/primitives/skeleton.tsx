import { cn } from '../../utils/cn'

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'rect' | 'circle'
}

/**
 * A flexible skeleton component that mimics the shape of content
 * while it is loading. Features a smooth pulse animation.
 */
export function Skeleton({
  className,
  variant = 'rect',
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-soft',
        variant === 'circle' ? 'rounded-full' : 'rounded-md',
        className,
      )}
      {...props}
    />
  )
}
