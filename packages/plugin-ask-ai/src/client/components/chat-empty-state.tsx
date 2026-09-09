import type { ChatVariant } from './chat-header'
import { SparkleIcon } from './icons'

interface ChatEmptyStateProps {
  description: string
  title?: string
  variant?: ChatVariant
}

export function ChatEmptyState({
  description,
  title = 'How can I help you today?',
  variant = 'bubble',
}: ChatEmptyStateProps) {
  const compact = variant === 'dialog'
  return (
    <div
      className={`flex-1 flex flex-col items-center justify-center text-center ${
        compact ? 'p-2' : 'p-6'
      }`}
    >
      <div
        className={`${
          compact ? 'w-10 h-10 rounded-xl' : 'w-12 h-12 rounded-full'
        } bg-primary-500/10 flex items-center justify-center text-primary-500 mb-3`}
      >
        <SparkleIcon size={compact ? 20 : 24} />
      </div>
      {!compact && (
        <h3 className="text-sm font-semibold text-body mb-1">{title}</h3>
      )}
      <p
        className={
          compact
            ? 'text-xs text-muted leading-relaxed'
            : 'text-xs text-muted max-w-[240px]'
        }
      >
        {description}
      </p>
    </div>
  )
}
