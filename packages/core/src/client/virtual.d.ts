/// <reference types="react" />
/**
 * Ambient declarations for every `virtual:boltdocs-*` module emitted at
 * build time. This file MUST stay a TypeScript *script* (no top-level
 * imports/exports) so the `declare module` blocks apply as global
 * ambient declarations.
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
  /**
   * User-overridable MDX component registry. Keys are element names
   * (e.g. `"a"`, `"pre"`, `"h1"`); values are React components accepting
   * the standard MDX element props. The runtime generator emits this
   * module from the user's `mdx-components.{tsx,ts,jsx,js}` file when
   * present, otherwise an empty object.
   */
  const components: Record<string, React.ComponentType<any>>
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

declare module 'virtual:boltdocs-search' {
  export interface SearchDataItem {
    id: string
    title: string
    content: string
    url: string
    display: string
    locale?: string
    version?: string
  }

  const fetchSearchData: () => Promise<SearchDataItem[]>
  export default fetchSearchData
}
