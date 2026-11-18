import * as React from 'react'
import { composeRenderProps, filterDOMProps, type RenderProps } from './utils'

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
  /**
   * Index of the option that is active, for `aria-activedescendant`.
   *
   * Only meaningful together with `items`: the index is matched against the
   * position each rendered option was given by the list, so exactly one item is
   * focused rather than every item when an index is present.
   */
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

  const generatedListId = React.useId()
  // A caller-supplied id wins everywhere: on the list element and in the derived
  // option ids. Otherwise an Autocomplete pointing at `listBoxId="results"`
  // would announce an active descendant id the list never rendered.
  const listId = props.id ?? generatedListId
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
        className={resolved.className}
        style={resolved.style}
        {...domProps}
      >
        {typeof children === 'function'
          ? itemList
            ? itemList.map((item, index) => (
                <ListBoxItemIndexContext.Provider
                  key={optionKey(item, index)}
                  value={index}
                >
                  {children(item, index)}
                </ListBoxItemIndexContext.Provider>
              ))
            : null
          : children}
      </div>
    </ListBoxContext.Provider>
  )
}

ListBox.displayName = 'ListBox'

/**
 * Stable key for a rendered option. Derived from a caller-supplied `id`/`key`
 * where the item has one, and from its position otherwise — the latter is what
 * keeps the React key warning away for plain strings and numbers.
 */
function optionKey(item: unknown, index: number): string {
  if (item && typeof item === 'object') {
    const id =
      (item as { id?: unknown; key?: unknown }).id ??
      (item as { id?: unknown; key?: unknown }).key
    if (id !== undefined && id !== null) return String(id)
  }
  return String(index)
}

/**
 * Id given to an option rendered from `items` at `index`.
 *
 * `Autocomplete` uses it to derive `aria-activedescendant` from its own
 * `listBoxId`, so the input and the list agree without the caller wiring ids by
 * hand. An explicit `id` on a `ListBoxItem` still wins.
 */
export function getListBoxOptionId(listId: string, index: number): string {
  return `${listId}-option-${index}`
}

/** Position of an option inside `items`, set by `ListBox` for each rendered item. */
const ListBoxItemIndexContext = React.createContext<number | undefined>(
  undefined,
)

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
  /**
   * Position of this option. Supplied automatically for items rendered through
   * `ListBox items={…}`; pass it yourself for a hand-written list that uses
   * `activeIndex` / `aria-activedescendant`.
   */
  index?: number
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
    index: indexProp,
    children,
    className,
    ...rest
  } = props
  const ctx = useListBox('ListBoxItem')
  // Provided by `ListBox` when this item came from `items`. Without it (items
  // written out by hand) an explicit `id` is the only way to match this option
  // against a caller-owned `aria-activedescendant`.
  const registeredIndex = React.useContext(ListBoxItemIndexContext)
  const index = indexProp ?? registeredIndex
  const generatedId = React.useId()
  const itemId =
    id ??
    (index !== undefined ? getListBoxOptionId(ctx.listId, index) : generatedId)
  const key = (props['data-key'] ?? textValue ?? itemId) as string
  const isSelected = ctx.selected.has(key)
  // Compare against this option's own position. Using just
  // `ctx.activeIndex !== undefined` marked *every* option focused as soon as an
  // active index existed, so a search list showed the "Select" hint on every
  // result at once.
  const isFocused = index !== undefined && ctx.activeIndex === index

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
      data-focused={isFocused || undefined}
      className={className}
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
