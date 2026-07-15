import type { ReactNode, FC } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../utils/cn'
import { SearchHighlight } from '../ui-base/search-highlight'

interface SlotProps {
  children?: ReactNode
  className?: string
  style?: React.CSSProperties
}

/**
 * Root layout shell. Mount children like:
 *   <DocsLayout><Navbar /><DocsLayout.Body>...</DocsLayout.Body></DocsLayout>
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

function Header({ children, className, style }: SlotProps) {
  return (
    <header className={cn('mb-10', className)} style={style}>
      {children}
    </header>
  )
}

function Footer({ children, className, style }: SlotProps) {
  return (
    <div className={cn('mt-20', className)} style={style}>
      {children}
    </div>
  )
}

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

function NavbarExtras({ children }: SlotProps) {
  return <>{children}</>
}

function HeaderExtras({ children }: SlotProps) {
  return <>{children}</>
}

function TocExtras({ children }: SlotProps) {
  return <>{children}</>
}

function FooterExtras({ children }: SlotProps) {
  return <>{children}</>
}

function BodyPortal({ children }: SlotProps) {
  if (typeof document === 'undefined') return <>{children}</>
  return createPortal(children, document.body)
}

interface DocsLayoutComponent extends FC<SlotProps> {
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
