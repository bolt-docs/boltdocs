import { useEffect, useRef } from 'react'
import { useAskAi } from '../use-ask-ai'
import { ChatEmptyState } from './chat-empty-state'
import { ChatHeader } from './chat-header'
import { ChatInput } from './chat-input'
import { ChatMessage } from './chat-message'

export function AskAiDialog() {
  const {
    messages,
    input,
    setInput,
    isLoading,
    submitQuestion,
    stopStreaming,
    clearChat,
    isOpen,
    setIsOpen,
    devMode,
  } = useAskAi()

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      window.dispatchEvent(new CustomEvent('boltdocs:ask-ai:open'))
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      inputRef.current?.focus()
    } else {
      window.dispatchEvent(new CustomEvent('boltdocs:ask-ai:close'))
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="hidden xl:flex flex-col shrink-0 w-[320px] border-l border-subtle bg-main overflow-hidden">
      <ChatHeader
        title="AI Assistant"
        variant="dialog"
        canClear={messages.length > 0}
        onClear={clearChat}
        onClose={() => setIsOpen(false)}
      />

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0">
        {messages.length === 0 && (
          <ChatEmptyState
            variant="dialog"
            description="Ask anything about the current documentation page"
          />
        )}
        {messages.map((msg, i) => (
          <ChatMessage
            key={i}
            message={msg}
            variant="dialog"
            devMode={devMode}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput
        variant="dialog"
        input={input}
        onInputChange={setInput}
        onSubmit={submitQuestion}
        onStop={stopStreaming}
        isLoading={isLoading}
        inputRef={inputRef}
      />
    </div>
  )
}
