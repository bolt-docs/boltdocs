import * as RAC from 'react-aria-components'
import { cn } from '../../utils/cn'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'

export const buttonVariants = cva(
  'flex flex-row items-center justify-center w-auto font-semibold tracking-tight no-underline whitespace-nowrap select-none outline-none transition-all duration-200 cursor-pointer pressed:scale-[0.97] hover:-translate-y-px leading-none',
  {
    variants: {
      variant: {
        primary:
          'bg-primary-500 text-white shadow-md hover:brightness-110 hover:shadow-lg',
        secondary:
          'bg-surface text-body border border-subtle hover:bg-soft hover:border-strong',
        outline:
          'bg-transparent text-body border border-strong hover:bg-surface hover:border-primary-500',
        ghost:
          'bg-transparent text-muted hover:bg-surface hover:text-body',
        danger:
          'bg-[var(--color-danger-500)]/10 text-[var(--color-danger-500)] border border-[var(--color-danger-500)]/20 hover:bg-[var(--color-danger-500)]/15',
        success:
          'bg-[var(--color-success-500)]/10 text-[var(--color-success-500)] border border-[var(--color-success-500)]/20 hover:bg-[var(--color-success-500)]/15',
        warning:
          'bg-[var(--color-warning-500)]/10 text-[var(--color-warning-500)] border border-[var(--color-warning-500)]/20 hover:bg-[var(--color-warning-500)]/15',
        info: 'bg-[var(--color-info-500)]/10 text-[var(--color-info-500)] border border-[var(--color-info-500)]/20 hover:bg-[var(--color-info-500)]/15',
        subtle: 'bg-primary-500/10 text-primary-500 hover:bg-primary-500/20',
        link: 'bg-transparent text-primary-500 !p-0 !min-h-0 hover:underline',
      },
      size: {
        sm: 'min-h-8 px-3.5 text-[0.8125rem] gap-1.5',
        md: 'min-h-10 px-5 text-[0.9375rem] gap-2',
        lg: 'min-h-12 px-7 text-[1.05rem] gap-2.5',
      },
      rounded: {
        none: 'rounded-none',
        sm: 'rounded-sm',
        md: 'rounded-md',
        lg: 'rounded-lg',
        full: 'rounded-full',
      },
      iconSize: {
        sm: 'w-8 h-8 p-0',
        md: 'w-10 h-10 p-0',
        lg: 'w-12 h-12 p-0',
      },
      disabled: {
        true: 'opacity-50 cursor-not-allowed pointer-events-none',
        false: null,
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      rounded: 'md',
    },
  },
)
type ButtonVariantType = VariantProps<typeof buttonVariants>

export interface ButtonProps
  extends Omit<RAC.ButtonProps, 'children' | 'className'>,
    ButtonVariantType {
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
  href?: string
  children?: React.ReactNode
  className?: string
  isIconOnly?: boolean
}

export const Button = ({
  href,
  icon,
  iconPosition = 'left',
  isIconOnly,
  children,
  className,
  variant,
  size,
  rounded,
  iconSize,
  disabled,
  ...props
}: ButtonProps) => {
  const isOnlyIcon = isIconOnly || (!children && !!icon)

  const content = isOnlyIcon ? (
    <span className="inline-flex items-center justify-center [&>svg]:w-[1.2rem] [&>svg]:h-[1.2rem]">
      {icon}
    </span>
  ) : (
    <>
      {icon && iconPosition === 'left' && (
        <span className="inline-flex items-center shrink-0 [&>svg]:w-[1.1rem] [&>svg]:h-[1.1rem]">
          {icon}
        </span>
      )}
      <span className="flex items-center">{children}</span>
      {icon && iconPosition === 'right' && (
        <span className="inline-flex items-center shrink-0 [&>svg]:w-[1.1rem] [&>svg]:h-[1.1rem]">
          {icon}
        </span>
      )}
    </>
  )

  if (href) {
    return (
      <RAC.Link
        href={href}
        className={cn(
          buttonVariants({
            variant,
            size,
            rounded,
            iconSize: isOnlyIcon ? iconSize : undefined,
            disabled,
          }),
          className,
        )}
        {...(props as RAC.LinkProps)}
      >
        {content}
      </RAC.Link>
    )
  }

  return (
    <RAC.Button
      className={cn(
        buttonVariants({
          variant,
          size,
          rounded,
          iconSize: isOnlyIcon ? iconSize : undefined,
          disabled,
        }),
        className,
      )}
      {...(props as RAC.ButtonProps)}
    >
      {content}
    </RAC.Button>
  )
}
