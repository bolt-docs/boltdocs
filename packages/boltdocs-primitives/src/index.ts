/**
 * `@bdocs/primitives`
 *
 * Accessible UI primitives for Boltdocs, implemented here rather than delegated.
 *
 * Behaviour that used to come from `react-aria-components` now lives in this
 * package with tests that exercise it: roving tabindex in menus, the focus trap
 * in dialogs, typeahead, dismissal rules for overlays, and the combobox
 * relationship between an input and its list.
 *
 * There is deliberately no `SSRProvider`. React Aria needs one because it derives
 * ids from a module-level counter that does not match across the hydration
 * boundary; this package uses React's `useId`, which produces the same value on
 * both sides, so there is nothing to reconcile.
 */

export { cn, composeRenderProps, filterDOMProps } from './utils'
export type { PrimitiveTag, PropsOf, RenderProps } from './utils'

export {
  FOCUSABLE_SELECTOR,
  focusFirstIn,
  getFocusableElements,
  hideSiblings,
  lockScroll,
  trapTab,
} from './focus'

export { Separator } from './separator'
export type { SeparatorProps, SeparatorRenderProps } from './separator'

export { Button, ToggleButton } from './button'
export type {
  ButtonProps,
  ButtonRenderProps,
  ToggleButtonProps,
  ToggleButtonRenderProps,
} from './button'

export { Dialog } from './dialog'
export type { DialogProps, DialogRenderProps } from './dialog'

export { Modal, ModalOverlay } from './modal'
export type { ModalProps, ModalOverlayProps } from './modal'

export { Popover, Tooltip } from './popover'
export type { PopoverProps, TooltipProps } from './popover'

export {
  Collection,
  Header,
  Menu,
  MenuItem,
  MenuSection,
  MenuSeparator,
  MenuTrigger,
  SubmenuTrigger,
} from './menu'
export type {
  CollectionProps,
  HeaderProps,
  MenuItemProps,
  MenuItemRenderProps,
  MenuProps,
  MenuRenderProps,
  MenuSectionProps,
  MenuTriggerProps,
  SubmenuTriggerProps,
} from './menu'

export { ListBox, ListBoxItem } from './collection'
export type {
  ListBoxItemProps,
  ListBoxProps,
  ListBoxRenderProps,
} from './collection'

export { Autocomplete, Input, SearchField } from './combobox'
export type {
  AutocompleteProps,
  AutocompleteRenderProps,
  InputProps,
  SearchFieldProps,
  SearchFieldRenderProps,
} from './combobox'

export {
  Breadcrumb,
  Breadcrumbs,
  BreadcrumbsSeparator,
} from './breadcrumbs'
export type {
  BreadcrumbProps,
  BreadcrumbsProps,
  BreadcrumbsSeparatorProps,
} from './breadcrumbs'
