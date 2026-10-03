import type * as React from 'react'

/**
 * Shared plumbing for the primitives.
 *
 * The point of this package is that behaviour is implemented here rather than
 * delegated, so these are the pieces that would otherwise be pulled from
 * `react-aria-components`: render-prop composition, prop filtering that keeps
 * framework props off the DOM, and slot merging.
 */

export interface RenderProps<T> {
  className?: string | ((values: T) => string)
  style?: React.CSSProperties | ((values: T) => React.CSSProperties)
  children?: React.ReactNode | ((values: T) => React.ReactNode)
}

export type PropsOf<T> =
  T extends React.JSXElementConstructor<infer P> ? P : never

/**
 * Resolves a prop that accepts either a value or a function of render state.
 *
 * Every primitive accepts `className`, `style` and `children` in both forms so a
 * caller can style a component from its own state — a selected menu item, a
 * pressed toggle — without the component having to know about that state.
 */
export function composeRenderProps<T>(
  props: RenderProps<T>,
  values: T,
): {
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
} {
  const resolve = <V>(value: V | ((v: T) => V)): V =>
    typeof value === 'function' ? (value as (v: T) => V)(values) : value

  return {
    className:
      props.className === undefined ? undefined : resolve(props.className),
    style: props.style === undefined ? undefined : resolve(props.style),
    children:
      props.children === undefined ? undefined : resolve(props.children),
  }
}

/** Joins class names, dropping anything falsy. */
export function cn(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ')
}

type Primitive = 'button' | 'a' | 'input' | 'div' | 'span' | 'li'

export type PrimitiveTag = Primitive

/**
 * Props that are meaningful to this package but meaningless — and React-invalid
 * — on a DOM element. They are consumed by the primitive and never forwarded.
 *
 * `isDisabled` is the clearest example of why this has to be explicit: it is
 * the name react-aria used, and forwarding it puts an unknown attribute on
 * every `<button>`.
 */
const CONSUMED = new Set([
  'isDisabled',
  'isOpen',
  'isSelected',
  'isFocused',
  'isPressed',
  'isHovered',
  'isFocusVisible',
  'isRequired',
  'isInvalid',
  'isReadOnly',
  'onPress',
  'onPressStart',
  'onPressEnd',
  'onPressChange',
  'onPressUp',
  'onPressScrollStart',
  'onPressScrollEnd',
  'onHoverStart',
  'onHoverEnd',
  'onHoverChange',
  'onFocusChange',
  'onBlurChange',
  'onKeyDown',
  'onKeyUp',
  'onOpenChange',
  'onClose',
  'onAction',
  'autoFocusValue',
  'shouldCloseOnInteractOutside',
  'shouldCloseOnEscape',
  'isNonControllable',
  'isExiting',
  'isEntering',
  'portalContainer',
  'disableFocusManagement',
  'shouldFlip',
  'placement',
  'triggerRef',
  'popoverRef',
])

/**
 * Splits props into the ones a DOM element should receive and the ones this
 * package consumes.
 *
 * Everything not in {@link CONSUMED} is forwarded, so a caller can pass
 * `data-*`, `aria-*`, `form`, `name` and friends through without this file
 * having to know about them.
 */
export function filterDOMProps<P extends Record<string, unknown>>(
  props: P,
): {
  domProps: Record<string, unknown>
  propTypes: Record<string, unknown>
} {
  const domProps: Record<string, unknown> = {}
  const propTypes: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue
    // React owns these; forwarding them warns or double-applies.
    if (key === 'children' || key === 'key' || key === 'ref') continue
    if (CONSUMED.has(key)) {
      propTypes[key] = value
      continue
    }
    domProps[key] = value
  }

  return { domProps, propTypes }
}
