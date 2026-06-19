import { useEffect, useRef } from "react";
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

export function AskAiDialog() {
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [messages, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    submitQuestion(input);
  };

  const handleClose = () => {
    setIsOpen(false)
    window.dispatchEvent(new CustomEvent('boltdocs:ask-ai:close'))
  }

  const handleOpen = () => {
    setIsOpen(true)
    window.dispatchEvent(new CustomEvent('boltdocs:ask-ai:open'))
  }

  return (
    <nav className="sticky top-navbar hidden xl:flex flex-col shrink-0 w-toc py-4 pl-6 pr-4">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
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
            <span className="text-xs font-bold text-body">
              {isOpen ? "AI Assistant" : "Ask AI"}
            </span>
            {isDebug && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                Ollama DEV
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isOpen && messages.length > 0 && (
              <button
                onClick={clearChat}
                className="p-1 text-muted hover:text-red-500 hover:bg-surface rounded-lg transition-colors cursor-pointer"
                title="Clear chat"
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
            {isOpen && (
              <button
                onClick={handleClose}
                className="p-1 text-muted hover:text-body hover:bg-surface rounded-lg transition-colors cursor-pointer"
                title="Close assistant"
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
            )}
            {!isOpen && (
              <button
                onClick={handleOpen}
                className="p-1 text-muted hover:text-primary-500 hover:bg-primary-500/10 rounded-lg transition-colors cursor-pointer"
                title="Open AI assistant"
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
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                  <path d="M15 12H9" />
                  <path d="M12 9v6" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {!isOpen ? (
          <button
            onClick={handleOpen}
            className="flex flex-col items-center justify-center flex-1 rounded-xl border-2 border-dashed border-subtle hover:border-primary-500/50 text-muted hover:text-primary-500 transition-all cursor-pointer p-4 gap-2 group"
          >
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
              className="group-hover:scale-110 transition-transform"
            >
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            </svg>
            <span className="text-xs font-semibold">Ask AI</span>
          </button>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
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
                    Ask anything about the documentation
                  </p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col max-w-full ${
                    msg.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`px-3 py-2 rounded-xl text-xs ${
                      msg.role === "user"
                        ? "bg-primary-500 text-white rounded-br-none max-w-[90%]"
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
              ))}

              {/* Loading */}
              {isLoading &&
                messages.length > 0 &&
                messages[messages.length - 1].content === "" && (
                  <div className="flex gap-1 items-center p-3 bg-surface border border-subtle rounded-xl self-start">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:0.4s]" />
                  </div>
                )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="mt-3 pt-3 border-t border-subtle flex gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask AI..."
                className="flex-1 bg-surface border border-subtle rounded-lg px-2.5 py-1.5 text-xs outline-none text-body focus-within:border-primary-500 transition-colors min-w-0"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="px-2.5 py-1.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center justify-center transition-colors cursor-pointer shrink-0"
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
            </form>
          </div>
        )}
      </div>
    </nav>
  );
}
