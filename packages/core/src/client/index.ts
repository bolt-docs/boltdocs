export type {
  ComponentRoute,
  LayoutProps,
} from './types'
export type { BoltdocsLocale, BoltdocsVersion, BoltdocsTypes } from '../shared/types'
export * from './ssg'
export { useConfig } from './app/config-context'
export { useTheme } from './app/theme-context'
export { useRoutes } from './hooks/use-routes'
export { useMdxComponents } from './app/mdx-components-context'

// Hooks
export * from './hooks/index'
// Composable layout building blocks
export { DocsLayout } from './components/docs-layout'

// Default UI components (for use in custom layout.tsx)
export { Navbar } from './components/ui-base/navbar'
export { Sidebar } from './components/ui-base/sidebar'
export { OnThisPage } from './components/ui-base/on-this-page'
export { Head } from './components/ui-base/head'
export { Breadcrumbs } from './components/ui-base/breadcrumbs'
export { PageNav } from './components/ui-base/page-nav'
export { ErrorBoundary } from './components/ui-base/error-boundary'
export { CopyMarkdown } from './components/ui-base/copy-markdown'
export { Banner } from './components/ui-base/banner'

export { NotFound } from './components/ui-base/not-found'
export { Loading } from './components/ui-base/loading'
export { CodeBlock } from './components/mdx/code-block'
export { Video } from './components/mdx/video'

// MDX Components
export {
  Button,
  Badge,
  Card,
  Cards,
  Tabs,
  Tab,
  Admonition,
  Note,
  Tip,
  Warning,
  Danger,
  InfoBox,
  ComponentProps,
  ComponentPreview,
  Important,
  Caution,
  List,
  FileTree,
  Table,
  Field,
  Link,
  Image,
} from './components/mdx'

export type {
  ButtonProps,
  BadgeProps,
  CardProps,
  CardsProps,
  TabsProps,
  TabProps,
  AdmonitionProps,
  ComponentPropsProps,
  ComponentPreviewProps,
  ListProps,
  FileTreeProps,
  TableProps,
  FieldProps,
  LinkProps,
  ImageProps,
} from './components/mdx'

// Primitives
export { Navbar as PrimitiveNavbar } from './components/primitives/navbar'
export { NavigationMenu as PrimitiveNavigationMenu } from './components/primitives/navigation-menu'
export { SearchDialog as SearchDialogPrimitive } from './components/primitives/search-dialog'
export {
  OnThisPage as PrimitiveOnThisPage,
  AnchorProvider,
  ScrollProvider,
  useActiveAnchor,
  useActiveAnchors,
  useItems,
} from './components/primitives/on-this-page'
export { PageNav as PrimitivePageNav } from './components/primitives/page-nav'
export { Tabs as PrimitiveTabs } from './components/primitives/tabs'
export { Sidebar as PrimitiveSidebar } from './components/primitives/sidebar'
export { Breadcrumbs as PrimitiveBreadcrumbs } from './components/primitives/breadcrumbs'
export { Button as PrimitiveButton } from './components/primitives/button'
export { ButtonGroup } from './components/primitives/button-group'
export { Menu as PrimitiveMenu } from './components/primitives/menu'
export { Popover as PrimitivePopover } from './components/primitives/popover'
export { Tooltip as PrimitiveTooltip } from './components/primitives/tooltip'
export {
  Link as PrimitiveLink,
  NavLink as PrimitiveNavLink,
} from './components/primitives/link'
export { Skeleton as PrimitiveSkeleton } from './components/primitives/skeleton'

// Utilities
export { cn } from './utils/cn'
export { getTranslated } from './utils/i18n'
