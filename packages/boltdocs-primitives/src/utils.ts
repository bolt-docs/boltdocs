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

/** Accepted by {@link cn}: strings, conditionals, arrays and key maps. */
export type ClassValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ClassValue[]
  | { [key: string]: unknown }
  // A render-prop `className` is resolved by the primitive before it reaches
  // `cn`; accepting it here keeps theme wrappers from having to cast it away.
  | ((...args: never[]) => unknown)

/**
 * Joins class names, dropping anything falsy.
 *
 * Hand-written rather than delegated to `clsx`: the theme wrappers pass nested
 * arrays, conditional maps and (already-resolved) render-prop class names, so
 * this is the one implementation both packages share.
 */
export function cn(...values: ClassValue[]): string {
  const result: string[] = []
  const append = (value: ClassValue): void => {
    if (!value) return
    if (typeof value === 'string' || typeof value === 'number') {
      result.push(String(value))
      return
    }
    if (Array.isArray(value)) {
      for (const item of value) append(item)
      return
    }
    if (typeof value === 'object') {
      for (const [key, enabled] of Object.entries(value)) {
        if (enabled) result.push(key)
      }
    }
  }
  for (const value of values) append(value)
  return result.join(' ')
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
 *
 * `onKeyDown` and `onKeyUp` are deliberately absent. Every primitive here
 * handles keys and then calls the caller's handler, and a component composed of
 * others — SearchField wrapping Input — has to be able to pass one down.
 */
const CONSUMED = new Set([
  'isDisabled',
  'isOpen',
  'isSelected',
  'isExiting',
  'onPress',
  'onPressStart',
  'onPressEnd',
  'onPressChange',
  'onHoverStart',
  'onHoverEnd',
  'onHoverChange',
  'onFocusChange',
  'onOpenChange',
  'onClose',
  'onAction',
  'shouldCloseOnEscape',
  'triggerRef',
  // SearchField/Autocomplete own these; without this they reached <input> as
  // invalid DOM attributes (resultMessage, resultCount, onClear, onSubmit).
  'resultMessage',
  'resultCount',
  'onClear',
  'onSubmit',
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
