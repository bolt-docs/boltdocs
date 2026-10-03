import * as React from 'react'
import { cn, composeRenderProps, filterDOMProps } from './utils'

export interface DialogRenderProps {
  isOpen: boolean
  isExiting: boolean
}

export interface DialogProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'children'>,
    composeRenderProps<DialogRenderProps> {
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

  React.useEffect(() => {
    if (!isOpen || preventFocus || autoFocus) return
    const node = ref.current
    if (!node) return
    const focusable = node.querySelector<HTMLElement>(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
    )
    ;(focusable ?? node).focus()
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
