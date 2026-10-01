import { Check, ChevronRight } from '../ui-base/icons'
// Aliased named imports, not `import * as RAC`: a namespace import pulls the
// whole react-aria-components barrel into the client bundle because the bundler
// cannot prove which members are unused. The `RAC` aliases avoid colliding with
// this module's own `Menu`/`MenuItem`/`MenuSection`/… wrappers, which are part
// of the public API surface.
import {
  Collection,
  composeRenderProps,
  Header,
  Menu as RACMenu,
  MenuItem as RACMenuItem,
  type MenuItemProps as RACMenuItemProps,
  type MenuProps as RACMenuProps,
  MenuSection as RACMenuSection,
  type MenuSectionProps as RACMenuSectionProps,
  MenuTrigger as RACMenuTrigger,
  type MenuTriggerProps as RACMenuTriggerProps,
  Separator as RACSeparator,
  type SeparatorProps as RACSeparatorProps,
  SubmenuTrigger as RACSubmenuTrigger,
  type SubmenuTriggerProps as RACSubmenuTriggerProps,
} from 'react-aria-components'
import { Children } from 'react'
import { Popover, type PopoverProps } from './popover'
import { cn } from '../../utils/cn'

/**
 * MenuTrigger wraps a trigger (usually a Button) and a Menu.
 */
export interface MenuTriggerProps extends RACMenuTriggerProps {
  placement?: PopoverProps['placement']
  className?: string
}

function MenuTrigger({ placement, className, ...props }: MenuTriggerProps) {
  const [trigger, menu] = (
    Children.toArray(props.children) as React.ReactElement[]
  ).slice(0, 2)
  return (
    <RACMenuTrigger {...props}>
      {trigger as any}
      <Popover placement={placement} className={className}>
        {menu as any}
      </Popover>
    </RACMenuTrigger>
  )
}

/**
 * SubmenuTrigger for nested menus.
 */
export interface SubmenuTriggerProps extends RACSubmenuTriggerProps {
  className?: string
}

function SubmenuTrigger({ className, ...props }: SubmenuTriggerProps) {
  const [trigger, menu] = (
    Children.toArray(props.children) as React.ReactElement[]
  ).slice(0, 2)
  return (
    <RACSubmenuTrigger {...props}>
      {trigger as any}
      <Popover offset={-4} crossOffset={-4} className={className}>
        {menu as any}
      </Popover>
    </RACSubmenuTrigger>
  )
}

/**
 * The Menu container.
 */
export function Menu<T extends object>(props: RACMenuProps<T>) {
  return (
    <RACMenu
      {...props}
      className={composeRenderProps(props.className, (className) =>
        cn('outline-none overflow-auto', className),
      )}
    />
  )
}

/**
 * MenuItem with support for selection states and submenus.
 */
function MenuItem(
  props: RACMenuItemProps & {
    /** Class name for the content row. */
    contentClassName?: string
    /** Class name for the multi-select check slot. */
    checkClassName?: string
    /** Class name for the submenu chevron. */
    chevronClassName?: string
    /** Custom multi-select check indicator. Replaces the default check. */
    check?: React.ReactNode
    /** Custom submenu chevron. Replaces the default chevron. */
    chevron?: React.ReactNode
  },
) {
  const textValue =
    props.textValue ||
    (typeof props.children === 'string' ? props.children : undefined)
  const {
    contentClassName,
    checkClassName,
    chevronClassName,
    check,
    chevron,
    ...racProps
  } = props

  return (
    <RACMenuItem
      {...racProps}
      textValue={textValue}
      className={composeRenderProps(props.className, (className) =>
        cn(
          'group relative flex flex-row items-center cursor-default outline-none',
          className,
        ),
      )}
    >
      {composeRenderProps(
        props.children,
        (children, { selectionMode, isSelected, hasSubmenu }) => (
          <>
            {selectionMode === 'multiple' && (
              <span
                className={cn(
                  'flex items-center shrink-0 justify-center',
                  checkClassName,
                )}
              >
                {check ?? (isSelected ? <Check className="size-3.5" /> : null)}
              </span>
            )}
            <div
              className={cn(
                'flex flex-row w-full items-center',
                contentClassName,
              )}
            >
              {children}
            </div>
            {hasSubmenu && (
              <span className="ml-auto">
                {chevron ?? (
                  <ChevronRight className={cn('size-4', chevronClassName)} />
                )}
              </span>
            )}
          </>
        ),
      )}
    </RACMenuItem>
  )
}

/**
 * MenuSection for grouping items with an optional header.
 */
export interface MenuSectionProps<T> extends RACMenuSectionProps<T> {
  title?: string
  headerClassName?: string
}

function MenuSection<T extends object>({
  title,
  headerClassName,
  ...props
}: MenuSectionProps<T>) {
  return (
    <RACMenuSection {...props} className={cn('flex flex-col', props.className)}>
      {title && (
        <Header className={cn('select-none', headerClassName)}>{title}</Header>
      )}
      <Collection items={props.items}>{props.children}</Collection>
    </RACMenuSection>
  )
}

/**
 * MenuSeparator for visual division.
 */
function MenuSeparator(props: RACSeparatorProps) {
  return <RACSeparator {...props} className={cn('border-t', props.className)} />
}

Menu.Root = Menu
Menu.Item = MenuItem
Menu.Trigger = MenuTrigger
Menu.SubTrigger = SubmenuTrigger
Menu.Section = MenuSection
Menu.Separator = MenuSeparator
