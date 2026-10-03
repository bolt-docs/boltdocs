import type * as React from 'react'
import { cn, composeRenderProps, filterDOMProps } from './utils'

/** Render state a Separator exposes, so `className` can branch on it. */
export interface SeparatorRenderProps {
  orientation: 'horizontal' | 'vertical'
}

export interface SeparatorProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'children'>,
    composeRenderProps<SeparatorRenderProps> {
  orientation?: SeparatorRenderProps['orientation']
}

/**
 * A separator between groups of content.
 *
 * Renders `<hr>` when horizontal and `<div role="separator">` when vertical,
 * because `<hr>` only carries implicit separator semantics horizontally — a
 * vertical one has to be spelled out with the role.
 *
 * Deliberately not focusable. A static separator is announced as "separator"
 * when a screen-reader user navigates past it, and putting it in the tab order
 * would add an element with no action to the user's path. The focusable variant
 * is a different widget with different required ARIA, and adding that here
 * without a use for it would be inventing semantics rather than implementing a
 * pattern.
 */
export function Separator(props: SeparatorProps): React.ReactElement {
  const {
    orientation = 'horizontal',
    className,
    style,
    children,
    ...rest
  } = props

  const { domProps } = filterDOMProps(rest as Record<string, unknown>)
  const resolved = composeRenderProps<SeparatorRenderProps>(
    { className, style, children },
    { orientation },
  )

  if (orientation === 'vertical') {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={cn('bg-border', resolved.className)}
        style={resolved.style}
        {...domProps}
      >
        {resolved.children}
      </div>
    )
  }

  return (
    <hr
      aria-orientation="horizontal"
      className={cn('border-t border-border', resolved.className)}
      style={resolved.style}
      {...domProps}
    >
      {resolved.children}
    </hr>
  )
}

Separator.displayName = 'Separator'
