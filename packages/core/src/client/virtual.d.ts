declare module 'virtual:boltdocs-routes' {
  const routes: any[]
  export default routes
}

declare module 'virtual:boltdocs-config' {
  const config: any
  export default config
}

declare module 'virtual:boltdocs-layout' {
  const Layout: React.ComponentType<{ children: React.ReactNode; route?: any }>
  export default Layout
}

declare module 'virtual:boltdocs-mdx-components' {
  const components: any
  export default components
}

declare module 'virtual:boltdocs-entry' {
  const code: string
  export default code
}
