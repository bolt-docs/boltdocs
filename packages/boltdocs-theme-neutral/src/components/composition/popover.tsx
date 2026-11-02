import {
  Popover as PrimitivesPopover,
  type PopoverProps as PrimitivesPopoverProps,
} from '@bdocs/primitives'
import { cn } from '../../utils/cn'

export interface PopoverProps extends PrimitivesPopoverProps {}

/**
 * A reusable Popover primitive.
 *
 * Positioned with CSS relative to its parent. The full positioning engine
 * react-aria ships — viewport collision, flipping — is not reimplemented:
 * Boltdocs anchors popovers to navbar and sidebar items where the layout already
 * decides the side.
 *
 * The panel does not know which side it opened on; the trigger's wrapper carries
 * the offset. Inventing a `placement` prop here would have been a prop nothing
 * set, and a stylesheet branch nothing ever took.
 */
export function Popover({ children, className, ...props }: PopoverProps) {
  return (
    <PrimitivesPopover className={cn('bdocs-popover', className)} {...props}>
      {children}
    </PrimitivesPopover>
  )
}
