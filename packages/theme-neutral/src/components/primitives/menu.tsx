import { Children } from 'react'
import {
  Collection,
  Header,
  Menu as RACMenu,
  MenuItem as RACMenuItem,
  type MenuItemProps as RACMenuItemProps,
  type MenuProps as RACMenuProps,
  MenuSection as RACMenuSection,
  MenuTrigger as RACMenuTrigger,
  type MenuTriggerProps as RACMenuTriggerProps,
  Separator as RACSeparator,
  SubmenuTrigger as RACSubmenuTrigger,
} from '@bdocs/primitives'
import { Check, ChevronRight } from '../ui-base/icons'
import { Popover } from './popover'
import { cn } from '../../utils/cn'

/**
 * MenuTrigger wraps a trigger (usually a Button) and a Menu.
 */
export interface MenuTriggerProps extends RACMenuTriggerProps {
  className?: string
}

function MenuTrigger({ className, ...props }: MenuTriggerProps) {
  const [trigger, menu] = (
    Children.toArray(props.children) as React.ReactElement[]
  ).slice(0, 2)
  return (
    <RACMenuTrigger {...props}>
      {trigger}
      <Popover className={className}>{menu}</Popover>
    </RACMenuTrigger>
  )
}

/**
 * SubmenuTrigger for nested menus.
 */
export interface SubmenuTriggerProps
  extends Omit<SubmenuTriggerPropsBase, 'className'> {
  className?: string
}

type SubmenuTriggerPropsBase = {
  children: React.ReactNode
}

function SubmenuTrigger({ className, ...props }: SubmenuTriggerProps) {
  const [trigger, menu] = (
    Children.toArray(props.children) as React.ReactElement[]
  ).slice(0, 2)
  return (
    <RACSubmenuTrigger {...props}>
      {trigger}
      <Popover className={className}>{menu}</Popover>
    </RACSubmenuTrigger>
  )
}

/** The Menu container. */
export function Menu(props: RACMenuProps) {
  return <RACMenu {...props} className={cn('bdocs-menu', props.className)} />
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
    /** Custom multi-select check indicator. */
    check?: React.ReactNode
    /** Custom submenu chevron. */
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
    ...itemProps
  } = props

  // A caller may pass children as a render function; resolved here so the
  // render-prop branch below owns the whole decision.
  const children =
    typeof itemProps.children === 'function'
      ? undefined
      : (itemProps.children as React.ReactNode)

  return (
    <RACMenuItem
      {...itemProps}
      textValue={textValue}
      className={cn('bdocs-menu__item', props.className)}
    >
      {(values) => (
        <>
          {values.selectionMode === 'multiple' && (
            <span className={cn('bdocs-menu__check', checkClassName)}>
              {check ??
                (values.isSelected ? (
                  <Check className="bdocs-menu__check-icon" />
                ) : null)}
            </span>
          )}
          <div className={cn('bdocs-menu__content', contentClassName)}>
            {children}
          </div>
          {values.hasSubmenu && (
            <span className="bdocs-menu__ml-auto">
              {chevron ?? (
                <ChevronRight
                  className={cn('bdocs-menu__chevron', chevronClassName)}
                />
              )}
            </span>
          )}
        </>
      )}
    </RACMenuItem>
  )
}

/** MenuSection for grouping items with an optional header. */
export interface MenuSectionProps<T = unknown> {
  title?: string
  headerClassName?: string
  className?: string
  items?: Iterable<T>
  /** Either plain children or a render function over `items`. */
  children?: React.ReactNode | ((item: T, index: number) => React.ReactNode)
}

function MenuSection<T>({
  title,
  headerClassName,
  ...props
}: MenuSectionProps<T>) {
  return (
    <RACMenuSection className={cn('bdocs-menu__list', props.className)}>
      {title && (
        <Header className={cn('bdocs-menu__header', headerClassName)}>
          {title}
        </Header>
      )}
      <Collection items={props.items}>{props.children}</Collection>
    </RACMenuSection>
  )
}

/** MenuSeparator for visual division. */
function MenuSeparator({ className, ...props }: { className?: string }) {
  return (
    <RACSeparator
      className={cn('bdocs-menu__separator', className)}
      {...props}
    />
  )
}

Menu.Root = Menu
Menu.Item = MenuItem
Menu.Trigger = MenuTrigger
Menu.SubTrigger = SubmenuTrigger
Menu.Section = MenuSection
Menu.Separator = MenuSeparator
