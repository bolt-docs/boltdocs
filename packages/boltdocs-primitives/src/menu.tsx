import * as React from 'react'
import {
  cn,
  composeRenderProps,
  filterDOMProps,
  type RenderProps,
} from './utils'
import {
  Separator,
  type SeparatorProps,
  type SeparatorRenderProps,
} from './separator'

/**
 * The menu button pattern from the WAI-ARIA authoring practices.
 *
 * Two decisions carry the whole component:
 *
 * - Roving tabindex, not `aria-activedescendant`. Only the item the user has
 *   reached has `tabIndex={0}`; the rest are `-1`. Tab therefore enters the menu
 *   at the current item, and the browser's own focus handling does the work.
 * - A registry, not a DOM query. Items register on mount and the list is sorted
 *   by document position. `querySelectorAll` would also pick up items inside a
 *   nested submenu, which is what makes arrows in nested menus jump wrong.
 */

interface MenuItemEntry {
  el: HTMLElement
  disabled: boolean
  textValue: string
}

interface MenuContextValue {
  register: (el: HTMLElement, info: Omit<MenuItemEntry, 'el'>) => () => void
  entries: () => MenuItemEntry[]
  selectionMode: 'none' | 'single' | 'multiple'
  selected: Set<string>
  onSelectionChange?: (keys: string[]) => void
  onAction: (el: HTMLElement, intent: 'press' | 'close') => void
  onClose: () => void
}

const MenuContext = React.createContext<MenuContextValue | null>(null)

function useMenuContext(component: string): MenuContextValue {
  const ctx = React.useContext(MenuContext)
  if (!ctx) throw new Error(`<${component}> must be rendered inside a <Menu>.`)
  return ctx
}

/** Document order, so a nested submenu's items do not join the parent list. */
function inDocumentOrder(a: HTMLElement, b: HTMLElement): number {
  if (a === b) return 0
  const position = a.compareDocumentPosition(b)
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1
  if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1
  return 0
}

/**
 * Ids for menu wiring, from React's `useId`.
 *
 * Deliberately not a module-level counter. A counter restarts at a different
 * value on the server than in the browser, so ids diverge across the hydration
 * boundary — and when an id feeds an `aria-controls` or `aria-labelledby` pair
 * the tree is rejected and re-rendered on the client. React Aria needed an
 * `SSRProvider` to patch over exactly that; `useId` is the same value on both
 * sides by construction, so there is nothing to patch.
 */
function useMenuId(prefix: string): string {
  return `${prefix}-${React.useId()}`
}

/** How long typed characters accumulate into one typeahead search. */
const TYPEAHEAD_RESET_MS = 500

export interface MenuRenderProps {
  selectionMode: 'none' | 'single' | 'multiple'
  isEmpty: boolean
}

export interface MenuProps
  extends Omit<
      React.HTMLAttributes<HTMLElement>,
      'children' | 'className' | 'style' | 'onChange'
    >,
    RenderProps<MenuRenderProps> {
  children?: React.ReactNode | ((props: MenuRenderProps) => React.ReactNode)
  selectionMode?: 'none' | 'single' | 'multiple'
  /** Keys of the selected items, for a menu that selects. */
  selectedKeys?: Iterable<string>
  onSelectionChange?: (keys: string[]) => void
  onAction?: (key: string) => void
  onClose?: () => void
  'aria-label'?: string
}

/**
 * A menu.
 *
 * Owns the whole keyboard contract: arrows move between enabled items, Home and
 * End jump to the ends, Enter and Space activate, Escape closes, and typing
 * letters jumps to a matching item.
 */
export function Menu(props: MenuProps): React.ReactElement {
  const {
    children,
    selectionMode = 'none',
    selectedKeys,
    onSelectionChange,
    onAction,
    onClose,
    className,
    style,
    autoFocus,
    ...rest
  } = props

  const registry = React.useRef(new Set<MenuItemEntry>())
  const typeahead = React.useRef<{
    buffer: string
    timer?: ReturnType<typeof setTimeout>
  }>({ buffer: '' })

  const menuId = useMenuId('menu')

  const entries = React.useCallback(
    () =>
      [...registry.current]
        .filter((entry) => !entry.disabled && entry.el.isConnected)
        .sort((a, b) => inDocumentOrder(a.el, b.el)),
    [],
  )

  const register = React.useCallback(
    (el: HTMLElement, info: Omit<MenuItemEntry, 'el'>) => {
      const entry: MenuItemEntry = { el, ...info }
      registry.current.add(entry)
      return () => {
        registry.current.delete(entry)
      }
    },
    [],
  )

  const move = React.useCallback(
    (from: HTMLElement | null, step: 1 | -1) => {
      const list = entries()
      if (list.length === 0) return
      const index = from ? list.findIndex((e) => e.el === from) : -1
      const next =
        index === -1
          ? step === 1
            ? 0
            : list.length - 1
          : (index + step + list.length) % list.length
      list[next]?.el.focus()
    },
    [entries],
  )

  const moveToEnd = React.useCallback(
    (last: boolean) => {
      const list = entries()
      if (list.length === 0) return
      ;(last ? list[list.length - 1] : list[0])?.el.focus()
    },
    [entries],
  )

  const runTypeahead = React.useCallback(
    (char: string) => {
      const state = typeahead.current
      const lower = char.toLowerCase()

      // Repeating one letter cycles through the items starting with it rather
      // than searching for "ss". Anything else accumulates, so "op" finds Open.
      state.buffer =
        state.buffer.length > 0 &&
        state.buffer[state.buffer.length - 1] === lower
          ? lower
          : state.buffer + lower

      if (state.timer) clearTimeout(state.timer)
      state.timer = setTimeout(() => {
        state.buffer = ''
      }, TYPEAHEAD_RESET_MS)

      const list = entries()
      if (list.length === 0) return

      // Repeating a letter cycles through the items starting with it, which is
      // what a menu is expected to do, so search from the current position.
      const active = document.activeElement as HTMLElement | null
      const startAt = active ? list.findIndex((e) => e.el === active) : -1
      const ordered =
        startAt === -1
          ? list
          : [...list.slice(startAt + 1), ...list.slice(0, startAt + 1)]

      // Compared case-insensitively. The buffer is lowercased so it can be
      // reset and compared cheaply, and the item text keeps its own casing for
      // display — comparing the two directly made every capitalised item
      // unreachable by typeahead.
      const match = ordered.find((e) =>
        e.textValue.toLowerCase().startsWith(state.buffer),
      )
      match?.el.focus()
    },
    [entries],
  )

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const active = document.activeElement as HTMLElement | null

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        move(active, 1)
        return
      case 'ArrowUp':
        event.preventDefault()
        move(active, -1)
        return
      case 'Home':
        event.preventDefault()
        moveToEnd(false)
        return
      case 'End':
        event.preventDefault()
        moveToEnd(true)
        return
      case 'Escape':
        event.preventDefault()
        event.stopPropagation()
        onClose?.()
        return
      default:
        break
    }

    // Typeahead, but not with a modifier held: Ctrl+Home is not "h".
    if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      runTypeahead(event.key)
    }
  }

  const selected = React.useMemo(
    () => new Set<string>(Array.from(selectedKeys ?? [])),
    [selectedKeys],
  )

  const ctx = React.useMemo<MenuContextValue>(
    () => ({
      register,
      entries,
      selectionMode,
      selected,
      onSelectionChange,
      onAction: (el, intent) => {
        const key = el.dataset.bdocsMenuKey
        if (key) onAction?.(key)
        if (intent === 'close') onClose?.()
      },
      onClose: () => onClose?.(),
    }),
    [
      register,
      entries,
      selectionMode,
      selected,
      onSelectionChange,
      onAction,
      onClose,
    ],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount only; re-running would yank focus away from a user who had already arrowed elsewhere
  React.useEffect(() => {
    if (autoFocus !== false) move(null, 1)
  }, [])

  const { domProps } = filterDOMProps(rest as Record<string, unknown>)
  const isEmpty = entries().length === 0
  const resolved = composeRenderProps<MenuRenderProps>(
    { className, style },
    { selectionMode, isEmpty },
  )

  return (
    <MenuContext.Provider value={ctx}>
      <div
        id={menuId}
        role="menu"
        tabIndex={-1}
        data-bdocs-menu=""
        className={cn('outline-none overflow-auto', resolved.className)}
        style={resolved.style}
        onKeyDown={onKeyDown}
        {...domProps}
      >
        {typeof children === 'function'
          ? children({ selectionMode, isEmpty })
          : children}
      </div>
    </MenuContext.Provider>
  )
}

Menu.displayName = 'Menu'

export interface MenuItemRenderProps {
  isSelected: boolean
  isFocused: boolean
  hasSubmenu: boolean
  selectionMode: 'none' | 'single' | 'multiple'
}

export interface MenuItemProps
  extends Omit<
      React.HTMLAttributes<HTMLDivElement>,
      'children' | 'className' | 'style'
    >,
    RenderProps<MenuItemRenderProps> {
  id?: string
  /** Value reported to `Menu.onAction`. */
  'data-key'?: string
  /** Used for typeahead when the visible content is not plain text. */
  textValue?: string
  isDisabled?: boolean
  isSelected?: boolean
  selectionMode?: 'none' | 'single' | 'multiple'
  hasSubmenu?: boolean
  onAction?: () => void
  children?: React.ReactNode | ((props: MenuItemRenderProps) => React.ReactNode)
}

/**
 * A menu item.
 *
 * The role follows the selection mode — `menuitem`, `menuitemradio` or
 * `menuitemcheckbox` — and `aria-checked` is emitted only when the menu can
 * select. A plain `menuitem` carrying `aria-checked` is not a combination the
 * authoring practices define, and a screen reader has no announcement for it.
 */
export function MenuItem(props: MenuItemProps): React.ReactElement {
  const {
    id,
    textValue,
    isDisabled = false,
    isSelected = false,
    selectionMode: itemSelectionMode,
    hasSubmenu = false,
    onAction,
    children,
    className,
    style,
    onKeyDown,
    onFocus,
    onBlur,
    onClick,
    'data-key': dataKey,
    ...rest
  } = props

  const ctx = useMenuContext('MenuItem')
  const ref = React.useRef<HTMLDivElement>(null)
  const [isFocused, setFocused] = React.useState(false)
  const generatedId = useMenuId('menuitem')
  const itemId = id ?? generatedId
  const selectionMode = itemSelectionMode ?? ctx.selectionMode
  const key = dataKey ?? textValue ?? itemId
  const isSelectedInMenu =
    selectionMode === 'none' ? false : ctx.selected.has(key)
  // The authoring practices use a different role per selection mode:
  // `menuitemradio` for one-of-many and `menuitemcheckbox` for many-of-many.
  // A plain `menuitem` carrying `aria-checked` is not a role that pattern defines,
  // and a screen reader has no announcement for it.
  const role =
    selectionMode === 'single'
      ? 'menuitemradio'
      : selectionMode === 'multiple'
        ? 'menuitemcheckbox'
        : 'menuitem'

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    return ctx.register(el, {
      disabled: isDisabled,
      textValue: (textValue ?? el.textContent ?? '').trim(),
    })
  }, [ctx, isDisabled, textValue])

  // Roving tabindex: only the focused item is in the tab order.
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    if (isFocused) el.setAttribute('tabindex', '0')
    else el.setAttribute('tabindex', '-1')
  }, [isFocused])

  const { domProps } = filterDOMProps(rest as Record<string, unknown>)
  const resolved = composeRenderProps<MenuItemRenderProps>(
    { className, style },
    {
      isSelected: isSelected || isSelectedInMenu,
      isFocused,
      hasSubmenu,
      selectionMode,
    },
  )

  const activate = () => {
    if (isDisabled) return

    if (ctx.selectionMode !== 'none' && key) {
      if (ctx.selectionMode === 'single') {
        const next = ctx.selected.has(key) ? [] : [key]
        ctx.onSelectionChange?.(next)
      } else {
        const next = new Set(ctx.selected)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        ctx.onSelectionChange?.([...next])
      }
    }

    onAction?.()
    ctx.onAction(ref.current as HTMLElement, 'press')
  }

  return (
    <div
      ref={ref}
      id={itemId}
      role={role}
      data-bdocs-menu-item=""
      {...(dataKey ? { 'data-bdocs-menu-key': dataKey } : {})}
      aria-disabled={isDisabled || undefined}
      // Either route marks the item: the prop for a caller that owns the state,
      // or the menu's own selection for one that lets the menu own it.
      {...(selectionMode === 'none'
        ? {}
        : {
            'aria-checked': isSelected || isSelectedInMenu,
            // Boltdocs styles selected items with `data-selected:`, so the
            // attribute has to exist even where the role does not carry it.
            'data-selected': isSelected || isSelectedInMenu ? true : undefined,
          })}
      {...domProps}
      className={cn(
        'group relative flex flex-row items-center cursor-default outline-none',
        isDisabled && 'opacity-50',
        resolved.className,
      )}
      style={resolved.style}
      onClick={(e) => {
        onClick?.(e)
        activate()
      }}
      onKeyDown={(e) => {
        onKeyDown?.(e)
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          activate()
        }
      }}
      onFocus={(e) => {
        onFocus?.(e)
        setFocused(true)
      }}
      onBlur={(e) => {
        onBlur?.(e)
        setFocused(false)
      }}
    >
      {typeof children === 'function'
        ? children({
            isSelected: isSelected || isSelectedInMenu,
            isFocused,
            hasSubmenu,
            selectionMode,
          })
        : children}
    </div>
  )
}

MenuItem.displayName = 'MenuItem'

export interface HeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode
}

/** A section heading inside a menu. Not focusable and not an item. */
export function Header({
  children,
  className,
  ...rest
}: HeaderProps): React.ReactElement {
  return (
    <div className={cn('select-none', className)} {...rest}>
      {children}
    </div>
  )
}

Header.displayName = 'Header'

export interface MenuSectionProps {
  title?: string
  headerClassName?: string
  className?: string
  children?: React.ReactNode
}

/**
 * A group of menu items with an optional heading.
 *
 * `role="group"` with `aria-labelledby` on the heading, so the heading is
 * announced when the user enters the group instead of being an unassociated
 * string sitting in the middle of the menu.
 */
export function MenuSection(props: MenuSectionProps): React.ReactElement {
  const { title, headerClassName, className, children } = props
  const headingId = useMenuId('menusection')
  return (
    <div role="group" aria-labelledby={title ? headingId : undefined}>
      {title && (
        <Header id={headingId} className={headerClassName}>
          {title}
        </Header>
      )}
      <div className={cn('flex flex-col', className)}>{children}</div>
    </div>
  )
}

MenuSection.displayName = 'MenuSection'

/** A divider between groups of items. */
export function MenuSeparator(props: SeparatorProps): React.ReactElement {
  // `className` here may be a render function, which `cn` cannot take. The
  // separator resolves it, so the border class is merged on the way in.
  const { className, ...rest } = props
  const resolved =
    typeof className === 'function'
      ? (values: SeparatorRenderProps) => cn('border-t', className(values))
      : cn('border-t', className)
  return <Separator {...rest} className={resolved} />
}

MenuSeparator.displayName = 'MenuSeparator'

const MenuTriggerContext = React.createContext<{ onClose: () => void }>({
  onClose: () => {},
})

/**
 * Tags that are already activatable on their own. Anything else handed to
 * `MenuTrigger` as a trigger gets wrapped in a `button`.
 */
const INTERACTIVE_TAGS = new Set(['a', 'button', 'input', 'select', 'textarea'])

export interface MenuTriggerProps {
  children: React.ReactNode
  isOpen?: boolean
  defaultOpen?: boolean
  onOpenChange?: (isOpen: boolean) => void
  className?: string
  triggerClassName?: string
  disabled?: boolean
}

/**
 * The button that opens a menu.
 *
 * ArrowDown and ArrowUp both open it, and Up opens onto the last item, which is
 * what lets a keyboard user reach the bottom of a long menu without arrowing
 * through everything above it first.
 */
export function MenuTrigger(props: MenuTriggerProps): React.ReactElement {
  const {
    children,
    isOpen: controlledOpen,
    defaultOpen = false,
    onOpenChange,
    className,
    triggerClassName,
    disabled = false,
  } = props

  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const isOpen = controlledOpen ?? uncontrolledOpen

  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }

  const [child, menu] = React.useMemo(
    () => [
      React.Children.toArray(children)[0],
      React.Children.toArray(children)[1],
    ],
    [children],
  )

  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const menuId = useMenuId('menu-trigger')
  const shouldFocusLast = React.useRef(false)

  const onTriggerKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      shouldFocusLast.current = event.key === 'ArrowUp'
      setOpen(true)
    }
  }

  const close = () => {
    setOpen(false)
    // Focus returns to the trigger. Without this a keyboard user is dropped at
    // the top of the document after closing a menu.
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  React.useEffect(() => {
    if (!isOpen) return
    const menuEl = document.getElementById(menuId)
    if (!menuEl) return
    const items = menuEl.querySelectorAll<HTMLElement>('[role="menuitem"]')
    const target = shouldFocusLast.current ? items[items.length - 1] : items[0]
    ;(target ?? menuEl).focus()
  }, [isOpen, menuId])

  // The trigger is *cloned*, not wrapped. An earlier version rendered its own
  // `<button>` around the child, which produced `<button><button>…</button></button>`
  // for the common case of a caller passing a `Button` as the trigger: invalid
  // HTML, two tab stops' worth of control in one place, and a screen reader
  // announcing only the inner one while `aria-expanded` sat on the outer.
  const triggerProps = {
    ref: triggerRef,
    // `true` is the ARIA default for `menu`, and is what react-aria emitted;
    // the explicit token would change nothing for assistive tech.
    'aria-haspopup': 'true' as const,
    'aria-expanded': isOpen,
    // Points at the popup wrapper below, not at the trigger: the id is named
    // `menu-trigger-*` because the generator is shared, but it lands on the
    // element that actually holds the menu.
    'aria-controls': menuId,
    disabled,
    onClick: () => setOpen(!isOpen),
    onKeyDown: onTriggerKeyDown,
  }

  // Cloning is only right when the child is already a control. A `<span>` or a
  // `<div>` would receive `aria-expanded` and the handlers and still be nothing
  // a keyboard can reach and nothing a screen reader announces as activatable,
  // so those get wrapped in a real `<button>` instead. Components are cloned
  // rather than wrapped: they are the caller's own control and wrapping one that
  // renders a button is what produced the nested-button markup.
  const isControl =
    React.isValidElement(child) &&
    (typeof child.type !== 'string' ||
      INTERACTIVE_TAGS.has(child.type as string))

  const trigger = isControl
    ? React.cloneElement(child as React.ReactElement<Record<string, unknown>>, {
        ...triggerProps,
        className: cn(
          triggerClassName,
          (child.props as { className?: string }).className,
        ),
      })
    : React.createElement(
        'button',
        { ...triggerProps, type: 'button', className: triggerClassName },
        child,
      )

  return (
    <div className={cn('relative inline-block', className)}>
      <MenuTriggerContext.Provider value={{ onClose: close }}>
        {trigger}
        <div id={menuId} hidden={!isOpen}>
          {menu}
        </div>
      </MenuTriggerContext.Provider>
    </div>
  )
}

MenuTrigger.displayName = 'MenuTrigger'

export interface SubmenuTriggerProps {
  children: React.ReactNode
  className?: string
}

/**
 * An item that opens a nested menu.
 *
 * ArrowRight opens and ArrowLeft closes, following the tree convention.
 */
export function SubmenuTrigger(props: SubmenuTriggerProps): React.ReactElement {
  const { children, className } = props
  const parts = React.useMemo(
    () => React.Children.toArray(children),
    [children],
  )
  const [label, submenu] = [parts[0], parts[1]]
  const [open, setOpen] = React.useState(false)
  const submenuId = useMenuId('submenu')
  const ref = React.useRef<HTMLDivElement>(null)

  // Registers with the parent menu so arrow keys reach it. Without this it was
  // a `role="menuitem"` the parent's registry had never heard of, so ArrowDown
  // stepped straight over it.
  const parent = useMenuContext('SubmenuTrigger')
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    return parent.register(el, {
      disabled: false,
      textValue: (el.textContent ?? '').trim(),
    })
  }, [parent])

  return (
    <div
      ref={ref}
      role="menuitem"
      tabIndex={-1}
      aria-haspopup="true"
      aria-expanded={open}
      aria-controls={submenuId}
      className={cn('relative flex items-center outline-none', className)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          setOpen(true)
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault()
          setOpen(false)
        }
      }}
      onClick={() => setOpen((v) => !v)}
    >
      {label}
      <div id={submenuId} hidden={!open} role="menu">
        {submenu}
      </div>
    </div>
  )
}

SubmenuTrigger.displayName = 'SubmenuTrigger'

export interface CollectionProps<T> {
  items?: Iterable<T>
  children: React.ReactNode | ((item: T, index: number) => React.ReactNode)
}

/**
 * Renders a collection, or children directly when no items are given, so a
 * caller can write either form without caring which.
 */
export function Collection<T>(props: CollectionProps<T>): React.ReactNode {
  const { items, children } = props
  if (!items) return typeof children === 'function' ? null : children
  const list = Array.from(items)
  if (typeof children === 'function') {
    return <>{list.map((item, index) => children(item, index))}</>
  }
  return <>{children}</>
}

Collection.displayName = 'Collection'
