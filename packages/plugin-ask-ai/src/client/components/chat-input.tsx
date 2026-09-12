import type { FormEvent, KeyboardEvent, Ref } from 'react'
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
}: ChatInputProps) {
  const compact = variant === 'dialog'
  const canSubmit = Boolean(input.trim()) && !isLoading
  // Auto-grow composer: one row per line break, capped so long inputs scroll.
  const rows = Math.min(Math.max(input.split('\n').length, 1), 6)

  const handleKeyDown = (e: KeyboardEvent) => {
    // Enter to send, Shift+Enter for a new line.
    if (e.key !== 'Enter' || e.shiftKey) return
    e.preventDefault()
    if (canSubmit) onSubmit(input)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (canSubmit) onSubmit(input)
  }

  const buttonSize = compact ? 'size-8' : 'size-9'

  return (
    <div className={`${compact ? 'shrink-0 ' : ''}flex flex-col gap-1.5`}>
      <form
        onSubmit={handleSubmit}
        className={`flex items-end gap-2 rounded-xl border border-subtle bg-surface focus-within:border-primary-500 transition-colors ${compact ? 'px-2 py-1' : 'px-3 py-1.5'}`}
      >
        <textarea
          ref={inputRef}
          rows={rows}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          aria-label="Ask the assistant"
          className={`flex-1 resize-none bg-transparent outline-none placeholder:text-muted text-body leading-relaxed ${
            compact ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1.5 text-sm'
          }`}
        />
        {isLoading ? (
          <button
            type="button"
            onClick={onStop}
            title="Stop generating"
            aria-label="Stop generating"
            className={`${buttonSize} shrink-0 rounded-full bg-danger-500 hover:opacity-90 text-white flex items-center justify-center cursor-pointer select-none transition-opacity`}
          >
            <StopIcon size={compact ? 12 : 16} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            title="Send question"
            aria-label="Send question"
            className={`${buttonSize} shrink-0 rounded-full bg-primary-500 hover:bg-primary-600 disabled:opacity-40 text-white flex items-center justify-center cursor-pointer select-none transition-colors`}
          >
            <SendIcon size={compact ? 12 : 16} />
          </button>
        )}
      </form>
      <p
        className={`${compact ? 'text-[10px]' : 'text-[11px]'} text-muted select-none`}
      >
        {hint}
      </p>
    </div>
  )
}
