import type { MouseEvent as ReactMouseEvent } from 'react'
import { useCallback, useRef } from 'react'
import * as RAC from 'react-aria-components'
import { cn } from '../../utils/cn'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'

const cardsVariants = cva('grid gap-4 my-6', {
  variants: {
    cols: {
      1: 'grid-cols-1',
      2: 'grid-cols-1 sm:grid-cols-2',
      3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    },
  },
  defaultVariants: {
    cols: 3,
  },
})
type CardsVariants = VariantProps<typeof cardsVariants>

export interface CardsProps
  extends React.HTMLAttributes<HTMLDivElement>,
    CardsVariants {}

export function Cards({
  cols = 3,
  children,
  className = '',
  ...rest
}: CardsProps) {
  return (
    <div className={cn(cardsVariants({ cols }), className)} {...rest}>
      {children}
    </div>
  )
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  icon?: React.ReactNode
  href?: string
  children?: React.ReactNode
}

export function Card({
  title,
  icon,
  href,
  children,
  className = '',
  ...rest
}: CardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const linkRef = useRef<HTMLAnchorElement>(null)

  const handleMouseMove = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    const el = cardRef.current || linkRef.current
    if (!el) return
    const { left, top } = el.getBoundingClientRect()
    el.style.setProperty('--x', `${e.clientX - left}px`)
    el.style.setProperty('--y', `${e.clientY - top}px`)
  }, [])

  const inner = (
    <>
      <div
        className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(400px circle at var(--x) var(--y), color-mix(in oklch, var(--color-primary-500), transparent 90%), transparent 80%)',
        }}
      />
      {icon && (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/10 text-primary-400 text-lg transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3">
          {icon}
        </div>
      )}
      <div className="space-y-1.5">
        {title && <h3 className="text-sm font-bold text-body">{title}</h3>}
        {children && (
          <div className="text-sm text-muted leading-relaxed">
            {children}
          </div>
        )}
      </div>
    </>
  )

  const cardClasses = cn(
    'group relative block rounded-xl border border-subtle bg-surface p-5 outline-none overflow-hidden',
    'transition-all duration-200 hover:border-primary-500/40 hover:shadow-lg hover:shadow-primary-500/5',
    'focus-visible:ring-2 focus-visible:ring-primary-500/30',
    className,
  )

  if (href) {
    return (
      <RAC.Link
        ref={linkRef}
        href={href}
        className={cn(cardClasses, 'no-underline cursor-pointer')}
        onMouseMove={handleMouseMove}
        {...(rest as any)}
      >
        {inner}
      </RAC.Link>
    )
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: spotlight effect is decorative
    <div
      ref={cardRef}
      role="presentation"
      className={cardClasses}
      onMouseMove={handleMouseMove}
      {...rest}
    >
      {inner}
    </div>
  )
}
