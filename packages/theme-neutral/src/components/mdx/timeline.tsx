import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { formatDeterministicDate } from '../../utils/date'
import { Check, Info, AlertCircle, AlertTriangle } from '../ui-base/icons'

/**
 * Variants for both dots and badges.
 *
 * - Semantic: `primary`, `success`, `info`, `warning`, `danger` map directly
 *   to the dot accent color and the badge pill background.
 * - Lifecycle (alias for semantic but convenient for changelogs):
 *   `major` → primary, `minor` → success, `patch` → info,
 *   `new` → primary, `deprecated` → warning, `breaking` → danger.
 */
export type TimelineVariant =
  | 'primary'
  | 'success'
  | 'info'
  | 'warning'
  | 'danger'
  | 'major'
  | 'minor'
  | 'patch'
  | 'new'
  | 'deprecated'
  | 'breaking'

export interface TimelineBadgeConfig {
  text: ReactNode
  variant?: TimelineVariant
}

export interface TimelineProps
  extends Omit<React.HTMLAttributes<HTMLOListElement>, 'children'> {
  children?: ReactNode
  /** Reduce vertical padding between items. */
  compact?: boolean
  connectorClassName?: string
}

export interface TimelineItemProps
  extends Omit<React.HTMLAttributes<HTMLLIElement>, 'title' | 'children'> {
  /** Date the entry happened. Accepts ISO string, epoch ms, or `Date` instance. */
  date?: string | number | Date
  /** Headline shown beside the date. */
  title: ReactNode
  /** Inline badge to the right of the title (e.g. "Major", "Breaking"). */
  badge?: string | TimelineBadgeConfig
  /** Icon to render inside the dot. Falls back to a coloured filled circle. */
  icon?: ReactNode
  /** Dot / badge accent colour. Defaults to `primary`. */
  variant?: TimelineVariant
  /**
   * BCP-47 locale tag used by `toLocaleDateString` for the rendered
   * date. Defaults to `'en-US'` so server and client produce identical
   * markup on hydration. Pass `'es'`, `'fr'`, etc. to localize.
   */
  locale?: string
  /** Body content for the entry. Accepts Markdown/markup from MDX. */
  children?: ReactNode
  dotClassName?: string
  headerClassName?: string
  timeClassName?: string
  badgeClassName?: string
  titleClassName?: string
  bodyClassName?: string
}

// ───────────────────────────────────────────────────────────────────────
// Variant → attribute
// ───────────────────────────────────────────────────────────────────────

/**
 * The five semantic variants.
 *
 * This used to be a table of eleven *Tailwind class strings* — `ring`,
 * `fill`, `badgeBg`, `badgeText`, `badgeBorder`, five per variant, spread onto
 * class names at the call site. The classes were the whole vocabulary, so
 * anything that changed one of them was a code change and a site could not
 * retheme a single variant.
 *
 * The variant is now a `data-variant` attribute, and `timeline.css` maps each
 * one to tokens. A site that wants `danger` to be purple writes one rule;
 * the palette is data, not a dependency on a CSS build.
 */
const LIFECYCLE_ALIAS: Record<string, string> = {
  major: 'primary',
  minor: 'success',
  patch: 'info',
  new: 'primary',
  deprecated: 'warning',
  breaking: 'danger',
}

/** Resolves a lifecycle alias to the semantic variant it is bound to. */
function semantic(variant: TimelineVariant): string {
  return LIFECYCLE_ALIAS[variant] ?? variant
}

// ───────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────

function normalizeBadge(badge: string | TimelineBadgeConfig | undefined): {
  text: ReactNode
  variant: TimelineVariant
} | null {
  if (!badge) return null
  if (typeof badge === 'string') {
    return { text: badge, variant: 'primary' }
  }
  return {
    text: badge.text,
    variant: badge.variant ?? 'primary',
  }
}

function formatDate(
  date: string | number | Date | undefined,
  locale?: string,
): string | null {
  if (date === undefined || date === null || date === '') return null
  // Pinned locale and zone so the server and client render identical text on
  // hydration; an explicit `locale` stays deterministic because it is fixed in
  // the markup rather than inferred from the runtime.
  const formatted = formatDeterministicDate(date, {
    locale,
    month: 'short',
  })
  return formatted === '' ? null : formatted
}

const VARIANT_DEFAULT_ICON: Partial<
  Record<
    TimelineVariant,
    React.ComponentType<{ size?: number; className?: string }>
  >
> = {
  success: Check,
  info: Info,
  warning: AlertTriangle,
  danger: AlertCircle,
}

// ───────────────────────────────────────────────────────────────────────
// Root timeline
// ───────────────────────────────────────────────────────────────────────

function TimelineRoot({
  children,
  className,
  compact = false,
  connectorClassName,
  ...props
}: TimelineProps) {
  return (
    <ol
      className={cn(
        'bdocs-timeline',
        compact && 'bdocs-timeline--compact',
        className,
      )}
      {...props}
    >
      {/* Connector line — continuous across items, hidden from AT */}
      <span
        aria-hidden="true"
        className={cn('bdocs-timeline__connector', connectorClassName)}
      />
      {children}
    </ol>
  )
}

// ───────────────────────────────────────────────────────────────────────
// Single timeline entry
// ───────────────────────────────────────────────────────────────────────

function TimelineItem({
  date,
  title,
  badge,
  icon,
  variant = 'primary',
  locale,
  className,
  children,
  dotClassName,
  headerClassName,
  timeClassName,
  badgeClassName,
  titleClassName,
  bodyClassName,
  ...props
}: TimelineItemProps) {
  const formatted = formatDate(date, locale)
  const badgeCfg = normalizeBadge(badge)
  const resolved = semantic(variant)

  // Default icon when none provided
  const FallbackIcon = VARIANT_DEFAULT_ICON[variant]
  const dot =
    icon ??
    (FallbackIcon ? (
      <FallbackIcon
        size={12}
        className="bdocs-timeline__dot-icon"
        aria-hidden="true"
      />
    ) : (
      <span aria-hidden="true" className="bdocs-timeline__dot-fallback" />
    ))

  const ariaLabel =
    [formatted, typeof title === 'string' ? title : null]
      .filter(Boolean)
      .join(' - ') || undefined

  // Conditionally render the dot with aria attrs only when needed.
  // `role="img"` + `aria-label` when we have date+title; otherwise
  // the dot is decorative (`aria-hidden` only).
  const a11yProps = ariaLabel
    ? { role: 'img' as const, 'aria-label': ariaLabel }
    : { 'aria-hidden': 'true' as const }

  return (
    <li className={cn('bdocs-timeline__item', className)} {...props}>
      <span
        {...a11yProps}
        data-variant={resolved}
        className={cn('bdocs-timeline__dot', dotClassName)}
      >
        {dot}
      </span>

      {/* Header row: date + optional badge */}
      <div className={cn('bdocs-timeline__header', headerClassName)}>
        {formatted && (
          <time
            dateTime={
              date instanceof Date
                ? date.toISOString()
                : new Date(date as string | number).toISOString()
            }
            className={cn('bdocs-timeline__time', timeClassName)}
          >
            {formatted}
          </time>
        )}
        {badgeCfg && (
          <span
            data-variant={semantic(badgeCfg.variant)}
            className={cn('bdocs-timeline__badge', badgeClassName)}
          >
            {badgeCfg.text}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className={cn('bdocs-timeline__title', titleClassName)}>{title}</h3>

      {/* Body (Markdown inside MDX) */}
      {children && (
        <div
          className={cn(
            'bdocs-timeline__body prose prose-neutral dark:prose-invert max-w-none',
            bodyClassName,
          )}
        >
          {children}
        </div>
      )}
    </li>
  )
}

// ───────────────────────────────────────────────────────────────────────
// Compound export
// ───────────────────────────────────────────────────────────────────────

export const Timeline = Object.assign(TimelineRoot, {
  Item: TimelineItem,
})

export default Timeline
