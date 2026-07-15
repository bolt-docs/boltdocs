import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../utils/cn'
import { SearchHighlight } from '../ui-base/search-highlight'

/**
 * Props shared by all layout slot components.
 */
interface SlotProps {
  children?: ReactNode
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
 *   <DocsLayout.FloatingBottom />
 *   <DocsLayout.RightRail />
 *   <DocsLayout.BodyPortal />
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

/**
 * Floating bottom-right slot. Renders `fixed` so it escapes the Body flex.
 * Children inherit pointer-events; the wrapper is a passthrough.
 *
 * Mount position: `fixed bottom-6 right-6 z-40` (below modals, above content).
 * Tip: keep an inner `pointer-events-auto` if the slot is non-interactive.
 */
function FloatingBottom({ children, className, style }: SlotProps) {
  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2',
        className,
      )}
      style={style}
    >
      {children}
    </div>
  )
}

/**
 * Right-rail slot that mounts only on `xl:` viewports (≥ 1280 px). Used for
 * persistent panels like AI assistant sidebars.
 *
 * Sits OUTSIDE the Body flex (so it can be `fixed`). Its `width` collapses
 * the page content max-width implicitly via the parent's `--breakpoint-3xl`.
 */
function RightRail({ children, className, style }: SlotProps) {
  return (
    <aside
      className={cn(
        'hidden xl:flex fixed inset-y-0 right-0 z-30 w-[320px] flex-col border-l border-subtle bg-main pointer-events-auto',
        className,
      )}
      style={style}
    >
      {children}
    </aside>
  )
}

/**
 * Slot for ad-hoc content injected inside the navbar's right cluster.
 * Library layouts compose this into `<Navbar.Right>` via children passthrough.
 */
function NavbarExtras({ children }: SlotProps) {
  return <>{children}</>
}

/**
 * Slot for ad-hoc content injected inside `<DocsLayoutPrimitive.Header>`
 * below the title/description block.
 */
function HeaderExtras({ children }: SlotProps) {
  return <>{children}</>
}

/**
 * Slot for ad-hoc content injected at the bottom of `<OnThisPage>` tree.
 */
function TocExtras({ children }: SlotProps) {
  return <>{children}</>
}

/**
 * Slot for ad-hoc content injected above `<PageNav>` at the bottom of content.
 */
function FooterExtras({ children }: SlotProps) {
  return <>{children}</>
}

/**
 * Escape hatch slot for modals, toasts, lightweight popups. Renders into
 * `document.body` via a portal so it can stack above any other layout.
 * Falls back to an inline render during SSR (no portal available).
 *
 * `createPortal` is imported at module top level so the bundler can resolve
 * it statically; the SSR guard below prevents `<body>` access in Node.
 */
function BodyPortal({ children }: SlotProps) {
  if (typeof document === 'undefined') return <>{children}</>
  return createPortal(children, document.body)
}

interface DocsLayoutComponent extends React.FC<SlotProps> {
  Body: typeof Body
  Content: typeof Content
  ContentMdx: typeof ContentMdx
  Header: typeof Header
  Footer: typeof Footer
  FloatingBottom: typeof FloatingBottom
  RightRail: typeof RightRail
  NavbarExtras: typeof NavbarExtras
  HeaderExtras: typeof HeaderExtras
  TocExtras: typeof TocExtras
  FooterExtras: typeof FooterExtras
  BodyPortal: typeof BodyPortal
}

// Attach sub-components to the root
export const DocsLayout = Object.assign(DocsLayoutRoot, {
  Body,
  Content,
  ContentMdx,
  Header,
  Footer,
  FloatingBottom,
  RightRail,
  NavbarExtras,
  HeaderExtras,
  TocExtras,
  FooterExtras,
  BodyPortal,
}) as DocsLayoutComponent
