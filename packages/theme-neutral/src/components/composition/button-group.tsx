import { cn } from '../../utils/cn'
import type { ComponentBase } from './types'

export interface ButtonGroupProps extends ComponentBase {
  vertical?: boolean
  /**
   * Corner radius of the group's outer corners.
   *
   * A typed prop, not something inferred from the caller's class name. The
   * previous implementation ran `className.includes('rounded-full')` to guess
   * it, which meant a theme that spelled its radius `1rem` instead of
   * `rounded-full` silently got square corners, and a caller passing
   * `rounded-2xl` got the wrong bucket twice over.
   */
  radius?: 'full' | 'xl' | 'lg' | 'md' | 'none'
}

/**
 * A row or column of buttons that read as one control.
 *
 * The group owns the seams: adjacent children lose the border between them and
 * the inner corners, so the group has one outline rather than five. All of that
 * is `:not(:first-child)` / `:not(:last-child)` in the stylesheet keyed off
 * `data-orientation` and `data-radius` — the primitive states the arrangement and
 * the theme draws it.
 */
export function ButtonGroup({
  children,
  className,
  vertical = false,
  radius = 'md',
}: ButtonGroupProps) {
  return (
    <div
      className={cn('bdocs-button-group', className)}
      data-orientation={vertical ? 'vertical' : 'horizontal'}
      data-radius={radius}
    >
      {children}
    </div>
  )
}
