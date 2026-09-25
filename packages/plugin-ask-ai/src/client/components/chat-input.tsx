import type { FormEvent, KeyboardEvent, Ref } from 'react'
import { useId } from 'react'
import { cn } from '../cn'
import type { ChatVariant } from './chat-header'
import { SendIcon, StopIcon } from './icons'

interface ChatInputProps {
  input: string
  onInputChange: (value: string) => void
  onSubmit: (value: string) => void
  onStop: () => void
  isLoading: boolean
  placeholder?: string
  hint?: string
  variant?: ChatVariant
  inputRef?: Ref<HTMLTextAreaElement>
  className?: string
  inputClassName?: string
}

export function ChatInput({
  input,
  onInputChange,
  onSubmit,
  onStop,
  isLoading,
  placeholder = 'Ask about this page…',
  hint = 'Enter to send · Shift+Enter for a new line',
  variant = 'bubble',
  inputRef,
  className,
  inputClassName,
}: ChatInputProps) {
  const compact = variant === 'dialog'
  const hintId = useId()
  const canSubmit = Boolean(input.trim()) && !isLoading
  const rows = Math.min(Math.max(input.split('\n').length, 1), 6)

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    if (canSubmit) onSubmit(input)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (canSubmit) onSubmit(input)
  }

  const buttonSize = compact ? 'size-8' : 'size-9'

  return (
    <div
      className={cn(
        'flex flex-col gap-1.5',
        compact ? 'shrink-0' : 'shrink-0',
        className,
      )}
    >
      <form
        onSubmit={handleSubmit}
        className={cn(
          'flex items-end gap-2 rounded-2xl border border-subtle bg-surface/80 p-1.5 shadow-sm transition-colors focus-within:border-primary-500/60 focus-within:ring-2 focus-within:ring-primary-500/10',
          inputClassName,
        )}
      >
        <textarea
          ref={inputRef}
          rows={rows}
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          aria-label="Ask the assistant"
          aria-describedby={hintId}
          className={cn(
            'min-h-8 flex-1 resize-none bg-transparent px-2 py-1.5 text-body leading-relaxed outline-none placeholder:text-muted',
            compact ? 'text-xs' : 'text-sm',
          )}
        />
        {isLoading ? (
          <button
            type="button"
            onClick={onStop}
            title="Stop generating"
            aria-label="Stop generating"
            className={cn(
              buttonSize,
              'flex shrink-0 cursor-pointer select-none items-center justify-center rounded-full bg-danger-500 text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500/40',
            )}
          >
            <StopIcon size={compact ? 12 : 16} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            title="Send question"
            aria-label="Send question"
            className={cn(
              buttonSize,
              'flex shrink-0 cursor-pointer select-none items-center justify-center rounded-full bg-primary-500 text-white transition-all hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
            )}
          >
            <SendIcon size={compact ? 12 : 16} />
          </button>
        )}
      </form>
      <p
        id={hintId}
        className={cn(
          'select-none px-1 text-muted',
          compact ? 'text-[10px]' : 'text-[11px]',
        )}
      >
        {hint}
      </p>
    </div>
  )
}
