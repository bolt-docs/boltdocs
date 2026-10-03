import * as React from 'react'
import { cn } from './utils'
import { focusFirstIn, getFocusableElements } from './focus'

/**
 * An anchored overlay.
 *
 * Positioning is deliberately CSS-only — anchored to its parent with
 * `position: absolute`. The full positioning engine react-aria ships, with
 * viewport collision and flipping, is not reimplemented here: Boltdocs anchors
 * popovers to a navbar or sidebar item where the layout already decides the
 * side, and a hand-rolled collision solver would be a large amount of code whose
 * behaviour could only be verified visually.
 *
 * What is implemented is the behaviour that is not optional: outside-press and
 * Escape dismissal, focus moving in and back out, and the dismissability rules
 * that make a popover usable with a keyboard.
 */

export interface PopoverProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  isOpen?: boolean
  onOpenChange?: (isOpen: boolean) => void
  /** Set false to keep a press outside from closing it. */
  isDismissable?: boolean
  shouldCloseOnEscape?: boolean
  /**
   * `true` moves focus into the popover on open, which is right for a menu or a
   * dialog. `false` leaves focus on the trigger, which is right for a tooltip or
   * anything non-interactive.
   */
  shouldFocusOnOpen?: boolean
  children?: React.ReactNode
}

export function Popover(props: PopoverProps): React.ReactElement | null {
  const {
    isOpen = false,
    onOpenChange,
    isDismissable = true,
    shouldCloseOnEscape = true,
    shouldFocusOnOpen = true,
    className,
    children,
    ...rest
  } = props

  const ref = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    if (!isOpen) return
    const node = ref.current
    if (!node) return

    // Captured during the effect, before focus moves, so it is the element the
    // user came from rather than something inside the popover.
    const active = document.activeElement as HTMLElement | null
    if (active && active !== document.body) triggerRef.current = active

    if (shouldFocusOnOpen) focusFirstIn(node)

    const onPointerDown = (event: PointerEvent) => {
      if (!isDismissable) return
      const target = event.target as Node
      if (node.contains(target) || triggerRef.current?.contains(target)) return
      onOpenChange?.(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (!shouldCloseOnEscape) return
      event.stopPropagation()
      onOpenChange?.(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [
    isOpen,
    isDismissable,
    shouldCloseOnEscape,
    shouldFocusOnOpen,
    onOpenChange,
  ])

  React.useEffect(() => {
    if (isOpen) return
    // Focus returns to whatever opened the popover, so a keyboard user is not
    // dropped at the top of the document on close.
    triggerRef.current?.focus()
    triggerRef.current = null
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      ref={ref}
      data-bdocs-popover=""
      className={cn(
        'z-50 overflow-auto outline-none transition-none absolute',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

Popover.displayName = 'Popover'

export interface TooltipProps {
  /** The trigger element. The tooltip attaches to it. */
  children: React.ReactElement
  content: React.ReactNode
  className?: string
  /** Delay before showing on hover, in ms. */
  delay?: number
}

/**
 * A tooltip.
 *
 * Shown on hover and on focus, because a keyboard user must be able to reach the
 * same information a mouse user gets. Dismissed with Escape, which is the one
 * WCAG criterion a tooltip fails most often.
 *
 * `aria-describedby` rather than `aria-label`: the tooltip describes its trigger,
 * and using `aria-label` would replace the trigger's own accessible name — for a
 * button with visible text, that makes the button announce the tooltip instead
 * of its own label.
 */
export function Tooltip(props: TooltipProps): React.ReactElement {
  const { children, content, className, delay = 200 } = props
  const [open, setOpen] = React.useState(false)
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const id = React.useId()

  const show = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(true), delay)
  }
  const hide = () => {
    if (timer.current) clearTimeout(timer.current)
    setOpen(false)
  }

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  // Escape is listened for on the document, not on the wrapper. The common way
  // to open a tooltip is hover, and then focus is nowhere near this element, so
  // a handler on the wrapper would never run — and a tooltip that cannot be
  // dismissed with Escape is the WCAG 2.1.1 failure this is meant to avoid.
  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      hide()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [open])

  const child = React.Children.only(children) as React.ReactElement<{
    onPointerEnter?: (e: React.PointerEvent) => void
    onPointerLeave?: (e: React.PointerEvent) => void
    onFocus?: (e: React.FocusEvent) => void
    onBlur?: (e: React.FocusEvent) => void
    'aria-describedby'?: string
  }>

  return (
    <span className="relative inline-flex">
      {React.cloneElement(child, {
        'aria-describedby': open ? id : child.props['aria-describedby'],
        onPointerEnter: (e: React.PointerEvent) => {
          child.props.onPointerEnter?.(e)
          show()
        },
        onPointerLeave: (e: React.PointerEvent) => {
          child.props.onPointerLeave?.(e)
          hide()
        },
        // Focus shows it too: a tooltip only reachable by hover is invisible to
        // a keyboard user.
        onFocus: (e: React.FocusEvent) => {
          child.props.onFocus?.(e)
          show()
        },
        onBlur: (e: React.FocusEvent) => {
          child.props.onBlur?.(e)
          hide()
        },
      })}
      {open && (
        <span
          id={id}
          role="tooltip"
          data-bdocs-tooltip=""
          className={cn('absolute z-50 whitespace-nowrap', className)}
        >
          {content}
        </span>
      )}
    </span>
  )
}

Tooltip.displayName = 'Tooltip'

export { getFocusableElements }
