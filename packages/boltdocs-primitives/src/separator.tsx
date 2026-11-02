import type * as React from 'react'
import { composeRenderProps, filterDOMProps, type RenderProps } from './utils'

/** Render state a Separator exposes, so `className` can branch on it. */
export interface SeparatorRenderProps {
  orientation: 'horizontal' | 'vertical'
}

export interface SeparatorProps
  extends Omit<
      React.HTMLAttributes<HTMLElement>,
      'children' | 'className' | 'style'
    >,
    RenderProps<SeparatorRenderProps> {
  children?: React.ReactNode
  orientation?: SeparatorRenderProps['orientation']
}

/**
 * A separator between groups of content.
 *
 * Renders `<hr>` when horizontal and `<div role="separator">` when vertical,
 * because `<hr>` only carries implicit separator semantics horizontally — a
 * vertical one has to be spelled out with the role.
 *
 * Style-neutral: it ships no colour. `bg-border` here would have been a second
 * background competing with whatever the caller passes — core styles it
 * `bg-subtle`, and which of two same-specificity background utilities wins is
 * decided by their order in the generated stylesheet, not by the order they are
 * written here. A separator with no background renders as the page's, which is
 * the honest default for a rule the caller has not styled.
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
      // biome-ignore lint/a11y/useFocusableInteractive: a static separator is not a widget, so it stays out of the tab order
      <div
        // biome-ignore lint/a11y/useAriaPropsForRole: aria-valuenow is required on the focusable separator, which is a different widget
        role="separator"
        aria-orientation="vertical"
        className={resolved.className}
        style={resolved.style}
        {...domProps}
      >
        {resolved.children}
      </div>
    )
  }

  // `<hr>` is a void element, so unlike the vertical branch it cannot carry
  // children. Rendering them would put markup the HTML parser re-parents out of
  // the `<hr>`, which is exactly the kind of mismatch that only shows up in a
  // real browser.
  return (
    <hr
      aria-orientation="horizontal"
      className={resolved.className}
      style={resolved.style}
      {...domProps}
    />
  )
}

Separator.displayName = 'Separator'
