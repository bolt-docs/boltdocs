import * as React from 'react'
import { composeRenderProps, filterDOMProps, type RenderProps } from './utils'

/**
 * The tabs widget from the WAI-ARIA authoring practices, implemented here
 * rather than delegated to a component library.
 *
 * The two rules that matter most are easy to miss:
 *
 * - Only the selected tab is in the tab order; arrows move between tabs. That
 *   is roving tabindex, and it is what makes a tab strip one tab stop instead
 *   of five.
 * - Each tab owns a panel through `aria-controls`, and each panel points back
 *   with `aria-labelledby`. Without that pair the roles are decorative.
 */

export interface TabsRenderProps {
  isSelected: boolean
  isDisabled: boolean
  orientation: 'horizontal' | 'vertical'
}

export interface TabsProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    'children' | 'className' | 'style'
  > {
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
  /** Controlled selected tab id. */
  selectedKey?: string
  defaultSelectedKey?: string
  onSelectionChange?: (key: string) => void
  orientation?: 'horizontal' | 'vertical'
  /**
   * `manual` waits for Enter or Space to commit a focused tab; `automatic`
   * (the default) selects on arrow focus.
   */
  activationMode?: 'automatic' | 'manual'
  isDisabled?: boolean
}

interface TabsContextValue {
  baseId: string
  selectedKey: string
  setSelectedKey: (key: string) => void
  register: (key: string, el: HTMLElement, disabled: boolean) => () => void
  registered: () => { key: string; el: HTMLElement; disabled: boolean }[]
  orientation: 'horizontal' | 'vertical'
  activationMode: 'automatic' | 'manual'
  isDisabled: boolean
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

function useTabs(component: string): TabsContextValue {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error(`<${component}> must be rendered inside <Tabs>.`)
  return ctx
}

function useTabsId(prefix: string): string {
  return `${prefix}-${React.useId()}`
}

export function Tabs(props: TabsProps): React.ReactElement {
  const {
    selectedKey: controlledKey,
    defaultSelectedKey,
    onSelectionChange,
    orientation = 'horizontal',
    activationMode = 'automatic',
    isDisabled = false,
    children,
    className,
    style,
    ...rest
  } = props

  const baseId = useTabsId('bdocs-tabs')
  const items = React.useRef(
    new Map<string, { el: HTMLElement; disabled: boolean }>(),
  )
  const [uncontrolledKey, setUncontrolledKey] =
    React.useState(defaultSelectedKey)
  const selectedKey = controlledKey ?? uncontrolledKey

  const setSelectedKey = React.useCallback(
    (key: string) => {
      if (controlledKey === undefined) setUncontrolledKey(key)
      onSelectionChange?.(key)
    },
    [controlledKey, onSelectionChange],
  )

  const register = React.useCallback(
    (key: string, el: HTMLElement, disabled: boolean) => {
      items.current.set(key, { el, disabled })
      return () => {
        items.current.delete(key)
      }
    },
    [],
  )

  const registered = React.useCallback(
    () =>
      [...items.current.entries()]
        .filter(([, value]) => !value.disabled && value.el.isConnected)
        .map(([key, value]) => ({ key, ...value })),
    [],
  )

  // With no explicit selection, adopt the first enabled tab once it has
  // registered. Child effects run before this one, so the registry is populated
  // by the time we look — without this, every tab would start at tabIndex -1 and
  // the strip would have no keyboard entry point on first paint.
  React.useEffect(() => {
    if (controlledKey !== undefined) return
    if (selectedKey !== undefined) return
    const first = registered()[0]
    if (first) setSelectedKey(first.key)
  }, [controlledKey, selectedKey, registered, setSelectedKey])

  const ctx = React.useMemo<TabsContextValue>(
    () => ({
      baseId,
      selectedKey: selectedKey ?? '',
      setSelectedKey,
      register,
      registered,
      orientation,
      activationMode,
      isDisabled,
    }),
    [
      baseId,
      selectedKey,
      setSelectedKey,
      register,
      registered,
      orientation,
      activationMode,
      isDisabled,
    ],
  )

  const { domProps } = filterDOMProps(rest as Record<string, unknown>)

  return (
    <TabsContext.Provider value={ctx}>
      <div
        data-bdocs-tabs=""
        data-orientation={orientation}
        {...domProps}
        className={className}
        style={style}
      >
        {children}
      </div>
    </TabsContext.Provider>
  )
}

Tabs.displayName = 'Tabs'

export interface TabListProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'role'> {
  children?: React.ReactNode
  /**
   * `tablist` by default. Pass `null`, or a role such as `none`, for a
   * navigation row whose children are links rather than `tab` widgets.
   */
  role?: React.AriaRole | null
}

export function TabList({
  children,
  role = 'tablist',
  className,
  ...rest
}: TabListProps): React.ReactElement {
  const ctx = useTabs('TabList')
  const { domProps } = filterDOMProps(rest as Record<string, unknown>)
  return (
    // `aria-orientation` is present only when the role is `tablist`, where it
    // is valid. Biome sees the dynamic role on the element and cannot prove it.
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is tablist whenever aria-orientation is set
    <div
      {...domProps}
      role={role ?? undefined}
      aria-orientation={
        role === null
          ? undefined
          : ctx.orientation === 'vertical'
            ? 'vertical'
            : undefined
      }
      className={className}
    >
      {children}
    </div>
  )
}

TabList.displayName = 'TabList'

export interface TabRenderProps extends TabsRenderProps {}

export interface TabProps
  extends Omit<
      React.ButtonHTMLAttributes<HTMLButtonElement>,
      'children' | 'className' | 'style'
    >,
    RenderProps<TabRenderProps> {
  /** Stable id for this tab, shared with its panel. */
  id?: string
  /** Renders an anchor instead of a button, for tab-like navigation. */
  href?: string
  isSelected?: boolean
  isDisabled?: boolean
  /** Panel this tab controls. Defaults to the id derived from `Tabs`. */
  panelId?: string
  onPress?: () => void
  children?: React.ReactNode | ((props: TabRenderProps) => React.ReactNode)
}

export function Tab(props: TabProps): React.ReactElement {
  const {
    id,
    href,
    isSelected: selectedProp,
    isDisabled: disabledProp,
    panelId,
    onPress,
    children,
    className,
    style,
    onClick,
    onKeyDown,
    onFocus,
    ...rest
  } = props
  const ctx = useTabs('Tab')
  // Always called: an id from the caller only replaces the value, never the
  // hook call itself (hooks may not be conditional).
  const generatedId = useTabsId('bdocs-tab')
  const key = id ?? generatedId
  const ref = React.useRef<HTMLElement | null>(null)
  const isDisabled = disabledProp ?? ctx.isDisabled
  const isSelected = selectedProp ?? ctx.selectedKey === key

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    return ctx.register(key, el, isDisabled)
  }, [ctx, key, isDisabled])

  // Roving tabindex: the selected tab is the single tab stop. When nothing is
  // selected yet, the first enabled tab takes it.
  let tabIndex = -1
  if (!isDisabled) {
    const firstKey = ctx.registered()[0]?.key
    if (isSelected || (ctx.selectedKey === '' && firstKey === key)) {
      tabIndex = 0
    }
  }

  const resolved = composeRenderProps<TabRenderProps>(
    { className, style, children },
    { isSelected, isDisabled, orientation: ctx.orientation },
  )

  const { domProps } = filterDOMProps(rest as Record<string, unknown>)

  const move = (step: 1 | -1) => {
    const list = ctx.registered()
    if (list.length === 0) return
    const current = list.findIndex((item) => item.key === key)
    const next =
      current === -1
        ? step === 1
          ? 0
          : list.length - 1
        : (current + step + list.length) % list.length
    const target = list[next]
    target?.el.focus()
    if (ctx.activationMode === 'automatic' && target) {
      ctx.setSelectedKey(target.key)
    }
  }

  const shared = {
    ...domProps,
    id: key,
    role: 'tab' as const,
    'aria-selected': isSelected,
    'aria-controls': panelId ?? `${ctx.baseId}-panel-${key}`,
    'aria-disabled': isDisabled || undefined,
    'data-selected': isSelected || undefined,
    'data-disabled': isDisabled || undefined,
    tabIndex,
    className: resolved.className,
    style: resolved.style,
    onKeyDown: (event: React.KeyboardEvent) => {
      onKeyDown?.(event as unknown as React.KeyboardEvent<HTMLButtonElement>)
      if (event.defaultPrevented) return
      const previous = ctx.orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft'
      const next = ctx.orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight'
      if (event.key === previous || event.key === next) {
        event.preventDefault()
        move(event.key === next ? 1 : -1)
      } else if (event.key === 'Home') {
        event.preventDefault()
        const first = ctx.registered()[0]
        first?.el.focus()
        if (ctx.activationMode === 'automatic' && first)
          ctx.setSelectedKey(first.key)
      } else if (event.key === 'End') {
        event.preventDefault()
        const list = ctx.registered()
        const last = list[list.length - 1]
        last?.el.focus()
        if (ctx.activationMode === 'automatic' && last)
          ctx.setSelectedKey(last.key)
      } else if (
        (event.key === 'Enter' || event.key === ' ') &&
        ctx.activationMode === 'manual'
      ) {
        event.preventDefault()
        ctx.setSelectedKey(key)
      }
    },
    onFocus: (event: React.FocusEvent) => {
      onFocus?.(event as unknown as React.FocusEvent<HTMLButtonElement>)
      if (ctx.activationMode === 'automatic' && !isDisabled) {
        ctx.setSelectedKey(key)
      }
    },
  }

  if (href !== undefined) {
    return (
      <a
        {...(shared as unknown as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={isDisabled ? undefined : href}
        onClick={(event) => {
          if (isDisabled) {
            event.preventDefault()
            return
          }
          onClick?.(event as unknown as React.MouseEvent<HTMLButtonElement>)
          if (!event.defaultPrevented) {
            ctx.setSelectedKey(key)
            onPress?.()
          }
        }}
      >
        {resolved.children}
      </a>
    )
  }

  return (
    <button
      {...(shared as unknown as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      ref={ref as React.Ref<HTMLButtonElement>}
      type="button"
      disabled={isDisabled}
      onClick={(event) => {
        if (isDisabled) return
        onClick?.(event)
        if (!event.defaultPrevented) {
          ctx.setSelectedKey(key)
          onPress?.()
        }
      }}
    >
      {resolved.children}
    </button>
  )
}

Tab.displayName = 'Tab'

export interface TabPanelProps
  extends Omit<
      React.HTMLAttributes<HTMLDivElement>,
      'children' | 'className' | 'style'
    >,
    RenderProps<TabRenderProps> {
  /** Id of the tab that labels and controls this panel. */
  tabId?: string
  children?: React.ReactNode | ((props: TabRenderProps) => React.ReactNode)
}

export function TabPanel(props: TabPanelProps): React.ReactElement {
  const { tabId, children, className, style, ...rest } = props
  const ctx = useTabs('TabPanel')
  const key = tabId ?? ctx.selectedKey
  const isSelected = key !== '' && key === ctx.selectedKey
  const resolved = composeRenderProps<TabRenderProps>(
    { className, style, children },
    { isSelected, isDisabled: ctx.isDisabled, orientation: ctx.orientation },
  )
  const { domProps } = filterDOMProps(rest as Record<string, unknown>)

  return (
    <div
      {...domProps}
      id={`${ctx.baseId}-panel-${key}`}
      role="tabpanel"
      aria-labelledby={key || undefined}
      // The authoring practices make the panel focusable so keyboard users can
      // reach content that contains no focusable children of its own.
      // biome-ignore lint/a11y/noNoninteractiveTabindex: tabpanel is a focusable widget part per WAI-ARIA
      tabIndex={0}
      hidden={!isSelected}
      data-selected={isSelected || undefined}
      className={resolved.className}
      style={resolved.style}
    >
      {resolved.children}
    </div>
  )
}

TabPanel.displayName = 'TabPanel'
