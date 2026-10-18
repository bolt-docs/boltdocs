import { cn } from 'boltdocs/client'
import type { RouteContributor } from 'boltdocs/client'
import {
  Contributors,
  type ContributorsClassNames,
  type ContributorsProps,
} from './contributors'
import { LastUpdated } from './last-updated'

export interface GitMetaFooterLabels {
  contributors?: string
  lastUpdated?: string
}

export interface GitMetaFooterProps {
  /** Route date, usually `route.lastUpdated`. */
  date?: string | number | Date
  /** Route contributors, usually `route.contributors`. */
  contributors?: RouteContributor[]
  /** Render the contributor list. Default: `true`. */
  showContributors?: boolean
  /** Render the last-updated date. Default: `true`. */
  showLastUpdated?: boolean
  /** Maximum contributors before collapsing into "+N". */
  maxContributors?: number
  /** Custom labels for both halves of the footer. */
  labels?: GitMetaFooterLabels
  /** Custom date formatter. */
  formatDate?: (date: Date) => string
  /** Root classes. */
  className?: string
  /** Classes for the contributors block. */
  contributorsClassName?: string
  /** Classes for the date. */
  dateClassName?: string
  /** Every `Contributors` prop except the data and root class. */
  contributorProps?: Omit<
    ContributorsProps,
    'contributors' | 'className' | 'label'
  >
  /** Class slots forwarded to `Contributors`. */
  contributorClassNames?: ContributorsClassNames
}

/**
 * Ready-to-use page footer combining contributors and the last-updated date.
 *
 * It is deliberately unopinionated about placement: render it at the end of a
 * custom layout or page. The default Boltdocs layout mounts the contributors
 * plugin on its own and renders the date itself.
 */
export function GitMetaFooter({
  date,
  contributors,
  showContributors = true,
  showLastUpdated = true,
  maxContributors,
  labels,
  formatDate,
  className,
  contributorsClassName,
  dateClassName,
  contributorProps,
  contributorClassNames,
}: GitMetaFooterProps) {
  const hasContributors =
    showContributors && Boolean(contributors && contributors.length > 0)
  const hasDate = showLastUpdated && Boolean(date)
  if (!hasContributors && !hasDate) return null

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 text-xs text-muted',
        className,
      )}
    >
      {hasContributors && (
        <Contributors
          contributors={contributors}
          max={maxContributors}
          label={labels?.contributors}
          className={contributorsClassName}
          classNames={contributorClassNames}
          {...contributorProps}
        />
      )}
      {hasDate && (
        <LastUpdated
          date={date}
          label={labels?.lastUpdated}
          formatDate={formatDate}
          className={cn('ml-auto', dateClassName)}
        />
      )}
    </div>
  )
}
