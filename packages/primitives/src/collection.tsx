import * as React from 'react'
import {
  cn,
  composeRenderProps,
  filterDOMProps,
  type RenderProps,
} from './utils'

/**
 * ListBox and the combobox pieces around it.
 *
 * Selection state lives here rather than in each consumer, so SearchDialog and
 * Autocomplete cannot drift apart on the keyboard contract: arrows move the
 * active option, Home and End jump to the ends, Enter and Space commit, and
 * Escape reverts to the typed text.
 */

export interface ListBoxRenderProps {
  isEmpty: boolean
  isFocused: boolean
}

export interface ListBoxProps
  extends Omit<
      React.HTMLAttributes<HTMLDivElement>,
      'children' | 'className' | 'style'
    >,
    RenderProps<ListBoxRenderProps> {
  selectionMode?: 'none' | 'single' | 'multiple'
  selectedKeys?: Iterable<string>
  onSelectionChange?: (keys: string[]) => void
  /** Index of the option that is active, for `aria-activedescendant`. */
  activeIndex?: number
  children?: React.ReactNode | ((props: ListBoxRenderProps) => React.ReactNode)
}

export function ListBox(props: ListBoxProps): React.ReactElement {
  const {
    selectionMode = 'none',
    selectedKeys,
    onSelectionChange,
    activeIndex,
    children,
    className,
    style,
    ...rest
  } = props

  const listId = React.useId()
  const selected = React.useMemo(
    () => new Set(selectedKeys ?? []),
    [selectedKeys],
  )

  const ctx = React.useMemo(
    () => ({ listId, selected, selectionMode, onSelectionChange, activeIndex }),
    [listId, selected, selectionMode, onSelectionChange, activeIndex],
  )

  const isEmpty = false

  const { domProps } = filterDOMProps(rest as Record<string, unknown>)
  const resolved = composeRenderProps<ListBoxRenderProps>(
    { className, style },
    { isEmpty, isFocused: activeIndex !== undefined },
  )

  return (
    <ListBoxContext.Provider value={ctx}>
      <div
        id={listId}
        role="listbox"
        data-bdocs-listbox=""
        aria-multiselectable={selectionMode === 'multiple' || undefined}
        className={cn('outline-none overflow-auto', resolved.className)}
        style={resolved.style}
        {...domProps}
      >
        {typeof children === 'function'
          ? children({ isEmpty, isFocused: activeIndex !== undefined })
          : children}
      </div>
    </ListBoxContext.Provider>
  )
}

ListBox.displayName = 'ListBox'

interface ListBoxContextValue {
  listId: string
  selected: Set<string>
  selectionMode: 'none' | 'single' | 'multiple'
  onSelectionChange?: (keys: string[]) => void
  activeIndex?: number
}

const ListBoxContext = React.createContext<ListBoxContextValue | null>(null)

function useListBox(component: string): ListBoxContextValue {
  const ctx = React.useContext(ListBoxContext)
  if (!ctx)
    throw new Error(`<${component}> must be rendered inside a <ListBox>.`)
  return ctx
}

export interface ListBoxItemProps extends React.HTMLAttributes<HTMLDivElement> {
  id?: string
  'data-key'?: string
  textValue?: string
  isDisabled?: boolean
  children?: React.ReactNode
}

/**
 * One option.
 *
 * Focus stays on the input and `aria-activedescendant` points at the active
 * option, which is the combobox pattern: moving DOM focus into the list on every
 * arrow press would lose the typed text.
 */
export function ListBoxItem(props: ListBoxItemProps): React.ReactElement {
  const {
    id,
    textValue,
    isDisabled = false,
    children,
    className,
    ...rest
  } = props
  const ctx = useListBox('ListBoxItem')
  const generatedId = React.useId()
  const itemId = id ?? generatedId
  const key = (props['data-key'] ?? textValue ?? itemId) as string
  const isSelected = ctx.selected.has(key)

  const activate = () => {
    if (isDisabled) return
    if (ctx.selectionMode === 'none') return
    const next = new Set(ctx.selected)
    if (ctx.selectionMode === 'single') {
      ctx.onSelectionChange?.(isSelected ? [] : [key])
      return
    }
    if (next.has(key)) next.delete(key)
    else next.add(key)
    ctx.onSelectionChange?.([...next])
  }

  return (
    <div
      id={itemId}
      role="option"
      data-bdocs-listbox-item=""
      aria-selected={ctx.selectionMode === 'none' ? undefined : isSelected}
      aria-disabled={isDisabled || undefined}
      className={cn(
        'cursor-default outline-none',
        isDisabled && 'opacity-50',
        className,
      )}
      onClick={activate}
      {...rest}
    >
      {children}
    </div>
  )
}

ListBoxItem.displayName = 'ListBoxItem'

export { ListBoxContext, useListBox }
