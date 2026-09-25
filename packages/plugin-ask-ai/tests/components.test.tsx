// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useAskAiMock = vi.hoisted(() => vi.fn())

vi.mock('../src/client/use-ask-ai', () => ({
  useAskAi: useAskAiMock,
}))

const { AskAiBubble } = await import('../src/client/components/ask-ai-bubble')
const { AskAiDialog } = await import('../src/client/components/ask-ai-dialog')
const { ChatMessage } = await import('../src/client/components/chat-message')

function hookState(overrides: Record<string, unknown> = {}) {
  return {
    messages: [],
    input: '',
    setInput: vi.fn(),
    isLoading: false,
    submitQuestion: vi.fn(),
    stopStreaming: vi.fn(),
    clearChat: vi.fn(),
    isOpen: true,
    setIsOpen: vi.fn(),
    devMode: false,
    ui: {
      title: 'Ask Assistant',
      placeholder: 'Ask about this page…',
      emptyTitle: 'How can I help?',
      emptyDescription: 'Answers use the current page.',
      buttonTooltip: 'Open assistant',
      composerHint: 'Enter to send',
    },
    classNames: {
      root: 'custom-root',
      panel: 'custom-panel',
      trigger: 'custom-trigger',
      messages: 'custom-messages',
      header: 'custom-header',
      composer: 'custom-composer',
    },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  Element.prototype.scrollIntoView = vi.fn()
})

describe('Ask AI UI', () => {
  it('renders an accessible, customizable floating assistant', () => {
    useAskAiMock.mockReturnValue(hookState())
    render(<AskAiBubble />)

    expect(screen.getByRole('dialog', { name: 'Ask Assistant' })).toHaveClass(
      'custom-panel',
    )
    expect(
      screen.getByRole('button', { name: 'Open assistant' }),
    ).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('How can I help?')).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText('Ask about this page…'),
    ).toBeInTheDocument()
  })

  it('closes the floating assistant with Escape', () => {
    const setIsOpen = vi.fn()
    useAskAiMock.mockReturnValue(hookState({ setIsOpen }))
    render(<AskAiBubble />)

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(setIsOpen).toHaveBeenCalledWith(false)
  })

  it('applies class-name slots to the inline dialog variant', () => {
    useAskAiMock.mockReturnValue(hookState({ isOpen: true }))
    render(<AskAiDialog />)

    expect(screen.getByRole('complementary')).toHaveClass('custom-root')
    expect(screen.getByRole('log')).toHaveClass('custom-messages')
  })

  it('keeps partial streamed text visible after cancellation', () => {
    render(
      <ChatMessage
        devMode={false}
        message={{
          role: 'assistant',
          content: 'Partial answer',
          status: 'cancelled',
        }}
      />,
    )

    expect(screen.getByText('Partial answer')).toBeInTheDocument()
    expect(screen.getByText('Generation stopped.')).toBeInTheDocument()
  })
})
