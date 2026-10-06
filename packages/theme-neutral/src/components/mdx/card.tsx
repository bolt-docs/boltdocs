import { useRef, type ElementType } from 'react'
import { cn } from '../../utils/cn'

export interface CardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode
  icon?: React.ReactNode
  href?: string
  headerClassName?: string
  iconClassName?: string
  titleClassName?: string
  bodyClassName?: string
}

export function Card({
  className,
  title,
  icon,
  href,
  children,
  headerClassName,
  iconClassName,
  titleClassName,
  bodyClassName,
  ...props
}: CardProps) {
  const cardRef = useRef<HTMLDivElement | HTMLAnchorElement>(null)

  const handleMouseMove = (
    e: React.MouseEvent<HTMLDivElement | HTMLAnchorElement>,
  ) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    cardRef.current.style.setProperty('--mouse-x', `${x}px`)
    cardRef.current.style.setProperty('--mouse-y', `${y}px`)
  }

  const Wrapper: ElementType = href ? 'a' : 'div'
  const spotlightColor = 'var(--color-primary-500)'

  return (
    <Wrapper
      // @ts-expect-error
      ref={cardRef}
      href={href}
      onMouseMove={handleMouseMove}
      className={cn('bdocs-card', href && 'bdocs-card--linked', className)}
      {...(props as unknown as Record<string, unknown>)}
    >
      {/* Background Spotlight */}
      <div
        className="bdocs-card__spotlight"
        style={{
          background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), color-mix(in srgb, ${spotlightColor} 8%, transparent), transparent 40%)`,
        }}
      />
      {/* Border Spotlight Glow */}
      <div
        className="bdocs-card__glow"
        style={{
          padding: '1px',
          background: `radial-gradient(400px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), color-mix(in srgb, ${spotlightColor} 50%, transparent), transparent 40%)`,
          WebkitMask:
            'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />

      {/* Header Content */}
      <div className={cn('bdocs-card__header', headerClassName)}>
        {icon && (
          <div className={cn('bdocs-card__icon', iconClassName)}>{icon}</div>
        )}
        {title && (
          <h3 className={cn('bdocs-card__title', titleClassName)}>{title}</h3>
        )}
      </div>

      <div className={cn('bdocs-card__body', bodyClassName)}>{children}</div>
    </Wrapper>
  )
}

export default Card
