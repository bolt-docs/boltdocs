import type { Message } from '../use-ask-ai'
import { MarkdownRenderer } from '../render-markdown'
import type { ChatVariant } from './chat-header'
import { FileIcon } from './icons'
import { TypingIndicator } from './typing-indicator'

interface ChatMessageProps {
  message: Message
  variant?: ChatVariant
  devMode: boolean
}

function UsageChip({
  usage,
  compact,
}: {
  usage: NonNullable<Message['usage']>
  compact: boolean
}) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 mb-1 text-[11px] text-muted font-mono">
      <span className="px-1 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wide">
        DEV
      </span>
      <span title="Provider / model">
        {usage.provider}/{usage.model}
      </span>
      <span className="text-muted">·</span>
      <span title="Prompt tokens">{usage.promptTokens}↑</span>
      <span title="Completion tokens">{usage.completionTokens}↓</span>
      <span className="text-muted">·</span>
      <span title="Total tokens" className="text-primary-500 font-semibold">
        {usage.totalTokens} tok
      </span>
      {!compact && (
        <>
          <span className="text-muted">·</span>
          <span title="Elapsed">{usage.elapsedMs}ms</span>
        </>
      )}
    </div>
  )
}

function ContextChip({
  chip,
  compact,
}: {
  chip: NonNullable<Message['contextChip']>
  compact: boolean
}) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 mb-1 text-[11px] text-muted">
      {chip.missing ? (
        <span>{compact ? 'No docs in scope' : 'No docs page in scope'}</span>
      ) : (
        <>
          <FileIcon size={12} />
          <span>Reading</span>
          <code className="px-1 py-0.5 rounded bg-surface text-primary-500 text-[10px] font-mono">
            {chip.page}
          </code>
          <span className="text-muted">·</span>
          <span>
            {chip.chars}
            {compact ? 'c' : ' chars'}
          </span>
          {!compact && typeof chip.elapsedMs === 'number' && (
            <>
              <span className="text-muted">·</span>
              <span>{chip.elapsedMs}ms</span>
            </>
          )}
        </>
      )}
    </div>
  )
}

export function ChatMessage({
  message: msg,
  variant = 'bubble',
  devMode,
}: ChatMessageProps) {
  const compact = variant === 'dialog'
  const isUser = msg.role === 'user'

  const containerClass = `flex flex-col ${
    compact ? 'max-w-full' : 'max-w-[85%]'
  } ${isUser ? (compact ? 'items-end' : 'items-end ml-auto') : 'items-start'}`

  const bubbleClass = `px-3 py-2 rounded-xl ${
    isUser
      ? `bg-primary-500 text-white rounded-br-none${compact ? ' max-w-[90%]' : ''}`
      : msg.status === 'error'
        ? 'bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded-bl-none'
        : 'bg-surface border border-subtle text-body rounded-bl-none'
  }`

  return (
    <div className={containerClass}>
      {msg.role === 'assistant' && msg.usage && devMode && (
        <UsageChip usage={msg.usage} compact={compact} />
      )}
      {msg.role === 'assistant' && msg.contextChip && (
        <ContextChip chip={msg.contextChip} compact={compact} />
      )}
      <div className={bubbleClass}>
        {isUser ? (
          <p
            className={`whitespace-pre-wrap ${compact ? 'text-xs' : 'text-sm'}`}
          >
            {msg.content}
          </p>
        ) : msg.status === 'error' ? (
          <p className={compact ? 'text-xs' : 'text-sm'}>
            <strong>Error:</strong>{' '}
            {msg.errorMessage || 'Something went wrong.'}
          </p>
        ) : (
          <div className="ask-ai-streamdown">
            {msg.content ? (
              <MarkdownRenderer content={msg.content} />
            ) : msg.status === 'reading' ? (
              <TypingIndicator label="Reading page…" />
            ) : (
              <TypingIndicator label="Waiting…" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
