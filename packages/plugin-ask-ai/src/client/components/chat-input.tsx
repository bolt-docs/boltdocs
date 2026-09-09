import type { FormEvent, Ref } from 'react'
import type { ChatVariant } from './chat-header'
import { SendIcon, StopIcon } from './icons'

interface ChatInputProps {
  input: string
  onInputChange: (value: string) => void
  onSubmit: (value: string) => void
  onStop: () => void
  isLoading: boolean
  placeholder?: string
  variant?: ChatVariant
  inputRef?: Ref<HTMLInputElement>
}

export function ChatInput({
  input,
  onInputChange,
  onSubmit,
  onStop,
  isLoading,
  placeholder = 'Ask about this page…',
  variant = 'bubble',
  inputRef,
}: ChatInputProps) {
  const compact = variant === 'dialog'

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    onSubmit(input)
  }

  const inputClass = `flex-1 bg-surface border border-subtle outline-none text-body transition-colors ${
    compact
      ? 'rounded-lg px-2.5 py-1.5 text-xs focus-within:border-primary-500 min-w-0'
      : 'rounded-xl px-3 py-1.5 text-sm focus-visible:border-primary-500'
  }`

  const actionClass = `font-semibold flex items-center justify-center transition-colors cursor-pointer select-none ${
    compact
      ? 'px-2.5 py-1.5 text-xs rounded-lg shrink-0'
      : 'px-3 py-1.5 text-sm rounded-xl'
  }`

  return (
    <form
      onSubmit={handleSubmit}
      className={`p-3 border-t border-subtle bg-surface/30 flex gap-2${
        compact ? ' shrink-0' : ''
      }`}
    >
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        placeholder={placeholder}
        className={inputClass}
        disabled={isLoading}
      />
      {isLoading ? (
        <button
          type="button"
          onClick={onStop}
          className={`bg-red-500 hover:bg-red-600 text-white ${actionClass}`}
          title="Stop generating"
          aria-label="Stop generating"
        >
          <StopIcon size={compact ? 12 : 16} />
        </button>
      ) : (
        <button
          type="submit"
          disabled={!input.trim()}
          className={`bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white ${actionClass}`}
          aria-label="Send question"
        >
          <SendIcon size={compact ? 12 : 16} />
        </button>
      )}
    </form>
  )
}
