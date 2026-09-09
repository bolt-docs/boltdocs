import { Button as ButtonPrimitive } from 'boltdocs/primitives'
import type { ButtonProps as PrimitiveButtonProps } from 'boltdocs/primitives'
import { cn } from 'boltdocs/client'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

/** Render props passed to the `className` function, mirroring React Aria. */
export interface ButtonRenderProps {
  isHovered: boolean
  isPressed: boolean
  isFocused: boolean
  isFocusVisible: boolean
  isDisabled: boolean
}

export interface ButtonProps extends Omit<PrimitiveButtonProps, 'className'> {
  /** Visual intent of the button. Defaults to 'primary'. */
  variant?: ButtonVariant
  /** Size of the button. Defaults to 'md'. */
  size?: ButtonSize
  /** Custom classes. String or render function for stateful theming. */
  className?: string | ((values: ButtonRenderProps) => string)
}

const base =
  'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium transition-colors duration-200 cursor-pointer outline-none disabled:pointer-events-none disabled:opacity-45 data-disabled:pointer-events-none data-disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2'

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary-500 text-white hover:bg-primary-600 data-pressed:bg-primary-700 focus-visible:outline-primary-500/70',
  secondary:
    'border border-subtle bg-surface text-body hover:bg-soft hover:border-strong data-pressed:bg-soft focus-visible:outline-primary-500/50',
  outline:
    'border border-subtle bg-transparent text-body hover:bg-surface hover:border-strong data-pressed:bg-surface focus-visible:outline-primary-500/50',
  ghost:
    'bg-transparent text-body hover:bg-surface data-pressed:bg-surface focus-visible:outline-primary-500/50',
  danger:
    'bg-danger-500 text-white hover:bg-danger-600 data-pressed:bg-danger-600 focus-visible:outline-danger-500/70',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-xs',
  md: 'h-9 gap-2 rounded-lg px-4 text-sm',
  lg: 'h-11 gap-2 rounded-xl px-5 text-sm',
  icon: 'size-9 rounded-lg p-0',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      {...props}
      className={
        typeof className === 'function'
          ? (values) =>
              cn(
                base,
                sizeClasses[size],
                variantClasses[variant],
                className(values),
              )
          : cn(base, sizeClasses[size], variantClasses[variant], className)
      }
    />
  )
}
