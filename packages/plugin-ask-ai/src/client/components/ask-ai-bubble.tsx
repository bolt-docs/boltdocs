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
    ui,
  } = useAskAi()

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [isOpen])

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col items-stretch md:inset-x-auto md:bottom-6 md:right-6 md:items-end">
      {isOpen && (
        <div className="mb-0 h-[min(100dvh,680px)] w-full bg-main/95 backdrop-blur-md border border-subtle rounded-t-2xl shadow-xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200 md:mb-4 md:h-[min(520px,calc(100vh-8rem))] md:w-[380px] md:max-w-[calc(100vw-2rem)] md:rounded-2xl">
          <ChatHeader
            title={ui.title}
            canClear={messages.length > 0}
            onClear={clearChat}
            onClose={() => setIsOpen(false)}
          />

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {messages.length === 0 && (
              <ChatEmptyState
                title={ui.emptyTitle}
                description={ui.emptyDescription}
              />
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
            placeholder={ui.placeholder}
            hint={ui.composerHint}
          />
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-12 h-12 bg-primary-500 hover:bg-primary-600 active:scale-95 text-white rounded-full flex items-center justify-center shadow-lg transition-all cursor-pointer select-none"
        title={ui.buttonTooltip}
        aria-label={ui.buttonTooltip}
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
