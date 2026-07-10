import { cn } from '../../utils/cn'
import { SearchHighlight } from '../ui-base/search-highlight'

/**
 * Props shared by all layout slot components.
 */
interface SlotProps {
  children?: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

/**
 * Root layout shell. Renders a full-height flex column.
 *
 * Usage:
 * ```tsx
 * <DocsLayout>
 *   <Navbar />
 *   <DocsLayout.Body>...</DocsLayout.Body>
 * </DocsLayout>
 * ```
 */
function DocsLayoutRoot({ children, className, style }: SlotProps) {
  return (
    <div
      className={cn(
        'h-screen flex flex-col overflow-hidden bg-main text-body',
        className,
      )}
      style={style}
    >
      {children}
    </div>
  )
}

/**
 * Horizontal flex container for sidebar + content + toc.
 */
function Body({ children, className, style }: SlotProps) {
  return (
    <div
      className={cn(
        'mx-auto flex flex-1 w-full max-w-(--breakpoint-3xl) bg-main overflow-hidden',
        className,
      )}
      style={style}
    >
      {children}
    </div>
  )
}

/**
 * Main scrollable content area.
 */
function Content({ children, className, style }: SlotProps) {
  return (
    <main
      className={cn(
        'boltdocs-content flex-1 min-w-0 overflow-y-auto',
        className,
      )}
      style={style}
    >
      {children}
    </main>
  )
}

/**
 * MDX Content wrapper with standard page padding and max-width logic.
 */
function ContentMdx({ children, className, style }: SlotProps) {
  return (
    <div
      className={cn('boltdocs-page mx-auto pt-4 pb-20 px-4 sm:px-8', className)}
      style={style}
    >
      <SearchHighlight />
      {children}
    </div>
  )
}

/**
 * Content header area (breadcrumbs, title, description, etc).
 */
function Header({ children, className, style }: SlotProps) {
  return (
    <header className={cn('mb-10', className)} style={style}>
      {children}
    </header>
  )
}

/**
 * Footer area inside the content section (page nav).
 */
function Footer({ children, className, style }: SlotProps) {
  return (
    <div className={cn('mt-20', className)} style={style}>
      {children}
    </div>
  )
}

interface DocsLayoutComponent extends React.FC<SlotProps> {
  Body: typeof Body
  Content: typeof Content
  ContentMdx: typeof ContentMdx
  Header: typeof Header
  Footer: typeof Footer
}

// Attach sub-components to the root
export const DocsLayout = Object.assign(DocsLayoutRoot, {
  Body,
  Content,
  ContentMdx,
  Header,
  Footer,
}) as DocsLayoutComponent
