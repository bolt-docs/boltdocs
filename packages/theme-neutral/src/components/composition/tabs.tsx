import { cn } from '../../utils/cn'
import type { ComponentBase } from './types'

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
    <div className={cn('bdocs-tabs', className)} {...props}>
      {children}
    </div>
  )
}

function TabsList({
  children,
  className,
  role,
}: ComponentBase & {
  /**
   * Pass `null` when the "tabs" are plain navigation links (e.g. section
   * tabs rendered as anchors): an ARIA `tablist` requires `tab` children and
   * breaks otherwise. Omit to get the standard widget role.
   */
  role?: string | null
}) {
  return (
    <div
      role={role === null ? undefined : (role ?? 'tablist')}
      className={cn('bdocs-tabs__list', className)}
    >
      {children}
    </div>
  )
}

function TabsItem({
  children,
  id,
  selected,
  className = '',
  ...props
}: TabsItemProps) {
  return (
    <button
      role="tab"
      aria-selected={selected}
      data-selected={selected}
      className={cn('bdocs-tabs__tab', className)}
      {...props}
    >
      {children}
    </button>
  )
}

function TabsContent({ children, className = '' }: ComponentBase) {
  return <div className={cn('bdocs-tabs__panel', className)}>{children}</div>
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
