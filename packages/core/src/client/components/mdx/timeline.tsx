import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'
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
}

// ───────────────────────────────────────────────────────────────────────
// Variant palette
// ───────────────────────────────────────────────────────────────────────

interface VariantPalette {
  /** Ring colour around the dot. */
  ring: string
  /** Filled centre colour. */
  fill: string
  /** Badge pill colour. */
  badgeBg: string
  badgeText: string
  badgeBorder: string
}

// Semantic palette only — the seven semantic variants. Lifecycle
// aliases are added below in a second pass via `Object.assign` so we
// avoid the TDZ trap of self-referencing VARIANT_PALETTE during init.
const VARIANT_PALETTE: Record<TimelineVariant, VariantPalette> = {
  primary: {
    ring: 'border-primary-500/70',
    fill: 'bg-primary-500',
    badgeBg: 'bg-primary-500/10',
    badgeText: 'text-primary-600 dark:text-primary-400',
    badgeBorder: 'border-primary-500/30',
  },
  success: {
    ring: 'border-success-500/70',
    fill: 'bg-success-500',
    badgeBg: 'bg-success-500/10',
    badgeText: 'text-success-500',
    badgeBorder: 'border-success-500/30',
  },
  info: {
    ring: 'border-info-500/70',
    fill: 'bg-info-500',
    badgeBg: 'bg-info-500/10',
    badgeText: 'text-info-500',
    badgeBorder: 'border-info-500/30',
  },
  warning: {
    ring: 'border-warning-500/70',
    fill: 'bg-warning-500',
    badgeBg: 'bg-warning-500/10',
    badgeText: 'text-warning-500',
    badgeBorder: 'border-warning-500/30',
  },
  danger: {
    ring: 'border-danger-500/70',
    fill: 'bg-danger-500',
    badgeBg: 'bg-danger-500/10',
    badgeText: 'text-danger-500',
    badgeBorder: 'border-danger-500/30',
  },
  // Lifecycle aliases — will be overwritten right below.
  major: { ring: '', fill: '', badgeBg: '', badgeText: '', badgeBorder: '' },
  minor: { ring: '', fill: '', badgeBg: '', badgeText: '', badgeBorder: '' },
  patch: { ring: '', fill: '', badgeBg: '', badgeText: '', badgeBorder: '' },
  new: { ring: '', fill: '', badgeBg: '', badgeText: '', badgeBorder: '' },
  deprecated: {
    ring: '',
    fill: '',
    badgeBg: '',
    badgeText: '',
    badgeBorder: '',
  },
  breaking: { ring: '', fill: '', badgeBg: '', badgeText: '', badgeBorder: '' },
}

// Bind lifecycle aliases to semantic variants. Object.assign runs
// after the const initialiser completes, so this is safe.
Object.assign(VARIANT_PALETTE, {
  major: VARIANT_PALETTE.primary,
  minor: VARIANT_PALETTE.success,
  patch: VARIANT_PALETTE.info,
  new: VARIANT_PALETTE.primary,
  deprecated: VARIANT_PALETTE.warning,
  breaking: VARIANT_PALETTE.danger,
})

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
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return null
  // Pin a default locale so the server and client render identical text
  // on hydration; users who want localized dates pass an explicit `locale`.
  return d.toLocaleDateString(locale ?? 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const VARIANT_DEFAULT_ICON: Partial<
  Record<TimelineVariant, React.ComponentType<any>>
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
  ...props
}: TimelineProps) {
  return (
    <ol
      role="list"
      className={cn(
        'relative my-8 ms-3',
        compact ? 'space-y-3' : 'space-y-7',
        className,
      )}
      {...props}
    >
      {/* Connector line — continuous across items, hidden from AT */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-3 bottom-3 start-[5.5px] w-px bg-subtle"
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
  ...props
}: TimelineItemProps) {
  const palette = VARIANT_PALETTE[variant] ?? VARIANT_PALETTE.primary
  const formatted = formatDate(date, locale)
  const badgeCfg = normalizeBadge(badge)

  // Default icon when none provided
  const FallbackIcon = VARIANT_DEFAULT_ICON[variant]
  const dot =
    icon ??
    (FallbackIcon ? (
      <FallbackIcon size={12} className="text-white" aria-hidden="true" />
    ) : (
      <span
        aria-hidden="true"
        className={cn('w-2 h-2 rounded-full', palette.fill)}
      />
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
    <li className={cn('relative ps-8', className)} {...props}>
      <span
        {...a11yProps}
        className={cn(
          'absolute start-0 top-1 flex items-center justify-center w-3 h-3 rounded-full',
          'bg-surface border-2 shadow-sm',
          palette.ring,
        )}
      >
        {dot}
      </span>

      {/* Header row: date + optional badge */}
      <div className="flex items-center gap-2 flex-wrap mb-1">
        {formatted && (
          <time
            dateTime={
              date instanceof Date
                ? date.toISOString()
                : new Date(date as string | number).toISOString()
            }
            className="text-[11px] uppercase tracking-wider font-mono tabular-nums text-muted select-none"
          >
            {formatted}
          </time>
        )}
        {badgeCfg && (
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border',
              palette.badgeBg,
              palette.badgeText,
              palette.badgeBorder,
            )}
          >
            {badgeCfg.text}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-body m-0 leading-snug">
        {title}
      </h3>

      {/* Body (Markdown inside MDX) */}
      {children && (
        <div className="mt-2 text-[0.9rem] leading-[1.6] text-paragraph prose prose-neutral dark:prose-invert max-w-none [&>p]:m-0 [&>p+p]:mt-2 [&_a]:text-primary-500 [&_a]:no-underline hover:[&_a]:underline">
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
