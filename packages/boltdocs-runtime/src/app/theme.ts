import type { ComponentType, ReactNode } from 'react'
import type { ComponentRoute } from '../types'

/**
 * The surface a theme has to provide.
 *
 * The engine builds the route table, mounts the providers and decides which
 * page renders where. A theme decides *what that looks like*, and this is the
 * complete list of things the engine needs from it: one entry per place the
 * engine would otherwise have to hardcode markup.
 *
 * That is the whole boundary. A theme is installable on its own because the
 * engine never imports one — the generated entry resolves the package named in
 * `themePackage` and hands its surface to `createRoutes`. Adding a second theme
 * means writing these components, not reimplementing routing.
 *
 * The rule for what belongs here: a component qualifies when the engine renders
 * it and its output is appearance. Anything that decides a URL, loads data, or
 * keeps state belongs to the runtime instead.
 */
export interface BoltdocsTheme {
  /**
   * The documentation chrome: navbar, sidebar, table of contents, page
   * navigation, and the outlet the page renders into.
   *
   * A site that ships its own `layout.tsx` replaces this component for the
   * documentation routes; the engine still uses the rest of the surface for
   * collections, external pages and the 404.
   */
  DocsLayout: ComponentType<{ children?: ReactNode }>

  /**
   * The frame the whole application renders into: the element that owns the
   * viewport height and the scroll container.
   *
   * It is separate from `DocsLayout` because external pages and collection
   * routes render inside it without the documentation chrome.
   */
  ShellFrame: ComponentType<{ children?: ReactNode }>

  /**
   * A single documentation page: the MDX content plus whatever the theme puts
   * under it (the last-updated footer, for example).
   */
  DocPage: ComponentType<DocPageProps>

  /**
   * The default index a collection renders when the site did not write a
   * `list.tsx` for it. It owns the post list and the pagination controls.
   */
  CollectionList: ComponentType

  /** The scroll container for a page that is not part of the docs tree. */
  ExternalPage: ComponentType<{ children?: ReactNode }>

  /**
   * The content container for a file-routed external MDX page: the page title
   * and the prose typography, rendered inside the site's external layout.
   */
  ExternalContent: ComponentType<{ title?: string; children?: ReactNode }>

  /** The page a route that matched nothing renders. */
  NotFound: ComponentType

  /**
   * The components MDX elements map to, before the site's own
   * `mdx-components.tsx` is merged on top.
   */
  MdxComponents: Record<string, ComponentType<any>>

  /**
   * The plugin insertion points that live outside any page, such as
   * `floating:after`.
   */
  PluginSlots?: ComponentType

  /**
   * The boundary the shell wraps the application in. When a theme omits it the
   * engine renders its children unchanged, so an error in a page unmounts the
   * whole app instead of the page.
   */
  ErrorBoundary?: ComponentType<{ children?: ReactNode }>
}

/**
 * The route a `DocPage` renders, narrowed to what a page actually displays.
 *
 * It is a subset of `ComponentRoute` on purpose: everything here survives into
 * a published page, whereas `componentPath` and most of `frontmatter` only
 * exist during a build.
 */
export interface DocPageRoute {
  path: string
  filePath: string
  title?: string
  description?: string
  headings?: { level: number; text: string; id: string }[]
  locale?: string
  version?: string
  group?: string
  groupTitle?: string
  lastUpdated?: string | number | Date
  contributors?: ComponentRoute['contributors']
  frontmatter?: Record<string, any>
}

export interface DocPageProps {
  route: DocPageRoute
  /** The compiled MDX module's default export. */
  content: ComponentType<{
    components?: Record<string, ComponentType<any>>
  }> | null
  mdxComponents: Record<string, ComponentType<any>>
}
