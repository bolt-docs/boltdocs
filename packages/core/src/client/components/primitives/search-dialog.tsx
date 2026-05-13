'use client'

import * as RAC from 'react-aria-components'
import { Hash, FileText, CornerDownLeft } from 'lucide-react'
import { cn } from '../../utils/cn'
import type { ComponentBase } from './types'

export interface SearchDialogItemProps
  extends Omit<RAC.ListBoxItemProps, 'children'> {
  className?: string
  children: React.ReactNode
}

export interface SearchDialogItemIconProps {
  isHeading?: boolean
  className?: string
}

/**
 * Pure, unstyled SearchDialog Overlay (maps to RAC.ModalOverlay)
 */
export const SearchDialog = ({
  className,
  ...props
}: RAC.ModalOverlayProps) => {
  return (
    <RAC.ModalOverlay
      className={cn('fixed inset-0 z-100', className)}
      {...props}
    />
  )
}

/**
 * Pure, unstyled SearchDialog Content (maps to RAC.Modal)
 */
const SearchDialogContent = ({
  className,
  ...props
}: RAC.ModalOverlayProps) => <RAC.Modal className={cn(className)} {...props} />

/**
 * Pure, unstyled SearchDialog Dialog (maps to RAC.Dialog)
 */
const SearchDialogDialog = ({ className, ...props }: RAC.DialogProps) => (
  <RAC.Dialog
    className={cn('flex flex-col focus:outline-none', className)}
    {...props}
  />
)

/**
 * Pure, unstyled SearchDialog Input Field (maps to RAC.SearchField)
 */
const SearchDialogField = ({ className, ...props }: RAC.SearchFieldProps) => (
  <RAC.SearchField className={cn('flex items-center', className)} {...props} />
)

/**
 * Pure, unstyled SearchInput (maps to RAC.Input)
 */
const SearchDialogSearchInput = ({ className, ...props }: RAC.InputProps) => (
  <RAC.Input
    className={cn('w-full bg-transparent outline-none border-none', className)}
    {...props}
  />
)

/**
 * Pure, unstyled Clear Button (maps to RAC.Button with slot="clear")
 */
const SearchDialogClearButton = ({ className, ...props }: RAC.ButtonProps) => (
  <RAC.Button slot="clear" className={cn(className)} {...props} />
)

/**
 * Pure, unstyled Autocomplete container (maps to RAC.Autocomplete)
 */
const SearchDialogAutocomplete = <T extends object>({
  children,
  className,
  onSelectionChange,
  ...props
}: RAC.AutocompleteProps<T> & {
  className?: string
  onSelectionChange?: (key: RAC.Key) => void
}) => {
  const Autocomplete = RAC.Autocomplete as any
  return (
    <div className={cn('flex-1 min-h-0', className)}>
      <Autocomplete
        {...props}
        onSelectionChange={onSelectionChange}
        className="flex flex-col min-h-0"
      >
        {children}
      </Autocomplete>
    </div>
  )
}

/**
 * Pure, unstyled List Box (maps to RAC.ListBox)
 */
const SearchDialogList = <T extends object>({
  children,
  className,
  ...props
}: RAC.ListBoxProps<T> & { className?: string }) => {
  return (
    <RAC.ListBox
      {...props}
      className={cn('flex-1 overflow-y-auto outline-none min-h-0', className)}
    >
      {children as any}
    </RAC.ListBox>
  )
}

/**
 * Pure, unstyled List Box Item (maps to RAC.ListBoxItem)
 */
const SearchDialogItemRoot = ({
  children,
  className,
  ...props
}: SearchDialogItemProps) => {
  return (
    <RAC.ListBoxItem
      {...props}
      className={cn(
        'group flex items-center outline-none cursor-pointer',
        className,
      )}
    >
      {(itemProps) => (
        <>
          {children}
          {(itemProps.isFocused || itemProps.isSelected) && (
            <div className="ml-auto opacity-50 flex items-center gap-1">
              <span className="text-[10px]">Select</span>
              <CornerDownLeft size={10} />
            </div>
          )}
        </>
      )}
    </RAC.ListBoxItem>
  )
}

const SearchDialogItemIcon = ({
  isHeading,
  className,
}: SearchDialogItemIconProps) => {
  return (
    <div className={cn('shrink-0', className)}>
      {isHeading ? <Hash size={18} /> : <FileText size={18} />}
    </div>
  )
}

const SearchDialogItemTitle = ({ children, className }: ComponentBase) => {
  return (
    <span className={cn('block truncate flex-1', className)}>{children}</span>
  )
}

const SearchDialogItemBio = ({ children, className }: ComponentBase) => {
  return (
    <span className={cn('ml-2 truncate hidden sm:inline', className)}>
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
