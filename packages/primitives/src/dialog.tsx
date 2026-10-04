import * as React from 'react'
import { focusFirstIn } from './focus'
import {
  cn,
  composeRenderProps,
  filterDOMProps,
  type RenderProps,
} from './utils'

export interface DialogRenderProps {
  isOpen: boolean
  isExiting: boolean
}

export interface DialogProps
  extends Omit<
      React.HTMLAttributes<HTMLElement>,
      'children' | 'className' | 'style'
    >,
    RenderProps<DialogRenderProps> {
  children?: React.ReactNode | ((props: DialogRenderProps) => React.ReactNode)
  isOpen?: boolean
  isExiting?: boolean
  /** Focuses this element instead of the first focusable descendant. */
  autoFocus?: boolean
  /** Prevents focus from moving into the dialog on open. */
  preventFocus?: boolean
}

/**
 * A dialog container.
 *
 * `aria-modal` plus `tabIndex={-1}`: the attribute tells assistive tech the
 * content outside is unavailable, and the tabindex makes the dialog itself a
 * focus target so focus has somewhere to land when it holds nothing focusable.
 */
export function Dialog(props: DialogProps): React.ReactElement | null {
  const {
    isOpen = true,
    isExiting = false,
    autoFocus,
    preventFocus,
    className,
    style,
    children,
    ...rest
  } = props

  const ref = React.useRef<HTMLDivElement>(null)

  // Delegates to the shared helper rather than repeating a selector here. The
  // copy that was in this file had drifted: it did not exclude
  // `input[type="hidden"]`, did not match `[contenteditable]`, and applied none
  // of the `hidden` / `aria-hidden` / `display` / `visibility` filtering. So
  // this component could move focus onto something the modal overlay right above
  // it had already decided was not focusable — two components in one package
  // disagreeing about what focusable means.
  React.useEffect(() => {
    if (!isOpen || preventFocus || autoFocus) return
    if (!ref.current) return
    focusFirstIn(ref.current)
  }, [isOpen, preventFocus, autoFocus])

  const { domProps } = filterDOMProps(rest as Record<string, unknown>)
  const resolved = composeRenderProps<DialogRenderProps>(
    { className, style, children },
    { isOpen, isExiting },
  )

  if (!isOpen) return null

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      data-bdocs-dialog=""
      className={resolved.className}
      style={resolved.style}
      {...domProps}
    >
      {resolved.children}
    </div>
  )
}

Dialog.displayName = 'Dialog'
