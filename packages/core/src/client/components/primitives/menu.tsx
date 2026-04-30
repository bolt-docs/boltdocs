'use client'

import { Check, ChevronRight } from 'lucide-react'
import * as RAC from 'react-aria-components'
import { Children } from 'react'
import { Popover, type PopoverProps } from './popover'
import { cn } from '../../utils/cn'
/**
 * MenuTrigger wraps a trigger (usually a Button) and a Menu.
 */
export interface MenuTriggerProps extends RAC.MenuTriggerProps {
  placement?: PopoverProps['placement']
}

function MenuTrigger(props: MenuTriggerProps) {
  const [trigger, menu] = (
    Children.toArray(props.children) as React.ReactElement[]
  ).slice(0, 2)
  return (
    <RAC.MenuTrigger {...props}>
      {trigger as any}
      <Popover placement={props.placement} className="min-w-35">
        {menu as any}
      </Popover>
    </RAC.MenuTrigger>
  )
}

/**
 * SubmenuTrigger for nested menus.
 */
function SubmenuTrigger(props: RAC.SubmenuTriggerProps) {
  const [trigger, menu] = (
    Children.toArray(props.children) as React.ReactElement[]
  ).slice(0, 2)
  return (
    <RAC.SubmenuTrigger {...props}>
      {trigger as any}
      <Popover offset={-4} crossOffset={-4}>
        {menu as any}
      </Popover>
    </RAC.SubmenuTrigger>
  )
}

/**
 * The Menu container.
 */
export function Menu<T extends object>(props: RAC.MenuProps<T>) {
  return (
    <RAC.Menu
      {...props}
      className={RAC.composeRenderProps(props.className, (className) =>
        cn(
          'p-1.5 outline-none max-h-[inherit] overflow-auto max-w-75',
          className,
        ),
      )}
    />
  )
}

/**
 * MenuItem with support for selection states and submenus.
 */
function MenuItem(props: RAC.MenuItemProps) {
  const textValue =
    props.textValue ||
    (typeof props.children === 'string' ? props.children : undefined)

  return (
    <RAC.MenuItem
      {...props}
      textValue={textValue}
      className={RAC.composeRenderProps(
        props.className,
        (className, { isFocused, isDisabled, isSelected }) =>
          cn(
            'group relative flex flex-row items-center gap-2 px-2 py-1.5 rounded-lg outline-none cursor-default hover:cursor-pointer transition-none',
            'text-[12.5px] font-medium',
            {
              'bg-bg-surface-elevated text-text-main ring-1 ring-border-strong/5':
                isFocused && !isSelected,
              'text-text-main': !isSelected && !isFocused,
              'bg-primary-500/10 text-primary-600 dark:text-primary-400': isSelected,
              'bg-primary-500/15 ring-1 ring-primary-500/20': isSelected && isFocused,
              'opacity-40 grayscale pointer-events-none': isDisabled,
            },
            className,
          ),
      )}
    >
      {RAC.composeRenderProps(
        props.children,
        (children, { selectionMode, isSelected, hasSubmenu }) => (
          <>
            {selectionMode === 'multiple' && (
              <span className="flex items-center size-4 shrink-0 justify-center">
                {isSelected && (
                  <Check className="size-3.5 stroke-[2.5px] text-primary-500 animate-in zoom-in-50 duration-200" />
                )}
              </span>
            )}
            <div className="flex flex-row w-full transition-colors items-center gap-2 py-0.5 px-1">
              {children}
            </div>
            {hasSubmenu && (
              <ChevronRight className="size-4 ml-auto text-text-muted group-focused:text-primary-500/70 transition-colors" />
            )}
          </>
        ),
      )}
    </RAC.MenuItem>
  )
}

/**
 * MenuSection for grouping items with an optional header.
 */
export interface MenuSectionProps<T> extends RAC.MenuSectionProps<T> {
  title?: string
}

function MenuSection<T extends object>({
  title,
  ...props
}: MenuSectionProps<T>) {
  return (
    <RAC.MenuSection
      {...props}
      className={cn('flex flex-col gap-0.5', props.className)}
    >
      {title && (
        <RAC.Header className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.075em] text-text-muted/50 select-none">
          {title}
        </RAC.Header>
      )}
      <RAC.Collection items={props.items}>{props.children}</RAC.Collection>
    </RAC.MenuSection>
  )
}

/**
 * MenuSeparator for visual division.
 */
function MenuSeparator(props: RAC.SeparatorProps) {
  return (
    <RAC.Separator
      {...props}
      className="mx-2 my-1.5 border-t border-border-subtle/50"
    />
  )
}

Menu.Root = Menu
Menu.Item = MenuItem
Menu.Trigger = MenuTrigger
Menu.SubTrigger = SubmenuTrigger
Menu.Section = MenuSection
Menu.Separator = MenuSeparator
