'use client'

import * as RAC from 'react-aria-components'
import { cn } from '../../utils/cn'

export interface PopoverProps extends Omit<RAC.PopoverProps, 'children'> {
  children: React.ReactNode
  className?: string
  showArrow?: boolean
}

/**
 * A reusable Popover primitive with premium glassmorphism styling and smooth animations.
 */
export const Popover = ({
  children,
  className,
  showArrow,
  ...props
}: PopoverProps) => {
  return (
    <RAC.Popover
      offset={8}
      {...props}
      className={RAC.composeRenderProps(className, (className) =>
        cn(
          'z-50 overflow-auto rounded-xl border border-subtle bg-surface/80 shadow-xl backdrop-blur-md outline-none transition-none',
          className,
        ),
      )}
    >
      {showArrow && (
        <RAC.OverlayArrow className="group">
          <svg
            viewBox="0 0 12 12"
            className="block h-3 w-3 fill-bg-surface/80 stroke-border-subtle group-placement-bottom:rotate-180 group-placement-left:-rotate-90 group-placement-right:rotate-90"
            aria-hidden="true"
          >
            <path d="M0 0 L6 6 L12 0" />
          </svg>
        </RAC.OverlayArrow>
      )}
      {children as any}
    </RAC.Popover>
  )
}
