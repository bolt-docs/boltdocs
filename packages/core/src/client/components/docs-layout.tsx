import { cn } from '../utils/cn'
import { useLocation } from '../hooks'

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
        'contain-layout', // Optimization: isolate main content layout
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
  const { pathname } = useLocation()
  return (
    <div
      className={cn(
        'boltdocs-page mx-auto pt-4 pb-20 px-4 sm:px-8',
        {
          'max-w-content-max': pathname.includes('/docs/'),
        },
        className,
      )}
      style={style}
    >
      {children}
    </div>
  )
}

/**
 * Content header row (breadcrumbs + copy markdown).
 */
function ContentHeader({ children, className, style }: SlotProps) {
  return (
    <div
      className={cn('flex items-center justify-between mb-10', className)}
      style={style}
    >
      {children}
    </div>
  )
}

/**
 * Footer area inside the content section (page nav).
 */
function ContentFooter({ children, className, style }: SlotProps) {
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
  ContentHeader: typeof ContentHeader
  ContentFooter: typeof ContentFooter
}

// Attach sub-components to the root
export const DocsLayout = Object.assign(DocsLayoutRoot, {
  Body,
  Content,
  ContentMdx,
  ContentHeader,
  ContentFooter,
}) as DocsLayoutComponent
