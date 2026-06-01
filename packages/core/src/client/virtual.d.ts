import type { ComponentRoute } from './types'
import type { BoltdocsConfig } from '../shared/types'

declare module 'virtual:boltdocs-routes' {
  const routes: ComponentRoute[]
  export default routes
}

declare module 'virtual:boltdocs-config' {
  const config: BoltdocsConfig
  export default config
}

declare module 'virtual:boltdocs-layout' {
  const Layout: React.ComponentType<{
    children: React.ReactNode
    route?: ComponentRoute
  }>
  export default Layout
}

declare module 'virtual:boltdocs-collections' {
  const collections: Record<string, ComponentRoute[]>
  export default collections
}

declare module 'virtual:boltdocs-mdx-components' {
  const components: Record<string, React.ComponentType<HTMLElement>>
  export default components
}

declare module 'virtual:boltdocs-entry' {
  const code: string
  export default code
}
