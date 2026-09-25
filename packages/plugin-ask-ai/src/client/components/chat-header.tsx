import { cn } from '../cn'
import { CloseIcon, SparkleIcon, TrashIcon } from './icons'

export type ChatVariant = 'bubble' | 'dialog'

export interface ChatHeaderProps {
  title: string
  variant?: ChatVariant
  canClear: boolean
  onClear?: () => void
  onClose: () => void
  className?: string
  titleId?: string
}

export function ChatHeader({
  title,
  variant = 'bubble',
  canClear,
  onClear,
  onClose,
  className,
  titleId,
}: ChatHeaderProps) {
  const compact = variant === 'dialog'
  return (
    <header
      className={cn(
        'shrink-0 border-b border-subtle bg-gradient-to-r from-primary-500/8 to-transparent px-4 py-3',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary-500/12 text-primary-500">
            <SparkleIcon size={compact ? 15 : 17} />
          </span>
          <h2
            id={titleId}
            className={cn(
              'truncate font-semibold tracking-tight text-body',
              compact ? 'text-xs' : 'text-sm',
            )}
          >
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          {canClear ? (
            <button
              type="button"
              onClick={onClear}
              className="cursor-pointer rounded-lg p-1.5 text-muted transition-colors hover:bg-soft hover:text-danger-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
              title="Clear chat"
              aria-label="Clear chat"
            >
              <TrashIcon size={compact ? 13 : 15} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-muted transition-colors hover:bg-soft hover:text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
            title="Close assistant"
            aria-label="Close assistant"
          >
            <CloseIcon size={compact ? 13 : 16} />
          </button>
        </div>
      </div>
    </header>
  )
}
