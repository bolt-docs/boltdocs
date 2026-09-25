import { useEffect, useId, useRef } from 'react'
import { cn } from '../cn'
import { useAskAi } from '../use-ask-ai'
import type { UseAskAiOptions } from '../use-ask-ai'
import { ChatEmptyState } from './chat-empty-state'
import { ChatHeader } from './chat-header'
import { ChatInput } from './chat-input'
import { ChatMessage } from './chat-message'
import { ChatIcon, CloseIcon } from './icons'

export interface AskAiBubbleProps extends UseAskAiOptions {}

export function AskAiBubble(props: AskAiBubbleProps = {}) {
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
    classNames = {},
  } = useAskAi(props)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const wasOpenRef = useRef(false)
  const titleId = useId()
  const panelId = useId()
  const lastMessageContent = messages.at(-1)?.content

  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true
      inputRef.current?.focus()
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false
      triggerRef.current?.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && lastMessageContent !== undefined) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [isOpen, lastMessageContent])

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-stretch md:inset-x-auto md:bottom-6 md:right-6 md:items-end',
        classNames.root,
      )}
    >
      {isOpen ? (
        <section
          id={panelId}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setIsOpen(false)
              return
            }
            if (event.key !== 'Tab') return
            const focusable = Array.from(
              event.currentTarget.querySelectorAll<HTMLElement>(
                'button:not([disabled]), textarea:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
              ),
            )
            if (focusable.length === 0) return
            const first = focusable[0]
            const last = focusable[focusable.length - 1]
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault()
              last.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault()
              first.focus()
            }
          }}
          className={cn(
            'pointer-events-auto mb-0 flex h-[min(100dvh,680px)] w-full flex-col overflow-hidden rounded-t-3xl border border-subtle bg-main/95 shadow-2xl shadow-black/10 backdrop-blur-xl motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 md:mb-4 md:h-[min(560px,calc(100vh-8rem))] md:w-[400px] md:max-w-[calc(100vw-2rem)] md:rounded-3xl',
            classNames.panel,
          )}
        >
          <ChatHeader
            title={ui.title}
            canClear={messages.length > 0}
            onClear={clearChat}
            onClose={() => setIsOpen(false)}
            className={classNames.header}
            titleId={titleId}
          />

          <div
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
            aria-label="Assistant messages"
            className={cn(
              'flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-4',
              classNames.messages,
            )}
          >
            {messages.length === 0 ? (
              <ChatEmptyState
                title={ui.emptyTitle}
                description={ui.emptyDescription}
                className={classNames.emptyState}
              />
            ) : null}
            {messages.map((message, index) => (
              <ChatMessage
                key={message.id ?? `legacy-message-${index}`}
                message={message}
                devMode={devMode}
                className={classNames.message}
                userClassName={classNames.userMessage}
                assistantClassName={classNames.assistantMessage}
                markdownClassName={classNames.markdown}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>

          <ChatInput
            input={input}
            onInputChange={setInput}
            onSubmit={submitQuestion}
            onStop={stopStreaming}
            isLoading={isLoading}
            inputRef={inputRef}
            placeholder={ui.placeholder}
            hint={ui.composerHint}
            className={cn('px-3 pb-3', classNames.composer)}
            inputClassName={classNames.input}
          />
        </section>
      ) : null}

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open: boolean) => !open)}
        className={cn(
          'pointer-events-auto ml-auto flex size-14 cursor-pointer select-none items-center justify-center rounded-2xl bg-primary-500 text-white shadow-xl shadow-primary-500/25 transition-all hover:-translate-y-0.5 hover:bg-primary-600 hover:shadow-2xl active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-main motion-reduce:transform-none motion-reduce:transition-none',
          classNames.trigger,
        )}
        title={ui.buttonTooltip}
        aria-label={ui.buttonTooltip}
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        {isOpen ? (
          <CloseIcon size={21} strokeWidth={2.5} />
        ) : (
          <ChatIcon size={21} />
        )}
      </button>
    </div>
  )
}
