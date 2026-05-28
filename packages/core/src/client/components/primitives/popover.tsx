import {
  Popover as RACPopover,
  type PopoverProps as RACPopoverProps,
} from 'react-aria-components'
import { cn } from '../../utils/cn'

export interface PopoverProps extends Omit<RACPopoverProps, 'children'> {
  children: React.ReactNode
  className?: string
}

/**
 * A reusable Popover primitive with premium glassmorphism styling and smooth animations.
 */
export function Popover({ children, className, ...props }: PopoverProps) {
  return (
    <RACPopover
      offset={8}
      className={cn(
        'z-50 overflow-auto outline-none transition-none',
        className,
      )}
      {...props}
    >
      {children as any}
    </RACPopover>
  )
}
