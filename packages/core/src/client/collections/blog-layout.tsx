import { DocsLayout } from '../app/docs-layout'

/**
 * Re-exports the unified DocsLayout as BlogLayout for backwards compatibility.
 * This ensures collection routes reuse the main site layout shell (UserLayout, navbar, footer)
 * automatically.
 */
export const BlogLayout = DocsLayout
export default BlogLayout
