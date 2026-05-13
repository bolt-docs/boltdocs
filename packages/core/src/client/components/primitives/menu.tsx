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
  className?: string
}

function MenuTrigger({ placement, className, ...props }: MenuTriggerProps) {
  const [trigger, menu] = (
    Children.toArray(props.children) as React.ReactElement[]
  ).slice(0, 2)
  return (
    <RAC.MenuTrigger {...props}>
      {trigger as any}
      <Popover placement={placement} className={className}>
        {menu as any}
      </Popover>
    </RAC.MenuTrigger>
  )
}

/**
 * SubmenuTrigger for nested menus.
 */
export interface SubmenuTriggerProps extends RAC.SubmenuTriggerProps {
  className?: string
}

function SubmenuTrigger({ className, ...props }: SubmenuTriggerProps) {
  const [trigger, menu] = (
    Children.toArray(props.children) as React.ReactElement[]
  ).slice(0, 2)
  return (
    <RAC.SubmenuTrigger {...props}>
      {trigger as any}
      <Popover offset={-4} crossOffset={-4} className={className}>
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
        cn('outline-none overflow-auto', className),
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
      className={RAC.composeRenderProps(props.className, (className) =>
        cn(
          'group relative flex flex-row items-center cursor-default outline-none',
          className,
        ),
      )}
    >
      {RAC.composeRenderProps(
        props.children,
        (children, { selectionMode, isSelected, hasSubmenu }) => (
          <>
            {selectionMode === 'multiple' && (
              <span className="flex items-center shrink-0 justify-center">
                {isSelected && <Check className="size-3.5" />}
              </span>
            )}
            <div className="flex flex-row w-full items-center">{children}</div>
            {hasSubmenu && <ChevronRight className="size-4 ml-auto" />}
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
      className={cn('flex flex-col', props.className)}
    >
      {title && <RAC.Header className="select-none">{title}</RAC.Header>}
      <RAC.Collection items={props.items}>{props.children}</RAC.Collection>
    </RAC.MenuSection>
  )
}

/**
 * MenuSeparator for visual division.
 */
function MenuSeparator(props: RAC.SeparatorProps) {
  return (
    <RAC.Separator {...props} className={cn('border-t', props.className)} />
  )
}

Menu.Root = Menu
Menu.Item = MenuItem
Menu.Trigger = MenuTrigger
Menu.SubTrigger = SubmenuTrigger
Menu.Section = MenuSection
Menu.Separator = MenuSeparator
