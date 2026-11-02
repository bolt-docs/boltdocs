import type { BoltdocsTheme } from '@bdocs/runtime/app'
import DocsLayout from './components/docs-layout-default'
import { ShellFrame } from './components/shell-frame'
import { DocPage } from './doc-page'
import { CollectionList } from './components/collection-list'
import { ExternalPage } from './components/external-page'
import { ExternalContent } from './components/external-content'
import { NotFound } from './components/ui-base/not-found'
import { mdxComponentsDefault } from './mdx-component'
import { PluginFloatingSlots } from './components/plugin-floating-slots'
import { InternalErrorBoundary } from './components/internal/error-boundary'

/**
 * What the engine renders this theme with.
 *
 * The engine builds the route table and mounts the providers; everything it has
 * to *draw* it asks for here. Ten entries, one per place the engine would
 * otherwise have to hardcode markup — that is the complete coupling between the
 * framework and a theme.
 *
 * A second theme exports its own object of this shape and names itself in
 * `themePackage`. It does not reimplement routing, and the engine never imports
 * a theme.
 */
export const surface: BoltdocsTheme = {
  DocsLayout,
  ShellFrame,
  DocPage,
  CollectionList,
  ExternalPage,
  ExternalContent,
  NotFound,
  MdxComponents: mdxComponentsDefault,
  PluginSlots: PluginFloatingSlots,
  ErrorBoundary: InternalErrorBoundary,
}

export default surface
