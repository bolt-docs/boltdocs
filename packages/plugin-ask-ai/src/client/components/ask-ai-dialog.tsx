import { useEffect, useId, useRef } from 'react'
import { cn } from '../cn'
import { useAskAi } from '../use-ask-ai'
import type { UseAskAiOptions } from '../use-ask-ai'
import { ChatEmptyState } from './chat-empty-state'
import { ChatHeader } from './chat-header'
import { ChatInput } from './chat-input'
import { ChatMessage } from './chat-message'

export interface AskAiDialogProps extends UseAskAiOptions {}

export function AskAiDialog(props: AskAiDialogProps = {}) {
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
  const titleId = useId()

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
    <aside
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setIsOpen(false)
      }}
      className={cn(
        'hidden w-[340px] shrink-0 flex-col overflow-hidden border-l border-subtle bg-main xl:flex',
        classNames.root,
      )}
    >
      <ChatHeader
        title={ui.title}
        variant="dialog"
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
          'flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4',
          classNames.messages,
        )}
      >
        {messages.length === 0 ? (
          <ChatEmptyState
            variant="dialog"
            title={ui.emptyTitle}
            description={ui.emptyDescription}
            className={classNames.emptyState}
          />
        ) : null}
        {messages.map((message, index) => (
          <ChatMessage
            key={message.id ?? `legacy-message-${index}`}
            message={message}
            variant="dialog"
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
        variant="dialog"
        input={input}
        onInputChange={setInput}
        onSubmit={submitQuestion}
        onStop={stopStreaming}
        isLoading={isLoading}
        inputRef={inputRef}
        placeholder={ui.placeholder}
        hint={ui.composerHint}
        className={cn('border-t border-subtle p-3', classNames.composer)}
        inputClassName={classNames.input}
      />
    </aside>
  )
}
