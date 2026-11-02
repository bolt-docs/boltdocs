import type { ReactNode } from 'react'
import type { BoltdocsTheme } from '../src/app/theme'

/**
 * A theme the route tests can build with.
 *
 * The engine asks the theme for ten components and the tests assert the route
 * *shape* — paths, loaders, metadata — so these render their children and
 * nothing else. They are deliberately not the neutral theme: a test that
 * imported it would fail whenever a class name moved, and would prove the
 * theme works rather than the router does.
 */
export const testTheme: BoltdocsTheme = {
  DocsLayout: ({ children }: { children?: ReactNode }) => <>{children}</>,
  ShellFrame: ({ children }: { children?: ReactNode }) => <>{children}</>,
  DocPage: ({ content: Content }) => (Content ? <Content /> : null),
  CollectionList: () => null,
  ExternalPage: ({ children }: { children?: ReactNode }) => <>{children}</>,
  ExternalContent: ({ children }: { children?: ReactNode }) => <>{children}</>,
  NotFound: () => <p>Not found</p>,
  MdxComponents: {},
}
