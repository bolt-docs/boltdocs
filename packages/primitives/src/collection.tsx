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

export interface ListBoxProps<T = unknown>
  extends Omit<
      React.HTMLAttributes<HTMLDivElement>,
      'children' | 'className' | 'style'
    >,
    // `children` is re-declared below to take an item rather than the list's
    // own render state, which is the form `items` needs.
    Omit<RenderProps<ListBoxRenderProps>, 'children'> {
  selectionMode?: 'none' | 'single' | 'multiple'
  selectedKeys?: Iterable<string>
  onSelectionChange?: (keys: string[]) => void
  /**
   * Called with the key of an activated option. Independent of `selectionMode`:
   * a list with no selection at all is exactly the "pick one and go" case, such
   * as a search result list that navigates on click, and that has to work
   * without a selection mode.
   */
  onAction?: (key: string) => void
  /** Index of the option that is active, for `aria-activedescendant`. */
  activeIndex?: number
  /** Options in this list. Rendered per item by the render-prop children. */
  items?: Iterable<T>
  children?: React.ReactNode | ((item: T, index: number) => React.ReactNode)
}

export function ListBox<T = unknown>(
  props: ListBoxProps<T>,
): React.ReactElement {
  const {
    selectionMode = 'none',
    selectedKeys,
    onSelectionChange,
    onAction,
    activeIndex,
    items,
    children,
    className,
    style,
    ...rest
  } = props

  const listId = React.useId()
  const selected = React.useMemo(
    () => new Set<string>(Array.from(selectedKeys ?? [])),
    [selectedKeys],
  )

  const ctx = React.useMemo(
    () => ({
      listId,
      selected,
      selectionMode,
      onSelectionChange,
      onAction,
      activeIndex,
    }),
    [listId, selected, selectionMode, onSelectionChange, onAction, activeIndex],
  )

  // Only knowable when the caller passes `items`. Reported as false otherwise
  // rather than guessed: a consumer that has not told us its length cannot be
  // told it is empty.
  const itemList = items ? Array.from(items) : undefined
  const isEmpty = itemList ? itemList.length === 0 : false

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
        data-empty={itemList && isEmpty ? 'true' : undefined}
        className={cn('outline-none overflow-auto', resolved.className)}
        style={resolved.style}
        {...domProps}
      >
        {typeof children === 'function'
          ? itemList
            ? itemList.map((item, index) => children(item, index))
            : null
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
  onAction?: (key: string) => void
  activeIndex?: number
}

const ListBoxContext = React.createContext<ListBoxContextValue | null>(null)

function useListBox(component: string): ListBoxContextValue {
  const ctx = React.useContext(ListBoxContext)
  if (!ctx)
    throw new Error(`<${component}> must be rendered inside a <ListBox>.`)
  return ctx
}

export interface ListBoxItemRenderProps {
  isSelected: boolean
  isDisabled: boolean
  /** Whether `aria-activedescendant` currently points at this option. */
  isFocused: boolean
}

export interface ListBoxItemProps
  // `children` is re-declared below to also accept the render-prop form, which
  // is not assignable to the DOM attribute's `ReactNode`.
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  id?: string
  'data-key'?: string
  textValue?: string
  isDisabled?: boolean
  /** Either plain children or a render function receiving the item's state. */
  children?:
    | React.ReactNode
    | ((props: ListBoxItemRenderProps) => React.ReactNode)
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
  const isFocused = ctx.activeIndex !== undefined

  const activate = () => {
    if (isDisabled) return
    ctx.onAction?.(key)
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
    // biome-ignore lint/a11y/useFocusableInteractive: reached with aria-activedescendant from the owning input, which is the combobox pattern; moving DOM focus into the list would drop the typed text
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
      {typeof children === 'function'
        ? children({ isSelected, isDisabled, isFocused })
        : children}
    </div>
  )
}

ListBoxItem.displayName = 'ListBoxItem'

export { ListBoxContext, useListBox }
