import type { ReactNode } from 'react'
import { cn } from '../utils/cn'

/**
 * The frame the application renders into.
 *
 * It owns the viewport height and the scroll container, and nothing else:
 * collections and external pages render inside it without the documentation
 * chrome, which is why it is not part of `DocsLayout`.
 */
export function ShellFrame({
  children,
  className,
}: {
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('bdocs-shell', className)}>
      {children}
    </div>
  )
}
