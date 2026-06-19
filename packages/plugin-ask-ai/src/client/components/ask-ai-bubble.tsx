import { useRef, useEffect } from "react";
import { useAskAi } from "../use-ask-ai";

function renderMarkdown(text: string) {
  if (!text) return null;
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((part, index) => {
    if (part.startsWith("```")) {
      const match = part.match(/```(\w*)\n([\s\S]*?)```/);
      const language = match ? match[1] : "";
      const code = match ? match[2].trim() : part.slice(3, -3).trim();
      return (
        <pre
          key={index}
          className="p-3 my-2 overflow-x-auto rounded-lg bg-surface border border-subtle text-xs font-mono text-body"
        >
          {language && (
            <div className="text-[10px] text-muted uppercase font-bold tracking-widest mb-1.5 border-b border-subtle pb-1">
              {language}
            </div>
          )}
          <code>{code}</code>
        </pre>
      );
    }

    const lines = part.split("\n").filter(Boolean);
    return lines.map((line, lineIndex) => {
      const inlineParts = line.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
      const content = inlineParts.map((subPart, subIndex) => {
        if (subPart.startsWith("`") && subPart.endsWith("`")) {
          return (
            <code
              key={subIndex}
              className="px-1.5 py-0.5 rounded-md bg-surface border border-subtle text-xs font-mono text-primary-500"
            >
              {subPart.slice(1, -1)}
            </code>
          );
        }
        if (subPart.startsWith("**") && subPart.endsWith("**")) {
          return (
            <strong key={subIndex} className="font-semibold text-body">
              {subPart.slice(2, -2)}
            </strong>
          );
        }
        return subPart;
      });

      return (
        <p
          key={`${index}-${lineIndex}`}
          className="mb-2 text-sm text-body/90 leading-relaxed last:mb-0"
        >
          {content}
        </p>
      );
    });
  });
}

export function AskAiBubble() {
  const {
    messages,
    input,
    setInput,
    isLoading,
    submitQuestion,
    clearChat,
    isOpen,
    setIsOpen,
    isDebug,
  } = useAskAi();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    submitQuestion(input);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 w-[380px] max-w-[calc(100vw-2rem)] h-[500px] bg-main/90 backdrop-blur-md border border-subtle rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="px-4 py-3 border-b border-subtle flex items-center justify-between bg-surface/50">
            <div className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary-500"
              >
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
              </svg>
              <span className="text-sm font-semibold text-body">
                Ask Assistant
              </span>
              {isDebug && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  Ollama DEV
                </span>
              )}
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
                    width="14"
                    height="14"
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
                  width="16"
                  height="16"
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

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                <div className="w-12 h-12 rounded-full bg-primary-500/10 flex items-center justify-center text-primary-500 mb-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
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
                <h3 className="text-sm font-semibold text-body mb-1">
                  How can I help you today?
                </h3>
                <p className="text-xs text-muted max-w-[240px]">
                  Ask questions about the documentation. The AI will find and
                  summarize the answers for you.
                </p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col max-w-[85%] ${
                    msg.role === "user"
                      ? "align-self-end items-end ml-auto"
                      : "align-self-start items-start"
                  }`}
                >
                  <div
                    className={`px-3 py-2 rounded-xl text-sm ${
                      msg.role === "user"
                        ? "bg-primary-500 text-white rounded-br-none"
                        : "bg-surface border border-subtle text-body rounded-bl-none"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      renderMarkdown(msg.content)
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Typing indicator */}
            {isLoading &&
              messages.length > 0 &&
              messages[messages.length - 1].content === "" && (
                <div className="align-self-start items-start max-w-[85%]">
                  <div className="bg-surface border border-subtle px-4 py-3 rounded-xl rounded-bl-none flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-muted animate-bounce" />
                    <span className="w-2 h-2 rounded-full bg-muted animate-bounce [animation-delay:0.2s]" />
                    <span className="w-2 h-2 rounded-full bg-muted animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form
            onSubmit={handleSubmit}
            className="p-3 border-t border-subtle bg-surface/30 flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask documentation..."
              className="flex-1 bg-surface border border-subtle rounded-xl px-3 py-1.5 text-sm outline-none text-body focus-visible:border-primary-500 transition-colors"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl flex items-center justify-center transition-colors cursor-pointer select-none"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
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
          </form>
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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        ) : (
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
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>
    </div>
  );
}
