import { useState, useId, createContext, use } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../utils/cn'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'

const collapseVariants = cva(
  'overflow-hidden transition-all duration-300',
  {
    variants: {
      variant: {
        default: 'border-b border-subtle last:border-b-0 py-1',
        bordered: 'border border-subtle bg-transparent hover:border-strong rounded-xl mb-3',
        card: 'border border-subtle bg-surface shadow-xs hover:shadow-sm rounded-xl mb-3',
        ghost: 'border-none bg-transparent mb-1 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'card',
    },
  },
)


// Context for CollapseGroup (Accordion)
interface CollapseGroupContextType {
  openId: string | null
  toggleId: (id: string) => void
  accordion?: boolean
}

const CollapseGroupContext = createContext<CollapseGroupContextType | null>(null)

export interface CollapseGroupProps {
  children: React.ReactNode
  accordion?: boolean
  defaultOpenId?: string | null
  className?: string
}

export function CollapseGroup({
  children,
  accordion = false,
  defaultOpenId = null,
  className,
}: CollapseGroupProps) {
  const [openId, setOpenId] = useState<string | null>(defaultOpenId)

  const toggleId = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id))
  }

  return (
    <CollapseGroupContext.Provider value={{ openId, toggleId, accordion }}>
      <div className={cn('space-y-3 my-6', className)}>
        {children}
      </div>
    </CollapseGroupContext.Provider>
  )
}

export interface CollapseProps extends VariantProps<typeof collapseVariants> {
  id?: string
  title: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
  open?: boolean
  onChange?: (open: boolean) => void
  icon?: React.ReactNode
  className?: string
}

export function Collapse({
  id: providedId,
  title,
  children,
  defaultOpen = false,
  open: controlledOpen,
  onChange,
  variant,
  icon,
  className,
}: CollapseProps) {
  const generatedId = useId()
  const id = providedId || generatedId

  const groupContext = use(CollapseGroupContext)

  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)

  const accordion = groupContext?.accordion

  const isOpen = accordion
    ? groupContext.openId === id
    : controlledOpen !== undefined
      ? controlledOpen
      : uncontrolledOpen

  const handleToggle = () => {
    const nextOpen = !isOpen
    if (accordion) {
      groupContext.toggleId(id)
      onChange?.(nextOpen)
    } else {
      if (controlledOpen === undefined) {
        setUncontrolledOpen(nextOpen)
      }
      onChange?.(nextOpen)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      handleToggle()
    }
  }

  const headerClasses = cn(
    'flex items-center justify-between w-full px-4 py-3 text-left font-medium select-none cursor-pointer outline-none transition-all duration-200',
    'focus-visible:ring-2 focus-visible:ring-primary-500/30 rounded-lg',
    {
      'hover:bg-soft/30': variant === 'ghost',
      'hover:bg-soft/40': variant !== 'ghost',
      'text-primary-500': isOpen,
      'text-body hover:text-primary-500': !isOpen
    }
  )

  const contentClasses = cn(
    'grid transition-all duration-300 ease-[var(--ease-snappy,cubic-bezier(0.2,0,0,1))]',
    {
      'grid-rows-[1fr] opacity-100': isOpen,
      'grid-rows-[0fr] opacity-0': !isOpen
    }
  )

  return (
    <div className={collapseVariants({ variant, className })}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-controls={`collapse-content-${id}`}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={headerClasses}
      >
        <span className="flex items-center gap-3">
          {icon && <span className="text-muted shrink-0 [&>svg]:w-4 [&>svg]:h-4">{icon}</span>}
          <span className="text-sm font-semibold tracking-tight">{title}</span>
        </span>
        <span className={cn(
          'text-muted transition-transform duration-300 shrink-0 ml-4',
          isOpen && 'rotate-90 text-primary-500'
        )}>
          <ChevronRight size={16} />
        </span>
      </div>

      <div
        id={`collapse-content-${id}`}
        role="region"
        className={contentClasses}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-1.5 text-sm text-muted leading-relaxed">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
