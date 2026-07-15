/**
 * Ambient declarations for every `virtual:boltdocs-*` module emitted at
 * build time. This file MUST be a TypeScript *script* (no top-level
 * imports/exports) for the `declare module` blocks below to apply as
 * global ambient declarations. Otherwise TypeScript treats this file as
 * a module, and the `virtual:boltdocs-*` symbols are only visible to
 * files that explicitly import this `.d.ts` file.
 *
 * Type references are inlined with `import('./path').Type` syntax so the
 * file stays ambient while preserving full type fidelity.
 */

declare module 'virtual:boltdocs-routes' {
  const routes: import('./types').ComponentRoute[]
  export default routes
}

declare module 'virtual:boltdocs-config' {
  const config: import('../shared/types').BoltdocsConfig
  export default config
}

declare module 'virtual:boltdocs-layout' {
  const Layout: React.ComponentType<{
    children: React.ReactNode
    route?: import('./types').ComponentRoute
  }>
  export default Layout
}

declare module 'virtual:boltdocs-collections' {
  const collections: Record<string, import('./types').ComponentRoute[]>
  export default collections
}

declare module 'virtual:boltdocs-mdx-components' {
  const components: Record<string, React.ComponentType<HTMLElement>>
  export default components
}

declare module 'virtual:boltdocs-icons' {
  /**
   * User-overridable icon registry. Keys are PascalCase icon names
   * (e.g. `"ChevronDown"`, `"Menu"`, `"Search"`) consumed across the
   * UI primitives. The runtime generator emits this module from the
   * user's `icons.{tsx,jsx,ts,js}` file when present, otherwise an
   * empty object so `Icon` lookups fail loudly.
   */
  const icons: Record<
    string,
    React.ComponentType<{ className?: string; size?: number | string }>
  >
  export default icons
}

declare module 'virtual:boltdocs-entry' {
  const code: string
  export default code
}

declare module 'virtual:boltdocs-layout-slots' {
  /**
   * `SlotComponent` is intentionally an empty interface at the boundary.
   * The runtime signature (`ComponentType<{ route?: ComponentRoute } | undefined>`)
   * is defined in `client/hooks/use-slot-registry.ts` and is cast at the
   * point of consumption. Keeping this ambient type opaque preserves the
   * boundary between virtual-module "shape" and the concrete React type.
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface SlotComponent {}
  const slotRegistry: Record<string, SlotComponent[]>
  export default slotRegistry
  export const slotRegistry: Record<string, SlotComponent[]>
}
