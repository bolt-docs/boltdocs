import * as React from 'react'
import { composeRenderProps, filterDOMProps, type RenderProps } from './utils'

export interface ButtonRenderProps {
  isHovered: boolean
  isPressed: boolean
  isFocused: boolean
  isFocusVisible: boolean
  isDisabled: boolean
}

export interface ButtonProps
  extends Omit<
      React.ButtonHTMLAttributes<HTMLButtonElement>,
      'children' | 'className' | 'style'
    >,
    RenderProps<ButtonRenderProps> {
  /** Renders an `<a>` instead of a `<button>` when set. */
  href?: string
  /**
   * The underlying control.
   *
   * Declared explicitly because `filterDOMProps` drops `ref` along with `key`
   * and `children`, which React owns. Without this a wrapper that needs to focus
   * or measure the trigger — `MenuTrigger` returning focus to it, for one —
   * cannot reach the DOM node at all.
   */
  ref?: React.Ref<HTMLButtonElement>
  /** Disables interaction. Sets `disabled` and blocks press events. */
  isDisabled?: boolean
  onPress?: (e: React.SyntheticEvent) => void
  onPressStart?: (e: React.SyntheticEvent) => void
  onPressEnd?: (e: React.SyntheticEvent) => void
  onPressChange?: (isPressed: boolean) => void
  onHoverStart?: () => void
  onHoverEnd?: () => void
  onHoverChange?: (isHovered: boolean) => void
  onFocusChange?: (isFocused: boolean) => void
  /** Renders `<button type="button">` by default, never `submit`. */
  type?: 'button' | 'submit' | 'reset'
  /** Suppresses the focus ring for pointer users while keeping keyboard focus visible. */
  excludeFromTabOrder?: boolean
}

/**
 * A button.
 *
 * Three decisions worth stating, because each of them is a way the obvious
 * implementation is wrong:
 *
 * - `type` defaults to `button`, not `submit`. A button inside a form that
 *   submits it by accident is the single most common button bug, and react-aria
 *   got this right by default.
 * - Press is a real `click`, so Enter and Space come from the platform rather
 *   than from re-implemented key handlers. That is what keeps activation working
 *   with IME, with browser find-as-you-type, and with assistive tech that
 *   synthesises clicks.
 * - A disabled button uses the `disabled` attribute, so it leaves the tab order
 *   and is announced as disabled, rather than staying focusable with
 *   `aria-disabled` for no benefit.
 */
export function Button(props: ButtonProps): React.ReactElement {
  const {
    href,
    ref,
    isDisabled = false,
    type = 'button',
    className,
    style,
    children,
    onPress,
    onPressStart,
    onPressEnd,
    onPressChange,
    onHoverStart,
    onHoverEnd,
    onHoverChange,
    onFocusChange,
    onClick: onClickProp,
    onPointerDown: onPointerDownProp,
    onPointerUp: onPointerUpProp,
    onPointerLeave: onPointerLeaveProp,
    onPointerEnter: onPointerEnterProp,
    onFocus: onFocusProp,
    onBlur: onBlurProp,
    autoFocus,
    excludeFromTabOrder,
    ...rest
  } = props

  const [isHovered, setHovered] = React.useState(false)
  const [isPressed, setPressed] = React.useState(false)
  const [isFocused, setFocused] = React.useState(false)
  // :focus-visible only matches keyboard focus, so this is the real signal for
  // "should I draw a focus ring", not :focus.
  const [isFocusVisible, setFocusVisible] = React.useState(false)

  const resolved = composeRenderProps<ButtonRenderProps>(
    { className, style, children },
    { isHovered, isPressed, isFocused, isFocusVisible, isDisabled },
  )

  const { domProps } = filterDOMProps(rest as Record<string, unknown>)

  const activate = (e: React.SyntheticEvent) => {
    if (isDisabled) return
    onPress?.(e as React.MouseEvent)
  }

  const interactive = {
    onClick: (e: React.MouseEvent) => {
      if (isDisabled) {
        e.preventDefault()
        e.stopPropagation()
        return
      }
      onClickProp?.(e as unknown as React.MouseEvent<HTMLButtonElement>)
      activate(e)
    },
    onPointerDown: (e: React.PointerEvent) => {
      if (!isDisabled) {
        onPointerDownProp?.(
          e as unknown as React.PointerEvent<HTMLButtonElement>,
        )
        setPressed(true)
        onPressChange?.(true)
        onPressStart?.(e)
      }
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (!isDisabled) {
        onPointerUpProp?.(e as unknown as React.PointerEvent<HTMLButtonElement>)
        onPressEnd?.(e)
      }
    },
    onPointerLeave: (e: React.PointerEvent) => {
      onPointerLeaveProp?.(
        e as unknown as React.PointerEvent<HTMLButtonElement>,
      )
      setHovered(false)
      setPressed(false)
      onHoverEnd?.()
      onHoverChange?.(false)
    },
    onPointerEnter: (e: React.PointerEvent) => {
      onPointerEnterProp?.(
        e as unknown as React.PointerEvent<HTMLButtonElement>,
      )
      if (isDisabled) return
      setHovered(true)
      onHoverStart?.()
      onHoverChange?.(true)
    },
    onFocus: (e: React.FocusEvent) => {
      onFocusProp?.(e as unknown as React.FocusEvent<HTMLButtonElement>)
      setFocused(true)
      setFocusVisible(true)
      onFocusChange?.(true)
    },
    onBlur: (e: React.FocusEvent) => {
      onBlurProp?.(e as unknown as React.FocusEvent<HTMLButtonElement>)
      setFocused(false)
      setFocusVisible(false)
      setPressed(false)
      onFocusChange?.(false)
    },
  }

  // `disabled` is only valid on a real control. On an anchor it is an unknown
  // attribute React warns about, so the link branch relies on aria-disabled and
  // on dropping the href instead.
  const shared = {
    className: resolved.className,
    style: resolved.style,
    ...(excludeFromTabOrder ? { tabIndex: -1 } : {}),
    ...(autoFocus !== undefined ? { autoFocus } : {}),
    ...domProps,
    ...interactive,
  }

  if (href !== undefined) {
    return (
      <a
        {...(shared as Record<string, unknown>)}
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={isDisabled ? undefined : href}
        role="button"
        aria-disabled={isDisabled || undefined}
        // An anchor does not fire click on Enter/Space the way a button does.
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            activate(e)
          }
        }}
      >
        {resolved.children}
      </a>
    )
  }

  return (
    <button
      {...(shared as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      ref={ref}
      type={type}
      disabled={isDisabled}
    >
      {resolved.children}
    </button>
  )
}

Button.displayName = 'Button'

export interface ToggleButtonRenderProps extends ButtonRenderProps {
  isSelected: boolean
}

export interface ToggleButtonProps
  extends Omit<
      ButtonProps,
      // `onChange` is re-declared below as the toggled value, not the DOM event.
      'aria-pressed' | 'className' | 'style' | 'children' | 'onChange'
    >,
    RenderProps<ToggleButtonRenderProps> {
  isSelected?: boolean
  /**
   * Called with the state the button should move to. Firing with `!isSelected`
   * rather than mutating keeps the caller in charge of the state, so the button
   * cannot drift out of sync with what it is displaying.
   */
  onChange?: (isSelected: boolean) => void
}

/**
 * A button with a persistent selected state.
 *
 * `aria-pressed` rather than `aria-selected`: a toggle button is a button whose
 * pressed state is announced, and `aria-selected` belongs to option/listbox
 * roles. Getting this wrong makes a screen reader announce nothing about state.
 */
export function ToggleButton(props: ToggleButtonProps): React.ReactElement {
  const {
    isSelected = false,
    onChange,
    onPress,
    className,
    style,
    children,
    ...rest
  } = props

  const resolved = composeRenderProps<ToggleButtonRenderProps>(
    { className, style, children },
    {
      isSelected,
      isHovered: false,
      isPressed: false,
      isFocused: false,
      isFocusVisible: false,
      isDisabled: rest.isDisabled ?? false,
    },
  )

  return (
    <Button
      {...rest}
      aria-pressed={isSelected}
      className={resolved.className}
      style={resolved.style}
      // Both handlers fire: `onChange` reports the new state, `onPress` reports
      // the interaction, and a caller passing only one must not lose the other.
      onPress={(pressProps) => {
        onPress?.(pressProps)
        onChange?.(!isSelected)
      }}
    >
      {resolved.children}
    </Button>
  )
}

ToggleButton.displayName = 'ToggleButton'
