'use client'

// Named imports, not `import * as RAC`: a namespace import pulls the whole
import {
  Autocomplete,
  type AutocompleteProps,
  Button,
  type ButtonProps,
  Dialog,
  type DialogProps,
  Input,
  type InputProps,
  ListBox,
  ListBoxItem,
  type ListBoxItemProps,
  type ListBoxProps,
  Modal,
  ModalOverlay,
  type ModalOverlayProps,
  SearchField,
  type SearchFieldProps,
} from '@bdocs/primitives'
import { Hash, FileText, CornerDownLeft } from '../ui-base/icons'
import { cn } from '../../utils/cn'
import type { ComponentBase } from './types'

export interface SearchDialogItemProps
  extends Omit<ListBoxItemProps, 'children'> {
  className?: string
  children: React.ReactNode
  /** Class name for the focused/selected "Select" hint. */
  hintClassName?: string
  /**
   * Custom render for the trailing keyboard-hint area shown while the item is
   * focused/selected. Replaces the default "Select" + key indicator.
   */
  renderHint?: (state: {
    focused: boolean
    selected: boolean
  }) => React.ReactNode
}

export interface SearchDialogItemIconProps {
  isHeading?: boolean
  className?: string
  /** Custom leading icon. Replaces the default hash/file icon. */
  icon?: React.ReactNode
}

/**
 * Pure, unstyled SearchDialog Overlay (maps to ModalOverlay)
 */
export function SearchDialog({ className, ...props }: ModalOverlayProps) {
  return (
    <ModalOverlay
      className={cn('bdocs-search-overlay', className)}
      {...props}
    />
  )
}

/**
 * Pure, unstyled SearchDialog Content (maps to Modal)
 */
function SearchDialogContent({ className, ...props }: ModalOverlayProps) {
  return <Modal className={cn(className)} {...props} />
}

/**
 * Pure, unstyled SearchDialog Dialog (maps to Dialog)
 */
function SearchDialogDialog({ children, className, ...props }: DialogProps) {
  return (
    <Dialog className={cn('bdocs-search-dialog', className)} {...props}>
      {children}
      {/* Plugin slot: search-dialog — content injected INSIDE the dialog body */}
    </Dialog>
  )
}

/**
 * Pure, unstyled SearchDialog Input Field (maps to SearchField)
 */
function SearchDialogField({ className, ...props }: SearchFieldProps) {
  return (
    <SearchField className={cn('bdocs-search-field', className)} {...props} />
  )
}

/**
 * Pure, unstyled SearchInput (maps to Input)
 */
function SearchDialogSearchInput({ className, ...props }: InputProps) {
  return <Input className={cn('bdocs-search-input', className)} {...props} />
}

/**
 * Pure, unstyled Clear Button (maps to Button with slot="clear")
 */
function SearchDialogClearButton({ className, ...props }: ButtonProps) {
  return <Button slot="clear" className={cn(className)} {...props} />
}

/**
 * Pure, unstyled Autocomplete container (maps to Autocomplete)
 */
function SearchDialogAutocomplete<T extends object>({
  children,
  className,
  innerClassName,
  ...props
}: AutocompleteProps<T> & {
  className?: string
  innerClassName?: string
}) {
  return (
    <div className={cn('bdocs-search-body', className)}>
      <Autocomplete
        {...props}
        // `className` is valid at runtime via SlotProps but is not declared on
        // the component's props, so it needs the explicit intersection. This
        // was previously masked by an `as any` on the component reference.
        {...{ className: cn('bdocs-search-list', innerClassName) }}
      >
        {children}
      </Autocomplete>
    </div>
  )
}

/**
 * Pure, unstyled List Box (maps to ListBox)
 */
function SearchDialogList<T extends object>({
  children,
  className,
  ...props
}: ListBoxProps<T> & { className?: string }) {
  return (
    <ListBox {...props} className={cn('bdocs-search-results', className)}>
      {children as any}
    </ListBox>
  )
}

/**
 * Pure, unstyled List Box Item (maps to ListBoxItem)
 */
function SearchDialogItemRoot({
  children,
  className,
  hintClassName,
  renderHint,
  ...props
}: SearchDialogItemProps) {
  return (
    <ListBoxItem {...props} className={cn('bdocs-search-result', className)}>
      {(itemProps) => (
        <>
          {children}
          {renderHint ? (
            renderHint({
              focused: itemProps.isFocused,
              selected: itemProps.isSelected,
            })
          ) : itemProps.isFocused || itemProps.isSelected ? (
            <div className={cn('bdocs-search-result__hint', hintClassName)}>
              <span className="bdocs-search-result__hint-label">Select</span>
              <CornerDownLeft size={10} />
            </div>
          ) : null}
        </>
      )}
    </ListBoxItem>
  )
}

function SearchDialogItemIcon({
  isHeading,
  className,
  icon,
}: SearchDialogItemIconProps) {
  return (
    <div className={cn('bdocs-search-result__icon', className)}>
      {icon ?? (isHeading ? <Hash size={18} /> : <FileText size={18} />)}
    </div>
  )
}

function SearchDialogItemTitle({ children, className }: ComponentBase) {
  return (
    <span className={cn('bdocs-search-result__title', className)}>
      {children}
    </span>
  )
}

function SearchDialogItemBio({ children, className }: ComponentBase) {
  return (
    <span className={cn('bdocs-search-result__bio', className)}>
      {children}
    </span>
  )
}

// Compound API wiring
SearchDialog.Root = SearchDialog
SearchDialog.Overlay = SearchDialog
SearchDialog.Content = SearchDialogContent
SearchDialog.Dialog = SearchDialogDialog
SearchDialog.Autocomplete = SearchDialogAutocomplete
SearchDialog.List = SearchDialogList

SearchDialog.Input = Object.assign(SearchDialogField, {
  SearchInput: SearchDialogSearchInput,
  Button: SearchDialogClearButton,
})

SearchDialog.Item = Object.assign(SearchDialogItemRoot, {
  Icon: SearchDialogItemIcon,
  Title: SearchDialogItemTitle,
  Bio: SearchDialogItemBio,
})
