// Mock for `virtual:boltdocs-layout-slots` used in vitest. Each test that
// needs plugin-declared slots should override this mock via `vi.mock(...)`.
export type SlotComponent = React.ComponentType<unknown>

export const slotRegistry: Record<string, SlotComponent[]> = {}

export default slotRegistry
