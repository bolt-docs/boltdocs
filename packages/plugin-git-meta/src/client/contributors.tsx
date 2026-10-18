import type { ReactNode } from 'react'
import { cn } from 'boltdocs/client'
import type { RouteContributor } from 'boltdocs/client'

export interface ContributorsClassNames {
  root?: string
  avatars?: string
  avatar?: string
  names?: string
  name?: string
  link?: string
  trailing?: string
}

export interface ContributorsProps {
  /** Contributors derived from git history. */
  contributors?: RouteContributor[]
  /** Maximum number of contributors rendered before collapsing into "+N". */
  max?: number
  /** Avatar size preset. */
  size?: 'sm' | 'md'
  /** Render the avatar stack. Default: `true`. */
  showAvatars?: boolean
  /** Render the comma-separated name list. Default: `true`. */
  showNames?: boolean
  /** Screen-reader label announcing the list. Default: `'Contributors'`. */
  label?: string
  /** Class slots for every styled element. */
  classNames?: ContributorsClassNames
  /** Extra classes merged into the root element. */
  className?: string
  /** `target` used for profile links. Default: `'_blank'`. */
  linkTarget?: string
  /** Replace the default avatar for one contributor. */
  renderAvatar?: (contributor: RouteContributor, index: number) => ReactNode
  /** Replace the default name/link for one contributor. */
  renderName?: (contributor: RouteContributor, index: number) => ReactNode
  /** Fully replace the default rendering (avatars + names). */
  renderContributor?: (
    contributor: RouteContributor,
    index: number,
  ) => ReactNode
}

const SIZE_CLASSES = {
  sm: { avatar: 'size-5 text-[9px]', names: 'text-xs' },
  md: { avatar: 'size-6 text-[10px]', names: 'text-sm' },
} as const

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function commitLabel(commits: number): string {
  return `${commits} ${commits === 1 ? 'commit' : 'commits'}`
}

/**
 * Compact contributor list, fully customisable through class slots and render
 * props. Avatars are decorative (`alt=""`) because the author name is rendered
 * next to them, and profile links open in a new tab with a safe `rel`.
 */
export function Contributors({
  contributors,
  max = 5,
  size = 'sm',
  showAvatars = true,
  showNames = true,
  label = 'Contributors',
  classNames,
  className,
  linkTarget = '_blank',
  renderAvatar,
  renderName,
  renderContributor,
}: ContributorsProps) {
  if (!contributors || contributors.length === 0) return null
  if (!showAvatars && !showNames && !renderContributor) return null

  const visible = contributors.slice(0, max)
  const remaining = contributors.length - visible.length
  const sizeClasses = SIZE_CLASSES[size]

  return (
    <div
      role="group"
      className={cn(
        'flex min-w-0 items-center gap-2',
        classNames?.root,
        className,
      )}
      aria-label={label}
    >
      {showAvatars && !renderContributor && (
        <div
          className={cn(
            'flex shrink-0 items-center -space-x-1.5',
            classNames?.avatars,
          )}
        >
          {visible.map((contributor, index) => {
            const tooltip = `${contributor.name} — ${commitLabel(contributor.commits)}`

            const avatar = renderAvatar ? (
              renderAvatar(contributor, index)
            ) : contributor.avatar ? (
              <img
                src={contributor.avatar}
                alt=""
                width={20}
                height={20}
                loading="lazy"
                decoding="async"
                title={tooltip}
                className={cn(
                  'rounded-full border border-subtle bg-soft object-cover',
                  sizeClasses.avatar,
                  classNames?.avatar,
                )}
              />
            ) : (
              <span
                aria-hidden="true"
                title={tooltip}
                className={cn(
                  'flex items-center justify-center rounded-full border border-subtle bg-soft font-semibold text-muted',
                  sizeClasses.avatar,
                  classNames?.avatar,
                )}
              >
                {getInitials(contributor.name)}
              </span>
            )

            if (renderAvatar || !contributor.url) {
              return <span key={`${contributor.name}-${index}`}>{avatar}</span>
            }

            return (
              <a
                key={`${contributor.name}-${index}`}
                href={contributor.url}
                target={linkTarget}
                rel="noopener noreferrer"
                className="shrink-0 rounded-full"
              >
                {avatar}
              </a>
            )
          })}
        </div>
      )}

      {renderContributor ? (
        <span
          className={cn(
            'flex min-w-0 flex-wrap items-center',
            classNames?.names,
          )}
        >
          {visible.map((contributor, index) => (
            <span key={`${contributor.name}-custom-${index}`}>
              {index > 0 && ', '}
              {renderContributor(contributor, index)}
            </span>
          ))}
          {remaining > 0 && (
            <span className={classNames?.trailing}> +{remaining}</span>
          )}
        </span>
      ) : (
        showNames && (
          <span
            className={cn(
              'min-w-0 truncate',
              sizeClasses.names,
              classNames?.names,
            )}
          >
            {visible.map((contributor, index) => (
              <span
                key={`${contributor.name}-name-${index}`}
                className={classNames?.name}
              >
                {index > 0 && ', '}
                {renderName ? (
                  renderName(contributor, index)
                ) : contributor.url ? (
                  <a
                    href={contributor.url}
                    target={linkTarget}
                    rel="noopener noreferrer"
                    className={cn(
                      'underline-offset-2 hover:text-body hover:underline',
                      classNames?.link,
                    )}
                  >
                    {contributor.name}
                  </a>
                ) : (
                  contributor.name
                )}
              </span>
            ))}
            {remaining > 0 && (
              <span className={classNames?.trailing}> +{remaining}</span>
            )}
          </span>
        )
      )}
    </div>
  )
}
