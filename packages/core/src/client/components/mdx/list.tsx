import {
  Children,
  isValidElement,
  type ReactNode,
  type ReactElement,
  type ComponentPropsWithoutRef,
} from 'react'
import { Check, ChevronRight, Circle } from 'lucide-react'
import { cn } from '../../utils/cn'
import { cva, type VariantProps } from 'class-variance-authority'

const listVariants = cva('my-6 transition-all duration-200', {
  variants: {
    variant: {
      default: 'list-disc pl-5 text-muted marker:text-primary-500/50',
      number:
        'list-decimal pl-5 text-muted marker:text-primary-500/50 marker:font-bold',
      checked: 'list-none p-0',
      arrow: 'list-none p-0',
      bubble: 'list-none p-0',
    },
    cols: {
      1: 'grid-cols-1',
      2: 'grid-cols-1 sm:grid-cols-2',
      3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    },
    isGrid: {
      true: 'grid gap-x-8 gap-y-3',
      false: 'space-y-2',
    },
    dense: {
      true: 'space-y-1',
      false: 'space-y-2',
    },
  },
  compoundVariants: [
    {
      variant: 'default',
      dense: true,
      className: 'space-y-0.5',
    },
  ],
  defaultVariants: {
    variant: 'default',
    cols: 1,
    isGrid: false,
    dense: false,
  },
})

const itemVariants = cva(
  'group flex items-start gap-3 text-sm leading-relaxed transition-all duration-200',
  {
    variants: {
      variant: {
        default: '',
        number: '',
        checked: 'hover:translate-x-0.5',
        arrow: 'hover:translate-x-0.5',
        bubble: 'hover:translate-x-0.5',
      },
      dense: {
        true: 'py-0',
        false: 'py-0.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      dense: false,
    },
  },
)

const iconContainerVariants = cva(
  'mt-1 shrink-0 flex items-center justify-center transition-transform group-hover:scale-110',
  {
    variants: {
      variant: {
        bubble:
          'h-5 w-5 rounded-full bg-primary-500/10 text-primary-500 text-[10px] font-bold',
        default: '',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

type ListVariantProps = VariantProps<typeof listVariants>

export interface ListProps
  extends ComponentPropsWithoutRef<'ul'>,
    Omit<ListVariantProps, 'variant'> {
  variant?: 'checked' | 'arrow' | 'default' | 'bubble' | 'number'
  children: ReactNode
}

interface ListItemProps extends VariantProps<typeof itemVariants> {
  icon?: ReactNode
  children: ReactNode
}

function ListItem({ icon, children, variant, dense }: ListItemProps) {
  return (
    <li className={cn(itemVariants({ variant, dense }))}>
      {icon && (
        <span
          className={cn(
            iconContainerVariants({
              variant: variant === 'bubble' ? 'bubble' : 'default',
            }),
          )}
        >
          {icon}
        </span>
      )}
      <div className="flex-1 text-muted group-hover:text-body transition-colors">
        {children}
      </div>
    </li>
  )
}

const ICON_MAP: Record<string, (cls?: string) => ReactNode> = {
  checked: (cls) => (
    <Check size={14} className={cn('text-emerald-500 shrink-0', cls)} />
  ),
  arrow: (cls) => (
    <ChevronRight size={14} className={cn('text-primary-400 shrink-0', cls)} />
  ),
  bubble: (cls) => (
    <Circle
      size={6}
      fill="currentColor"
      className={cn('text-primary-500 shrink-0', cls)}
    />
  ),
  default: () => null,
  number: () => null,
}

export function List({
  variant = 'default',
  cols = 1,
  dense = false,
  children,
  className,
  ...props
}: ListProps) {
  const isGrid = cols !== undefined && Number(cols) > 1
  const renderIcon = ICON_MAP[variant]
  const containerClasses = listVariants({
    variant,
    cols,
    dense,
    isGrid,
    className,
  })

  const Component = variant === 'number' ? 'ol' : 'ul'

  // Handling raw MDX siblings (nested logic)
  if (variant === 'default' || variant === 'number') {
    return (
      <Component className={containerClasses} {...props}>
        {children}
      </Component>
    )
  }

  return (
    <ul className={containerClasses} {...props}>
      {Children.map(children, (child) => {
        if (!isValidElement(child)) return child

        const element = child as ReactElement<{ children?: ReactNode }>
        const content =
          element.type === 'li'
            ? element.props.children
            : element.props.children || child

        return (
          <ListItem icon={renderIcon()} variant={variant} dense={dense}>
            {content}
          </ListItem>
        )
      })}
    </ul>
  )
}
