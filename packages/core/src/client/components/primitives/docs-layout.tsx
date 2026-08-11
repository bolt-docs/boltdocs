import type { ReactNode, FC } from 'react'
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
      className={cn('boltdocs-page w-full pt-4 pb-20 px-4 sm:px-8', className)}
      style={style}
    >
      <SearchHighlight />
      <div className="mx-auto w-full max-w-3xl sm:max-w-4xl lg:max-w-5xl">
        {children}
      </div>
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

interface DocsLayoutComponent extends FC<SlotProps> {
  Body: typeof Body
  Content: typeof Content
  ContentMdx: typeof ContentMdx
  Header: typeof Header
}

export const DocsLayout = Object.assign(DocsLayoutRoot, {
  Body,
  Content,
  ContentMdx,
  Header,
}) as DocsLayoutComponent
