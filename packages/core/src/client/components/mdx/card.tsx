import { useState, useRef } from 'react'
import { cn } from '../../utils/cn'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: React.ReactNode
  icon?: React.ReactNode
  href?: string
}

export function Card({
  className,
  title,
  icon,
  href,
  children,
  ...props
}: CardProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [opacity, setOpacity] = useState(0)
  const cardRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  const handleMouseEnter = () => setOpacity(1)
  const handleMouseLeave = () => setOpacity(0)

  const Wrapper = href ? 'a' : 'div'
  const spotlightColor = 'var(--color-primary-500, #eb5828)'

  return (
    <Wrapper
      ref={cardRef}
      href={href}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'group relative flex flex-col gap-3 rounded-2xl border p-6 overflow-hidden transition-all duration-300',
        'hover:shadow-lg dark:hover:shadow-none hover:-translate-y-0.5',
        'bg-surface border-subtle text-paragraph',
        href && 'cursor-pointer',
        className,
      )}
      {...(props as any)}
    >
      {/* Background Spotlight */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, color-mix(in srgb, ${spotlightColor} 8%, transparent), transparent 40%)`,
        }}
      />
      {/* Border Spotlight Glow */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-300"
        style={{
          opacity,
          padding: '1px',
          background: `radial-gradient(400px circle at ${position.x}px ${position.y}px, color-mix(in srgb, ${spotlightColor} 50%, transparent), transparent 40%)`,
          WebkitMask:
            'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />

      {/* Header Content */}
      <div className="relative z-10 flex items-center gap-3">
        {icon && (
          <div
            className={cn(
              'shrink-0 transition-transform duration-500 group-hover:rotate-[15deg] group-hover:scale-110 flex items-center justify-center text-muted group-hover:text-primary-500',
              '[&>svg]:w-6 [&>svg]:h-6 [&>svg]:stroke-[1.5]',
            )}
          >
            {icon}
          </div>
        )}
        {title && (
          <h3 className="font-semibold text-base m-0 leading-none text-body">
            {title}
          </h3>
        )}
      </div>

      {/* Body Content */}
      <div className="relative z-10 text-[0.875rem] leading-[1.6] opacity-90 prose prose-neutral dark:prose-invert max-w-none [&>p]:m-0 [&>p+p]:mt-2">
        {children}
      </div>
    </Wrapper>
  )
}

export default Card
