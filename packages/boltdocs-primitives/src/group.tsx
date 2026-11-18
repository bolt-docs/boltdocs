import * as React from 'react'

/**
 * A labelled group of controls, with no appearance.
 *
 * Three Boltdocs surfaces needed the same semantics — a button row, the
 * feedback ratings and the light/dark switch. Each had hand-written
 * `role="group"` markup; the contract lives here so a theme only decides where
 * the group sits and what it looks like.
 */
export interface GroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Exposed as `aria-orientation` when vertical. */
  orientation?: 'horizontal' | 'vertical'
  isDisabled?: boolean
  children?: React.ReactNode
}

export function Group({
  orientation = 'horizontal',
  isDisabled = false,
  className,
  children,
  ...rest
}: GroupProps): React.ReactElement {
  return (
    // `aria-orientation` is valid on role="group" and only emitted for the
    // vertical orientation; Biome cannot infer the role from the spread props.
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: valid on role="group", emitted only when vertical
    <div
      {...rest}
      role="group"
      aria-orientation={orientation === 'vertical' ? 'vertical' : undefined}
      aria-disabled={isDisabled || undefined}
      data-orientation={orientation}
      data-disabled={isDisabled || undefined}
      className={className}
    >
      {children}
    </div>
  )
}

Group.displayName = 'Group'
