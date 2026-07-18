// Mock for `virtual:boltdocs-layout-slots` used in vitest. Each test that
// needs plugin-declared slots should override this mock via `vi.mock(...)`.
export type SlotComponent = React.ComponentType<unknown>

export const slotRegistry: Record<string, SlotComponent[]> = {}

export const slotConditions = {}

export const slotSsrFlags: Record<string, Array<boolean>> = {}

export const slotLazyFlags: Record<string, Array<boolean>> = {}

export default slotRegistry
