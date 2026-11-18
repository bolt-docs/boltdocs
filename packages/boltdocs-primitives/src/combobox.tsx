import * as React from 'react'
import { composeRenderProps, filterDOMProps, type RenderProps } from './utils'
import { getListBoxOptionId } from './collection'

/**
 * The combobox pattern: a text input that filters a list of options.
 *
 * DOM focus stays in the input and `aria-activedescendant` points at the active
 * option. That is the part that is easy to get wrong: moving real focus into the
 * list on every arrow press loses what the user typed, and typing then does not
 * return focus to the input.
 */

export interface InputProps
  extends Omit<
      React.InputHTMLAttributes<HTMLInputElement>,
      // `onSubmit` is omitted because the field redefines it to receive the
      // value rather than a form event; leaving the DOM one in place makes the
      // two incompatible.
      'children' | 'className' | 'style' | 'value' | 'onChange' | 'onSubmit'
    >,
    RenderProps<{ isEmpty: boolean }> {
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  isDisabled?: boolean
}

/** A plain text input. `onChange` receives the value, not the event. */
export function Input(props: InputProps): React.ReactElement {
  const {
    value,
    defaultValue = '',
    onChange,
    isDisabled = false,
    className,
    style,
    children,
    ...rest
  } = props

  const [internal, setInternal] = React.useState(defaultValue)
  const isControlled = value !== undefined
  const current = isControlled ? value : internal

  const setValue = (next: string) => {
    if (!isControlled) setInternal(next)
    onChange?.(next)
  }

  const { domProps } = filterDOMProps(rest as Record<string, unknown>)
  const resolved = composeRenderProps<{ isEmpty: boolean }>(
    { className, style },
    { isEmpty: current.length === 0 },
  )

  return (
    <input
      value={current}
      disabled={isDisabled}
      className={resolved.className}
      style={resolved.style}
      onChange={(e) => setValue(e.target.value)}
      {...domProps}
    />
  )
}

Input.displayName = 'Input'

/** Shared by SearchField and Autocomplete so neither leaks these to the DOM. */
function SearchClearButton({
  onClear,
  className,
}: {
  onClear: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label="Clear search"
      className={className}
      onClick={onClear}
    >
      ×
    </button>
  )
}

// Visually hiding an announced status is behaviour, not appearance: the text
// must reach a screen reader without taking space on screen. Inline styles keep
// it working in projects that do not ship a `sr-only` utility class.
const VISUALLY_HIDDEN: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: 0,
}

function SearchResultStatus({
  message,
  count,
}: {
  message?: string | ((count: number) => string)
  count: number
}) {
  if (!message) return null
  return (
    <span role="status" aria-live="polite" style={VISUALLY_HIDDEN}>
      {typeof message === 'function' ? message(count) : message}
    </span>
  )
}

export interface SearchFieldRenderProps {
  isEmpty: boolean
  hasValue: boolean
}

export interface SearchFieldProps extends InputProps {
  /** Rendered when the field has no value. */
  placeholder?: string
  /** Announced count of results, or a custom message. */
  resultMessage?: string | ((count: number) => string)
  resultCount?: number
  onClear?: () => void
  onSubmit?: (value: string) => void
}

/**
 * A search field.
 *
 * `type="search"` with `role="searchbox"`, and a clear button only when there is
 * something to clear — a permanently present clear button is an unlabeled
 * control for a keyboard user.
 */
export function SearchField(props: SearchFieldProps): React.ReactElement {
  const {
    placeholder = 'Search',
    resultMessage,
    resultCount = 0,
    onClear,
    onSubmit,
    className,
    ...rest
  } = props

  // Tracked internally as well, so the clear button appears for an uncontrolled
  // field. Reading `rest.value` alone meant it never appeared at all.
  const [tracked, setTracked] = React.useState(rest.defaultValue ?? '')
  const isControlled = rest.value !== undefined
  const current = isControlled ? String(rest.value) : tracked
  const hasValue = current.length > 0

  return (
    <div data-bdocs-search-field="">
      <Input
        type="search"
        role="searchbox"
        placeholder={placeholder}
        className={className}
        {...rest}
        // The field owns the displayed value; `Input` must not keep a second
        // copy, or clearing here leaves the old text on screen.
        value={current}
        onChange={(next) => {
          if (!isControlled) setTracked(next)
          rest.onChange?.(next)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onSubmit?.(e.currentTarget.value)
          }
        }}
      />
      {hasValue && onClear && (
        <SearchClearButton
          onClear={() => {
            // Clear the field as well as notifying the caller: with an
            // uncontrolled SearchField the old value otherwise stayed on
            // screen while `onClear` reported it gone.
            if (!isControlled) setTracked('')
            rest.onChange?.('')
            onClear()
          }}
        />
      )}
      <SearchResultStatus message={resultMessage} count={resultCount} />
    </div>
  )
}

SearchField.displayName = 'SearchField'

export interface AutocompleteRenderProps {
  isOpen: boolean
  isEmpty: boolean
  hasValue: boolean
}

export interface AutocompleteProps<T = unknown>
  extends Omit<
      SearchFieldProps,
      'children' | 'className' | 'style' | 'defaultOpen'
    >,
    RenderProps<AutocompleteRenderProps> {
  /** Options this input filters, for the render-prop children. */
  items?: Iterable<T>
  /** Id of the listbox this input controls, for `aria-controls`. */
  listBoxId?: string
  /** Class for the clear button the primitive renders when `onClear` is set. */
  clearButtonClassName?: string
  /** Id of the active option, for `aria-activedescendant`. */
  activeDescendantId?: string
  /**
   * Position of the active option. When `listBoxId` is also given, the option id
   * is derived from it, so the input and a `ListBox` render-prop list agree
   * without the caller synchronising two ids by hand.
   */
  activeIndex?: number
  isOpen?: boolean
  defaultOpen?: boolean
  onOpenChange?: (isOpen: boolean) => void
  children?:
    | React.ReactNode
    | ((props: AutocompleteRenderProps) => React.ReactNode)
}

/**
 * A search input driving a filtered list of options.
 *
 * ARIA: `role="combobox"` with `aria-expanded`, `aria-controls` pointing at the
 * listbox and `aria-activedescendant` at the active option. `aria-autocomplete`
 * is `list`, which is what tells a screen reader the list filters as you type
 * rather than being a separate thing to go and find.
 */
export function Autocomplete<T = unknown>(
  props: AutocompleteProps<T>,
): React.ReactElement {
  const {
    listBoxId,
    activeDescendantId,
    activeIndex,
    isOpen: controlledOpen,
    defaultOpen = false,
    onOpenChange,
    onKeyDown,
    onFocus,
    onBlur,
    className,
    style,
    children,
    value,
    defaultValue = '',
    onChange,
    resultMessage,
    resultCount = 0,
    onClear,
    clearButtonClassName,
    onSubmit,
    ...rest
  } = props

  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const isOpen = controlledOpen ?? uncontrolledOpen
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }

  const [internal, setInternal] = React.useState(defaultValue)
  const isControlled = value !== undefined
  const current = isControlled ? value : internal

  const inputId = React.useId()
  const resolvedActiveDescendantId =
    activeDescendantId ??
    (listBoxId !== undefined && activeIndex !== undefined
      ? getListBoxOptionId(listBoxId, activeIndex)
      : undefined)

  return (
    <div data-bdocs-autocomplete="">
      <Input
        // Spread first: the combobox wiring below must win. Spreading last meant
        // a caller's `role` or `aria-expanded` silently replaced the primitive's
        // own ARIA, leaving a combobox that announced itself as a plain input.
        {...rest}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listBoxId}
        aria-activedescendant={resolvedActiveDescendantId}
        aria-autocomplete="list"
        aria-label={rest['aria-label'] ?? 'Search'}
        id={inputId}
        autoComplete="off"
        // Resolved to the input's own render-prop shape before being handed
        // down: `className` here is typed against AutocompleteRenderProps and
        // Input's against its own, and the two are structurally different.
        className={
          (typeof className === 'function'
            ? (values: { isEmpty: boolean }) =>
                className(values as unknown as AutocompleteRenderProps)
            : className) as string | ((values: { isEmpty: boolean }) => string)
        }
        style={
          (typeof style === 'function'
            ? (values: { isEmpty: boolean }) =>
                style(values as unknown as AutocompleteRenderProps)
            : style) as
            | React.CSSProperties
            | ((values: { isEmpty: boolean }) => React.CSSProperties)
        }
        value={current}
        onChange={(next) => {
          if (!isControlled) setInternal(next)
          onChange?.(next)
          // Typing reopens the list; a stale closed list after a keystroke is a
          // dead end for a screen-reader user.
          if (!isOpen) setOpen(true)
        }}
        onFocus={(e) => {
          onFocus?.(e)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e)
          if (e.key === 'Escape') {
            if (isOpen) {
              e.preventDefault()
              setOpen(false)
            }
            return
          }
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            // Not prevented: the consumer moves the active option from here,
            // and it knows the option count.
            if (!isOpen) setOpen(true)
          } else if (e.key === 'Enter') {
            onSubmit?.(current)
          }
        }}
      />
      {current.length > 0 && onClear && (
        <SearchClearButton
          className={clearButtonClassName}
          onClear={() => {
            if (!isControlled) setInternal('')
            onChange?.('')
            onClear()
          }}
        />
      )}
      <SearchResultStatus message={resultMessage} count={resultCount} />
      {typeof children === 'function'
        ? children({
            isOpen,
            isEmpty: current.length === 0,
            hasValue: current.length > 0,
          })
        : children}
    </div>
  )
}

Autocomplete.displayName = 'Autocomplete'
