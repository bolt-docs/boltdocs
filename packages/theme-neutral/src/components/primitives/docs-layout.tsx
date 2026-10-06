import type { CSSProperties, ReactNode, FC } from 'react'
import { cn } from '../../utils/cn'
import { SearchHighlight } from '../ui-base/search-highlight'

interface SlotProps {
  children?: ReactNode
  className?: string
  style?: CSSProperties
}

/**
 * Layout structure. Mount children like:
 *   <DocsLayout><Navbar /><DocsLayout.Body>...</DocsLayout.Body></DocsLayout>
 *
 * `bdocs-root` on the root is what scopes the theme's element defaults in
 * `styles/base.css`. Without it the theme has no typography layer and only the
 * per-component rules apply — which is exactly how the base sheet ended up
 * inert the first time round.
 */
function DocsLayoutRoot({ children, className, style }: SlotProps) {
  return (
    <div className={cn('bdocs-root', className)} style={style}>
      {children}
    </div>
  )
}

function Body({ children, className, style }: SlotProps) {
  return (
    <div className={cn('bdocs-layout__body', className)} style={style}>
      {children}
    </div>
  )
}

function Content({ children, className, style }: SlotProps) {
  return (
    <main className={cn('bdocs-layout__content', className)} style={style}>
      {children}
    </main>
  )
}

interface ContentMdxProps extends SlotProps {
  /**
   * Class name for the inner reading-column wrapper. Lets themes override
   * the default `max-w-3xl sm:max-w-4xl lg:max-w-5xl` content width.
   */
  contentClassName?: string
  contentStyle?: CSSProperties
}

function ContentMdx({
  children,
  className,
  style,
  contentClassName,
  contentStyle,
}: ContentMdxProps) {
  return (
    <div className={cn('bdocs-page', className)} style={style}>
      <SearchHighlight />
      <div
        className={cn('bdocs-page__column', contentClassName)}
        style={contentStyle}
      >
        {children}
      </div>
    </div>
  )
}

function Header({ children, className, style }: SlotProps) {
  return (
    <header className={cn('bdocs-layout__header', className)} style={style}>
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
