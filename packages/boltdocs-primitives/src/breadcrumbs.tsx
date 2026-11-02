import type * as React from 'react'
import { cn } from './utils'

export interface BreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
  /** Names the navigation region for a screen reader. */
  'aria-label'?: string
  children?: React.ReactNode
}

/**
 * Breadcrumb navigation.
 *
 * `<nav>` wrapping `<ol>`, with `aria-current="page"` on the last crumb. The list
 * matters: the default is `<div>`, and a breadcrumb rendered as a flat set of
 * links loses the "you are here, and here is the path to it" that the ordered
 * structure conveys visually as chevrons.
 *
 * No `aria-label` default. A `<nav>` with several landmarks on one page is
 * ambiguous, but inventing a label that does not match the site's own wording
 * ("Breadcrumbs" vs whatever the author calls it) is worse than leaving the
 * caller to set one.
 */
export function Breadcrumbs({
  className,
  children,
  ...rest
}: BreadcrumbsProps): React.ReactElement {
  return (
    <nav className={cn('flex flex-wrap items-center', className)} {...rest}>
      <ol className="flex flex-wrap items-center">{children}</ol>
    </nav>
  )
}

Breadcrumbs.displayName = 'Breadcrumbs'

export interface BreadcrumbProps extends React.LiHTMLAttributes<HTMLLIElement> {
  children?: React.ReactNode
}

/**
 * One crumb.
 *
 * `aria-current="page"` comes from the caller's `aria-current` rather than being
 * inferred from position, because a crumb list can end in a non-current item —
 * a link to the section you are inside, for instance.
 */
export function Breadcrumb({
  className,
  children,
  ...rest
}: BreadcrumbProps): React.ReactElement {
  return (
    <li className={cn('flex items-center', className)} {...rest}>
      {children}
    </li>
  )
}

Breadcrumb.displayName = 'Breadcrumb'

export interface BreadcrumbsSeparatorProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  /** Marks this crumb as presentational, so it is not read as content. */
  decorative?: boolean
  children?: React.ReactNode
}

/**
 * The separator between crumbs.
 *
 * `aria-hidden` by default: a chevron is decoration, and announcing "greater
 * than" between every pair of links is noise that pushes the actual page names
 * further apart in speech.
 */
export function BreadcrumbsSeparator({
  className,
  decorative = true,
  children,
  ...rest
}: BreadcrumbsSeparatorProps): React.ReactElement {
  return (
    <span aria-hidden={decorative || undefined} className={className} {...rest}>
      {children}
    </span>
  )
}

BreadcrumbsSeparator.displayName = 'BreadcrumbsSeparator'
