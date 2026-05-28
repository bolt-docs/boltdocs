import { cn } from '../../utils/cn'
import type { ComponentBase } from './types'

export interface ButtonGroupProps extends ComponentBase {
  vertical?: boolean
}

export function ButtonGroup({
  children,
  className,
  vertical = false,
}: ButtonGroupProps) {
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
          className?.includes('rounded-full') && [
            '[&>*:first-child]:rounded-l-full',
            '[&>*:last-child]:rounded-r-full',
          ],
          className?.includes('rounded-xl') && [
            '[&>*:first-child]:rounded-l-xl',
            '[&>*:last-child]:rounded-r-xl',
          ],
          className?.includes('rounded-lg') && [
            '[&>*:first-child]:rounded-l-lg',
            '[&>*:last-child]:rounded-r-lg',
          ],
        ],
        vertical && [
          '[&>*:not(:first-child)]:-mt-px',
          '[&>*:first-child]:rounded-b-none',
          '[&>*:last-child]:rounded-t-none',
          '[&>*:not(:first-child):not(:last-child)]:rounded-none',
          className?.includes('rounded-full') && [
            '[&>*:first-child]:rounded-t-full',
            '[&>*:last-child]:rounded-b-full',
          ],
        ],
        className,
      )}
    >
      {children}
    </div>
  )
}
