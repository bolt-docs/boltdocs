import * as RAC from 'react-aria-components'
import { Search, Hash, FileText, CornerDownLeft, X } from 'lucide-react'
import { cn } from '../../utils/cn'
import type { ComponentBase } from './types'

export interface SearchDialogProps extends ComponentBase {
  isOpen?: boolean
  onOpenChange?: (isOpen: boolean) => void
}

export interface SearchDialogItemProps
  extends Omit<RAC.ListBoxItemProps, 'children'> {
  className?: string
  children: React.ReactNode
}

export interface SearchDialogItemIconProps {
  isHeading?: boolean
  className?: string
}

export const SearchDialog = ({
  children,
  isOpen,
  onOpenChange,
  className,
}: SearchDialogProps) => {
  return (
    <RAC.ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className={cn(
        'fixed inset-0 z-100 bg-black/40 backdrop-blur-sm px-4 py-4 sm:py-20',
        'entering:animate-in entering:fade-in exiting:animate-out exiting:fade-out',
      )}
    >
      <RAC.Modal
        className={cn(
          'mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-subtle bg-surface shadow-2xl ring-1 ring-black/5 outline-none',
          'entering:animate-in entering:fade-in entering:zoom-in-95 exiting:animate-out exiting:fade-out exiting:zoom-out-95',
          className,
        )}
      >
        <RAC.Dialog className="flex flex-col max-h-[90dvh] sm:max-h-[70vh] focus:outline-none overflow-hidden outline-none">
          {children as any}
        </RAC.Dialog>
      </RAC.Modal>
    </RAC.ModalOverlay>
  )
}

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
    <div className={className}>
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

const SearchDialogInput = ({
  className,
  ...props
}: RAC.InputProps & { className?: string }) => {
  return (
    <RAC.SearchField
      className="flex items-center gap-3 border-b border-subtle px-4 py-3 sm:py-4"
      autoFocus
    >
      <Search className="h-5 w-5 text-muted shrink-0" />
      <RAC.Input
        {...props}
        className={cn(
          'w-full bg-transparent text-base sm:text-lg text-body placeholder-text-muted outline-none border-none focus:ring-0',
          className,
        )}
        placeholder="Search documentation..."
      />
      <div className="flex items-center gap-2">
        <RAC.Button className="p-1 rounded-md text-muted hover:text-body hover:bg-soft outline-none transition-colors cursor-pointer">
          <X className="h-4 w-4" />
        </RAC.Button>
        <div className="hidden sm:flex items-center gap-1.5 rounded-md border border-subtle bg-main px-1.5 py-1 text-[10px] font-medium text-muted">
          <kbd className="font-sans">ESC</kbd>
        </div>
      </div>
    </RAC.SearchField>
  )
}

const SearchDialogList = <T extends object>({
  children,
  className,
  ...props
}: RAC.ListBoxProps<T> & { className?: string }) => {
  return (
    <RAC.ListBox
      {...props}
      className={cn(
        'flex-1 overflow-y-auto p-2 outline-none min-h-0',
        'scrollbar-hide sm:scrollbar-default',
        className,
      )}
    >
      {children as any}
    </RAC.ListBox>
  )
}

const SearchDialogItemRoot = ({
  children,
  className,
  ...props
}: SearchDialogItemProps) => {
  return (
    <RAC.ListBoxItem
      {...props}
      className={cn(
        'group flex items-center gap-3 rounded-lg p-3 text-left outline-none cursor-pointer transition-colors',
        'text-muted hover:bg-main hover:text-body focus:bg-primary-500 focus:text-white selected:bg-primary-500 selected:text-white',
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
    <span
      className={cn('block font-medium truncate flex-1 text-sm', className)}
    >
      {children}
    </span>
  )
}

const SearchDialogItemBio = ({ children, className }: ComponentBase) => {
  return (
    <span
      className={cn(
        'ml-2 text-xs opacity-70 truncate hidden sm:inline group-focus:opacity-100',
        className,
      )}
    >
      {children}
    </span>
  )
}

SearchDialog.Root = SearchDialog
SearchDialog.Autocomplete = SearchDialogAutocomplete
SearchDialog.Input = SearchDialogInput
SearchDialog.List = SearchDialogList
SearchDialog.Item = Object.assign(SearchDialogItemRoot, {
  Icon: SearchDialogItemIcon,
  Title: SearchDialogItemTitle,
  Bio: SearchDialogItemBio,
})
