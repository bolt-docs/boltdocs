import { cn } from '../../utils/cn'
import type { ComponentBase } from './types'

export interface ButtonGroupProps extends ComponentBase {
  vertical?: boolean
  /**
   * Corner radius to apply to the outer buttons of the group. Defaults to
   * inferring from the group's own `rounded-*` class, otherwise `md`.
   */
  radius?: 'full' | 'xl' | 'lg' | 'md' | 'none'
}

const RADIUS_BY_RADIUS: Record<string, string[]> = {
  full: [
    '[&>*:first-child]:rounded-l-full',
    '[&>*:last-child]:rounded-r-full',
    '[&>*:first-child]:rounded-t-full',
    '[&>*:last-child]:rounded-b-full',
  ],
  xl: [
    '[&>*:first-child]:rounded-l-xl',
    '[&>*:last-child]:rounded-r-xl',
    '[&>*:first-child]:rounded-t-xl',
    '[&>*:last-child]:rounded-b-xl',
  ],
  lg: [
    '[&>*:first-child]:rounded-l-lg',
    '[&>*:last-child]:rounded-r-lg',
    '[&>*:first-child]:rounded-t-lg',
    '[&>*:last-child]:rounded-b-lg',
  ],
  md: [
    '[&>*:first-child]:rounded-l-md',
    '[&>*:last-child]:rounded-r-md',
    '[&>*:first-child]:rounded-t-md',
    '[&>*:last-child]:rounded-b-md',
  ],
  none: [],
}

function inferRadius(className?: string): string {
  if (className?.includes('rounded-full')) return 'full'
  if (className?.includes('rounded-xl')) return 'xl'
  if (className?.includes('rounded-lg')) return 'lg'
  return 'md'
}

export function ButtonGroup({
  children,
  className,
  vertical = false,
  radius,
}: ButtonGroupProps) {
  const radiusKey = radius ?? inferRadius(className)
  const outer = RADIUS_BY_RADIUS[radiusKey] ?? []

  return (
    <div
      className={cn(
        'inline-flex',
        vertical ? 'flex-col' : 'flex-row',
        // Handle nested button borders and radii
        !vertical && [
          '[&>*:not(:first-child)]:-ml-px',
          '[&>*:first-child]:rounded-r-none',
          '[&>*:last-child]:rounded-l-none',
          '[&>*:not(:first-child):not(:last-child)]:rounded-none',
          // Extra polish for outer corners
          outer.filter(
            (c) => c.includes('rounded-l-') || c.includes('rounded-r-'),
          ),
        ],
        vertical && [
          '[&>*:not(:first-child)]:-mt-px',
          '[&>*:first-child]:rounded-b-none',
          '[&>*:last-child]:rounded-t-none',
          '[&>*:not(:first-child):not(:last-child)]:rounded-none',
          outer.filter(
            (c) => c.includes('rounded-t-') || c.includes('rounded-b-'),
          ),
        ],
        className,
      )}
    >
      {children}
    </div>
  )
}
