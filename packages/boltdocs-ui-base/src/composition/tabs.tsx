import {
  Tab as PrimitiveTab,
  TabList as PrimitiveTabList,
  TabPanel as PrimitiveTabPanel,
  Tabs as PrimitiveTabs,
} from '@bdocs/primitives'
import { cn } from '../utils/cn'
import type { ComponentBase } from './types'

/**
 * TheTabs widget, styled by this theme.
 *
 * All keyboard behaviour — roving tabindex, arrow keys, Home/End, the
 * `tab`/`tabpanel` aria pairing — lives in `@bdocs/primitives`. This file only
 * attaches the `bdocs-*` class names, so the theme stays a styling layer and the
 * accessibility contract has a single implementation to test.
 */

export interface TabsItemProps extends ComponentBase {
  id: string
  selected?: boolean
  onClick?: () => void
  onKeyDown?: (event: React.KeyboardEvent) => void
  disabled?: boolean
}

export interface TabsIndicatorProps extends ComponentBase {
  style?: React.CSSProperties
}

export function Tabs({ children, className = '', ...props }: ComponentBase) {
  return (
    <PrimitiveTabs className={cn('bdocs-tabs', className)} {...props}>
      {children}
    </PrimitiveTabs>
  )
}

function TabsList({
  children,
  className,
  role,
}: ComponentBase & {
  /**
   * Pass `null` (as the navigation-tabs component does) when these are anchors
   * rather than a real tab widget: a `tablist` requires `tab` children and axe
   * rejects the row otherwise.
   */
  role?: React.AriaRole | null
}) {
  return (
    <PrimitiveTabList
      role={role === undefined ? 'tablist' : role}
      className={cn('bdocs-tabs__list', className)}
    >
      {children}
    </PrimitiveTabList>
  )
}

function TabsItem({
  children,
  id,
  selected,
  disabled,
  className = '',
  ...props
}: TabsItemProps) {
  return (
    <PrimitiveTab
      id={id}
      isSelected={selected}
      isDisabled={disabled}
      className={cn('bdocs-tabs__tab', className)}
      {...props}
    >
      {children}
    </PrimitiveTab>
  )
}

function TabsContent({
  children,
  className = '',
  tabId,
}: ComponentBase & { tabId?: string }) {
  return (
    <PrimitiveTabPanel
      tabId={tabId}
      className={cn('bdocs-tabs__panel', className)}
    >
      {children}
    </PrimitiveTabPanel>
  )
}

function TabsIndicator({ className = '', style }: TabsIndicatorProps) {
  return (
    <div className={cn('bdocs-tabs__indicator', className)} style={style} />
  )
}

Tabs.Root = Tabs
Tabs.List = TabsList
Tabs.Item = TabsItem
Tabs.Content = TabsContent
Tabs.Indicator = TabsIndicator
