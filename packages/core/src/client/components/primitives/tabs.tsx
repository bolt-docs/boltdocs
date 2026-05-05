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

export const Tabs = ({ children, className = '', ...props }: ComponentBase) => {
  return (
    <div className={cn('w-full', className)} {...props}>
      {children}
    </div>
  )
}

const TabsList = ({ children, className = '' }: ComponentBase) => {
  return (
    <div
      role="tablist"
      className={cn(
        'relative flex flex-row flex-nowrap items-center border-b border-subtle overflow-x-auto',
        className,
      )}
    >
      {children}
    </div>
  )
}

const TabsItem = ({
  children,
  id,
  selected,
  className = '',
  ...props
}: TabsItemProps) => {
  return (
    <button
      role="tab"
      aria-selected={selected}
      className={cn(
        'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors outline-none cursor-pointer bg-transparent border-none',
        selected ? 'text-primary-500' : 'text-muted hover:text-body',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

const TabsContent = ({ children, className = '' }: ComponentBase) => {
  return <div className={cn('p-4 outline-none', className)}>{children}</div>
}

const TabsIndicator = ({ className = '', style }: TabsIndicatorProps) => {
  return (
    <div
      className={cn(
        'absolute bottom-0 h-0.5 bg-primary-500 transition-all duration-300',
        className,
      )}
      style={style}
    />
  )
}

Tabs.Root = Tabs
Tabs.List = TabsList
Tabs.Item = TabsItem
Tabs.Content = TabsContent
Tabs.Indicator = TabsIndicator
