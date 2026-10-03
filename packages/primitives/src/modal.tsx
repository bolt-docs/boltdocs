import * as React from 'react'
import { cn } from './utils'
import {
  focusFirstIn,
  getFocusableElements,
  hideSiblings,
  lockScroll,
  trapTab,
} from './focus'

export interface ModalOverlayProps
  extends React.HTMLAttributes<HTMLDivElement> {
  isOpen?: boolean
  /** Called when Escape is pressed, or when the overlay itself is clicked. */
  onOpenChange?: (isOpen: boolean) => void
  /** Set false to keep a click on the backdrop from closing the modal. */
  isDismissable?: boolean
  children?: React.ReactNode
}

/**
 * The backdrop of a modal.
 *
 * Owns everything about modality that is not visual: focus moves in on open,
 * Tab is trapped, Escape closes, the page behind is `aria-hidden` and cannot
 * scroll, and focus returns to whatever opened it. Keeping that here rather than
 * in each caller is the point — a focus trap implemented once is one that can be
 * tested.
 */
export function ModalOverlay(
  props: ModalOverlayProps,
): React.ReactElement | null {
  const {
    isOpen = false,
    onOpenChange,
    isDismissable = true,
    className,
    children,
    onClick,
    ...rest
  } = props

  const ref = React.useRef<HTMLDivElement>(null)
  const restoreTo = React.useRef<HTMLElement | null>(null)

  // Captured during render rather than in an effect. React runs a child's
  // effects before its parent's, so `Dialog` focuses its first control before
  // this component's effects run — capturing in an effect stored the dialog's
  // own first button instead of the trigger, and closing put focus back inside
  // the element that had just been unmounted. Render is the last point before
  // any effect has moved focus. The `null` guard makes it fire once per open.
  if (isOpen && restoreTo.current === null) {
    if (
      typeof document !== 'undefined' &&
      document.activeElement instanceof HTMLElement
    ) {
      restoreTo.current = document.activeElement
    }
  }
  // Set before the listeners are torn down so the focusin guard stops pulling
  // focus back while focus is on its way out.
  const closing = React.useRef(false)

  // Declared first, cleaned up first: capture the trigger, lock scrolling and
  // hide the page behind.
  React.useEffect(() => {
    if (!isOpen) return
    const node = ref.current
    if (!node) return

    const releaseScroll = lockScroll()
    const releaseSiblings = hideSiblings(node)
    focusFirstIn(node)

    return () => {
      closing.current = true
      releaseSiblings()
      releaseScroll()
    }
  }, [isOpen])

  // Declared second, so its listeners are removed before the restore below.
  React.useEffect(() => {
    if (!isOpen) return
    const node = ref.current
    if (!node) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onOpenChange?.(false)
        return
      }
      trapTab(node, event)
    }

    const onFocusIn = (event: FocusEvent) => {
      // Focus escaping to the page behind means the trap failed; pull it back.
      // Skipped while closing, otherwise this fights the restore below and the
      // focus ends up on <body>.
      if (closing.current) return
      if (!node.contains(event.target as Node)) {
        const focusable = getFocusableElements(node)
        ;(focusable[0] ?? node).focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('focusin', onFocusIn, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('focusin', onFocusIn, true)
    }
  }, [isOpen, onOpenChange])

  // Declared last: React runs cleanups in declaration order, so by this point
  // the listeners above are gone and focusing the trigger cannot be undone.
  React.useEffect(() => {
    if (isOpen) return
    const target = restoreTo.current
    restoreTo.current = null
    closing.current = false
    target?.focus()
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      ref={ref}
      data-bdocs-modal-overlay=""
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-black/50',
        className,
      )}
      {...rest}
      onClick={(e) => {
        onClick?.(e)
        if (isDismissable && e.target === e.currentTarget) {
          onOpenChange?.(false)
        }
      }}
    >
      {children}
    </div>
  )
}

ModalOverlay.displayName = 'ModalOverlay'

export interface ModalProps extends React.HTMLAttributes<HTMLDivElement> {
  isOpen?: boolean
  isDismissable?: boolean
  onOpenChange?: (isOpen: boolean) => void
  children?: React.ReactNode
}

/** The modal surface. Renders nothing when closed. */
export function Modal(props: ModalProps): React.ReactElement | null {
  const { isOpen = false, children, className, ...rest } = props
  if (!isOpen) return null

  return (
    <div
      data-bdocs-modal=""
      className={cn('relative z-50', className)}
      {...rest}
    >
      {children}
    </div>
  )
}

Modal.displayName = 'Modal'
