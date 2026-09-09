interface TypingIndicatorProps {
  label?: string
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-bounce"
      style={{ animationDelay: delay }}
    />
  )
}

export function TypingIndicator({ label = 'Waiting…' }: TypingIndicatorProps) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted">
      <span className="flex items-center gap-1">
        <Dot delay="0ms" />
        <Dot delay="120ms" />
        <Dot delay="240ms" />
      </span>
      {label}
    </span>
  )
}
