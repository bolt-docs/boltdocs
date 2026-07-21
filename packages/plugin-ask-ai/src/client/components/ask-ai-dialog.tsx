import { useEffect, useRef, type FormEvent } from 'react'
import { useAskAi } from '../use-ask-ai'
import { MarkdownRenderer } from '../render-markdown'

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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    submitQuestion(input)
  }

  if (!isOpen) return null

  return (
    <div className="hidden xl:flex flex-col shrink-0 w-[320px] border-l border-subtle bg-main overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-subtle flex items-center justify-between bg-surface/50 shrink-0">
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary-500 shrink-0"
          >
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
          </svg>
          <span className="text-xs font-bold text-body">AI Assistant</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="p-1 text-muted hover:text-red-500 hover:bg-surface rounded-lg transition-colors cursor-pointer"
              title="Clear chat"
              aria-label="Clear chat"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 text-muted hover:text-body hover:bg-surface rounded-lg transition-colors cursor-pointer"
            title="Close assistant"
            aria-label="Close assistant"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0">
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-2">
            <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-500 mb-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
              </svg>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Ask anything about the current documentation page
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex flex-col max-w-full ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            {/* Reading chip */}
            {msg.role === 'assistant' && msg.usage && devMode && (
              <div className="flex items-center gap-1.5 px-2 py-1 mb-1 text-[11px] text-muted font-mono">
                <span className="px-1 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wide">
                  DEV
                </span>
                <span>
                  {msg.usage.provider}/{msg.usage.model}
                </span>
                <span>·</span>
                <span>{msg.usage.promptTokens}↑</span>
                <span>{msg.usage.completionTokens}↓</span>
                <span>·</span>
                <span className="text-primary-500 font-semibold">
                  {msg.usage.totalTokens} tok
                </span>
                <span>·</span>
                <span>{msg.usage.elapsedMs}ms</span>
              </div>
            )}

            {msg.role === 'assistant' && msg.contextChip && (
              <div className="flex items-center gap-1.5 px-2 py-1 mb-1 text-[11px] text-muted">
                {msg.contextChip.missing ? (
                  <span>No docs in scope</span>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span>Reading</span>
                    <code className="px-1 py-0.5 rounded bg-surface text-primary-500 text-[10px] font-mono">
                      {msg.contextChip.page}
                    </code>
                    <span className="text-muted">·</span>
                    <span>{msg.contextChip.chars}c</span>
                  </>
                )}
              </div>
            )}

            <div
              className={`px-3 py-2 rounded-xl ${
                msg.role === 'user'
                  ? 'bg-primary-500 text-white rounded-br-none max-w-[90%]'
                  : msg.status === 'error'
                    ? 'bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded-bl-none'
                    : 'bg-surface border border-subtle text-body rounded-bl-none'
              }`}
            >
              {msg.role === 'user' ? (
                <p className="whitespace-pre-wrap text-xs">{msg.content}</p>
              ) : msg.status === 'error' ? (
                <p className="text-xs">
                  <strong>Error:</strong>{' '}
                  {msg.errorMessage || 'Something went wrong.'}
                </p>
              ) : (
                <div className="ask-ai-streamdown">
                  {msg.content ? (
                    <MarkdownRenderer content={msg.content} />
                  ) : msg.status === 'reading' ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
                      <span>Reading page…</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
                      <span>Waiting…</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-subtle bg-surface/30 flex gap-2 shrink-0"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this page…"
          className="flex-1 bg-surface border border-subtle rounded-lg px-2.5 py-1.5 text-xs outline-none text-body focus-within:border-primary-500 transition-colors min-w-0"
          disabled={isLoading}
        />
        {isLoading ? (
          <button
            type="button"
            onClick={stopStreaming}
            className="px-2.5 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Stop generating"
            aria-label="Stop generating"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-2.5 py-1.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Send question"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </button>
        )}
      </form>
    </div>
  )
}
