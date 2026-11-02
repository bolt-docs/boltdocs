// Coverage guard for the integration.
//
// Every react-aria-components symbol the core imports has to exist in this
// package before the dependency can be dropped. The value check runs; the type
// check is the import below, which fails to compile if a name is missing. A test
// that only checked values would let a type-only import break the build later.
import { describe, expect, it } from 'vitest'
import * as P from '../src'
import type {
  AutocompleteProps,
  ButtonProps,
  DialogProps,
  InputProps,
  ListBoxItemProps,
  ListBoxProps,
  MenuItemProps,
  MenuProps,
  MenuSectionProps,
  MenuTriggerProps,
  ModalOverlayProps,
  PopoverProps,
  SearchFieldProps,
  SeparatorProps,
  SubmenuTriggerProps,
  composeRenderProps,
} from '../src'

/**
 * Referenced so the import above is not elided as unused.
 */
// biome-ignore lint/suspicious/noExportsInTest: the export is the point; a bare type alias would be elided along with its imports
export type TypeCoverage = [
  AutocompleteProps | undefined,
  ButtonProps | undefined,
  DialogProps | undefined,
  InputProps | undefined,
  ListBoxItemProps | undefined,
  ListBoxProps | undefined,
  MenuItemProps | undefined,
  MenuProps | undefined,
  MenuSectionProps | undefined,
  MenuTriggerProps | undefined,
  ModalOverlayProps | undefined,
  PopoverProps | undefined,
  SearchFieldProps | undefined,
  SeparatorProps | undefined,
  SubmenuTriggerProps | undefined,
  composeRenderProps | undefined,
]

// SSRProvider is deliberately absent; the second test says why.
const VALUES = [
  'Autocomplete',
  'Breadcrumb',
  'Breadcrumbs',
  'Button',
  'Collection',
  'Dialog',
  'Header',
  'Input',
  'ListBox',
  'ListBoxItem',
  'Menu',
  'MenuItem',
  'MenuSection',
  'MenuTrigger',
  'Modal',
  'ModalOverlay',
  'Popover',
  'SearchField',
  'Separator',
  'SubmenuTrigger',
  'ToggleButton',
] as const

describe('primitives cover what the core imports from react-aria-components', () => {
  it('exports every value the core imports', () => {
    const missing = VALUES.filter((name) => !(name in P))
    expect(missing).toEqual([])
  })

  it('has a provider-free SSR story', () => {
    // The core wraps the app in react-aria's SSRProvider because react-aria
    // derives ids from a module counter that diverges across hydration. This
    // package uses React's useId instead, which matches on both sides, so the
    // provider has nothing left to do.
    expect('SSRProvider' in P).toBe(false)
  })
})
