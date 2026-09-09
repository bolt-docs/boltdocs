import { useEffect, useRef } from 'react'
import { useAskAi } from '../use-ask-ai'
import { ChatEmptyState } from './chat-empty-state'
import { ChatHeader } from './chat-header'
import { ChatInput } from './chat-input'
import { ChatMessage } from './chat-message'
import { ChatIcon, CloseIcon } from './icons'

export function AskAiBubble() {
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

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [isOpen])

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 w-[380px] max-w-[calc(100vw-2rem)] h-[min(520px,calc(100vh-8rem))] bg-main/90 backdrop-blur-md border border-subtle rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          <ChatHeader
            title="Ask Assistant"
            canClear={messages.length > 0}
            onClear={clearChat}
            onClose={() => setIsOpen(false)}
          />

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {messages.length === 0 && (
              <ChatEmptyState description="Ask questions about the current documentation page. The assistant only answers using the page you're viewing." />
            )}
            {messages.map((msg, i) => (
              <ChatMessage key={i} message={msg} devMode={devMode} />
            ))}
            <div ref={messagesEndRef} />
          </div>

          <ChatInput
            input={input}
            onInputChange={setInput}
            onSubmit={submitQuestion}
            onStop={stopStreaming}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-12 h-12 bg-primary-500 hover:bg-primary-600 active:scale-95 text-white rounded-full flex items-center justify-center shadow-lg transition-all cursor-pointer select-none"
        title="Ask AI assistant"
        aria-label="Ask AI assistant"
      >
        {isOpen ? (
          <CloseIcon size={20} strokeWidth={2.5} />
        ) : (
          <ChatIcon size={20} />
        )}
      </button>
    </div>
  )
}
