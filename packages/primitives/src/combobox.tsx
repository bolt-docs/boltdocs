import * as React from 'react'
import {
  cn,
  composeRenderProps,
  filterDOMProps,
  type RenderProps,
} from './utils'

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
    <div className="relative flex items-center">
      <Input
        type="search"
        role="searchbox"
        placeholder={placeholder}
        className={className}
        {...rest}
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
        <button type="button" aria-label="Clear search" onClick={onClear}>
          ×
        </button>
      )}
      {resultMessage && (
        <span role="status" aria-live="polite" className="sr-only">
          {typeof resultMessage === 'function'
            ? resultMessage(resultCount)
            : resultMessage}
        </span>
      )}
    </div>
  )
}

SearchField.displayName = 'SearchField'

export interface AutocompleteRenderProps {
  isOpen: boolean
  isEmpty: boolean
  hasValue: boolean
}

export interface AutocompleteProps
  extends Omit<
      SearchFieldProps,
      'children' | 'className' | 'style' | 'defaultOpen'
    >,
    RenderProps<AutocompleteRenderProps> {
  /** Id of the listbox this input controls, for `aria-controls`. */
  listBoxId?: string
  /** Id of the active option, for `aria-activedescendant`. */
  activeDescendantId?: string
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
export function Autocomplete(props: AutocompleteProps): React.ReactElement {
  const {
    listBoxId,
    activeDescendantId,
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

  return (
    <div className="relative">
      <Input
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listBoxId}
        aria-activedescendant={activeDescendantId}
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
                cn(
                  'w-full',
                  className(values as unknown as AutocompleteRenderProps),
                )
            : cn('w-full', className)) as
            | string
            | ((values: { isEmpty: boolean }) => string)
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
          }
        }}
        {...rest}
      />
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
