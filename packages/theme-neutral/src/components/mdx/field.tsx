import { cn } from '../../utils/cn'

export interface FieldProps {
  children?: React.ReactNode
  name: string
  type?: string
  description?: string
  required?: boolean
  className?: string
}

export const Field = ({
  children,
  name,
  type,
  description,
  required,
  className,
}: FieldProps) => (
  <div className={cn('bdocs-field', className)}>
    <div className="bdocs-field__row">
      <span className="bdocs-field__name">{name}</span>
      {type && <span className="bdocs-field__type">{type}</span>}
      {required && <span className="bdocs-field__required">required</span>}
    </div>
    {description && (
      <div className="bdocs-field__description">{description}</div>
    )}
    {children && <div className="bdocs-field__body">{children}</div>}
  </div>
)
