import { CloseIcon, SparkleIcon, TrashIcon } from './icons'

export type ChatVariant = 'bubble' | 'dialog'

interface ChatHeaderProps {
  title: string
  variant?: ChatVariant
  canClear: boolean
  onClear?: () => void
  onClose: () => void
}

export function ChatHeader({
  title,
  variant = 'bubble',
  canClear,
  onClear,
  onClose,
}: ChatHeaderProps) {
  const compact = variant === 'dialog'
  return (
    <div className="px-4 py-3 border-b border-subtle flex items-center justify-between bg-surface/50 shrink-0">
      <div className="flex items-center gap-2">
        <SparkleIcon
          size={compact ? 14 : 16}
          className="text-primary-500 shrink-0"
        />
        <span
          className={
            compact
              ? 'text-xs font-bold text-body'
              : 'text-sm font-semibold text-body'
          }
        >
          {title}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {canClear && (
          <button
            onClick={onClear}
            className="p-1 text-muted hover:text-red-500 hover:bg-surface rounded-lg transition-colors cursor-pointer"
            title="Clear chat"
            aria-label="Clear chat"
          >
            <TrashIcon size={compact ? 12 : 14} />
          </button>
        )}
        <button
          onClick={onClose}
          className="p-1 text-muted hover:text-body hover:bg-surface rounded-lg transition-colors cursor-pointer"
          title="Close assistant"
          aria-label="Close assistant"
        >
          <CloseIcon size={compact ? 12 : 16} />
        </button>
      </div>
    </div>
  )
}
