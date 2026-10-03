import type { ReactNode } from 'react'
import { Tooltip as PrimitivesTooltip } from '@bdocs/primitives'
import { cn } from '../../utils/cn'

export interface TooltipProps {
  /** The content to show inside the tooltip. */
  content: ReactNode
  /** The trigger element (usually a button or a link). */
  children: React.ReactElement
  /** Delay in milliseconds before showing the tooltip. */
  delay?: number
  /** Class name for the tooltip surface. */
  className?: string
  /** Class name for the arrow svg. */
  arrowClassName?: string
}

/**
 * Tooltip, on `@bdocs/primitives`.
 *
 * Shown on hover and on focus, dismissed with Escape, and wired to its trigger
 * with `aria-describedby` so the trigger keeps its own accessible name. A tooltip
 * that only appears on hover is invisible to a keyboard user, and one using
 * `aria-label` makes the trigger announce the tooltip instead of its own text.
 *
 * The arrow is decorative and carries `aria-hidden`, and the tooltip surface is
 * a `<span role="tooltip">` rather than a floating layer with enter/exit data
 * attributes — those animated state attributes existed to drive react-aria's
 * positioning lifecycle, which this package does not implement.
 */
export function Tooltip({
  content,
  children,
  delay = 500,
  className,
  arrowClassName,
}: TooltipProps) {
  return (
    <PrimitivesTooltip
      content={
        <span
          className={cn(
            'group relative z-50 overflow-visible rounded-md bg-surface px-2.5 py-1.5 text-xs font-medium text-body ring-1 ring-subtle outline-hidden select-none',
            className,
          )}
        >
          {content}
        </span>
      }
      delay={delay}
      className={cn(
        'absolute top-full left-1/2 mt-2 -translate-x-1/2',
        arrowClassName,
      )}
    >
      {children}
    </PrimitivesTooltip>
  )
}

Tooltip.Root = Tooltip
