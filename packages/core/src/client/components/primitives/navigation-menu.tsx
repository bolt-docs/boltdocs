import * as RAC from 'react-aria-components'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../utils/cn'
import type { ComponentBase, CompoundComponent } from './types'

export interface NavigationMenuItemProps extends ComponentBase {
  label: string
}

export interface NavigationMenuLinkProps
  extends Omit<ComponentBase, 'children'> {
  href: string
  label: string
  description?: string
  children?:
    | React.ReactNode
    | ((opts: RAC.MenuItemRenderProps) => React.ReactNode)
}

export type NavigationMenuComponent = CompoundComponent<
  ComponentBase,
  {
    List: React.FC<ComponentBase>
    Item: React.FC<NavigationMenuItemProps>
    Link: React.FC<NavigationMenuLinkProps>
  }
>

export const NavigationMenu = ({
  children,
  className,
  ...props
}: ComponentBase) => {
  return (
    <nav className={cn('relative flex items-center', className)} {...props}>
      {children}
    </nav>
  )
}

const NavigationMenuList = ({ children, className }: ComponentBase) => {
  return (
    <div className={cn('flex list-none items-center gap-1', className)}>
      {children}
    </div>
  )
}

const NavigationMenuItem = ({
  children,
  label,
  className,
}: NavigationMenuItemProps) => {
  return (
    <RAC.MenuTrigger>
      <RAC.Button
        className={cn(
          'flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium outline-none transition-colors cursor-pointer',
          'text-muted hover:bg-surface hover:text-body',
          'focus-visible:ring-2 focus-visible:ring-primary-500/30',
          className,
        )}
      >
        {label}
        <ChevronDown size={14} className="transition-transform" />
      </RAC.Button>
      <RAC.Popover
        placement="bottom start"
        className="entering:animate-in entering:fade-in entering:zoom-in-95 exiting:animate-out exiting:fade-out exiting:zoom-out-95 fill-mode-forwards"
      >
        <RAC.Menu className="w-56 outline-none rounded-xl border border-subtle bg-surface p-2 shadow-xl ring-1 ring-strong/5">
          {children as any}
        </RAC.Menu>
      </RAC.Popover>
    </RAC.MenuTrigger>
  )
}

const NavigationMenuLink = ({
  label,
  href,
  description,
  className,
  children,
  ...props
}: NavigationMenuLinkProps) => {
  return (
    <RAC.MenuItem
      href={href}
      className={cn(
        'block rounded-lg px-3 py-2 text-sm outline-none cursor-pointer transition-colors',
        'hover:bg-soft focus:bg-soft',
        className,
      )}
      {...props}
    >
      {children || (
        <>
          <div className="font-semibold text-body">{label}</div>
          {description && (
            <div className="text-xs text-muted line-clamp-1 mt-0.5">
              {description}
            </div>
          )}
        </>
      )}
    </RAC.MenuItem>
  )
}

NavigationMenu.Root = NavigationMenu
NavigationMenu.List = NavigationMenuList
NavigationMenu.Item = NavigationMenuItem
NavigationMenu.Link = NavigationMenuLink
