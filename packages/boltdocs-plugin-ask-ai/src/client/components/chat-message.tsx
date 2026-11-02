import { memo } from 'react'
import { cn } from '../cn'
import type { Message } from '../use-ask-ai'
import { MarkdownRenderer } from '../render-markdown'
import type { ChatVariant } from './chat-header'
import { FileIcon } from './icons'
import { TypingIndicator } from './typing-indicator'

export interface ChatMessageProps {
  message: Message
  variant?: ChatVariant
  devMode: boolean
  className?: string
  userClassName?: string
  assistantClassName?: string
  markdownClassName?: string
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
      <span className="px-1 py-0.5 rounded bg-warning-500/15 text-warning-500 text-[10px] font-bold uppercase tracking-wide">
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

function ChatMessageImpl({
  message: msg,
  variant = 'bubble',
  devMode,
  className,
  userClassName,
  assistantClassName,
  markdownClassName,
}: ChatMessageProps) {
  const compact = variant === 'dialog'
  const isUser = msg.role === 'user'

  const containerClass = cn(
    'flex flex-col',
    compact ? 'max-w-full' : 'max-w-[85%]',
    isUser ? 'ml-auto items-end' : 'items-start',
    className,
  )

  const bubbleClass = cn(
    'rounded-2xl px-3.5 py-2.5 text-left',
    isUser
      ? cn(
          'rounded-br-md bg-primary-500 text-white shadow-sm',
          compact && 'max-w-[90%]',
          userClassName,
        )
      : msg.status === 'error'
        ? cn(
            'rounded-bl-md border border-danger-500/30 bg-danger-500/10 text-danger-500',
            assistantClassName,
          )
        : cn(
            'rounded-bl-md border border-subtle bg-surface text-body shadow-sm',
            assistantClassName,
          ),
  )

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
        ) : msg.status === 'cancelled' ? (
          msg.content ? (
            <div>
              <p className="whitespace-pre-wrap text-sm text-body">
                {msg.content}
              </p>
              <p className="mt-2 text-[11px] text-muted">Generation stopped.</p>
            </div>
          ) : (
            <p className={cn('text-muted', compact ? 'text-xs' : 'text-sm')}>
              Generation stopped.
            </p>
          )
        ) : msg.status === 'error' ? (
          msg.content ? (
            <div>
              <p className="whitespace-pre-wrap text-sm text-body">
                {msg.content}
              </p>
              <p className="mt-2 text-xs text-danger-500">
                {msg.errorMessage || 'Something went wrong.'}
              </p>
            </div>
          ) : (
            <p className={compact ? 'text-xs' : 'text-sm'}>
              <strong>Error:</strong>{' '}
              {msg.errorMessage || 'Something went wrong.'}
            </p>
          )
        ) : (
          <div className="ask-ai-streamdown">
            {msg.content ? (
              <MarkdownRenderer
                content={msg.content}
                className={cn('text-sm leading-relaxed', markdownClassName)}
              />
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

/**
 * Memoized so that during streaming only the message whose content actually
 * changed re-renders. The hook structurally shares the array and replaces the
 * final assistant message with a new object, so all older siblings keep their
 * identity and are skipped by the default shallow comparison.
 */
export const ChatMessage = memo(ChatMessageImpl)
