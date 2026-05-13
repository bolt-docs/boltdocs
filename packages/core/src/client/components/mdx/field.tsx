export interface FieldProps {
  children?: React.ReactNode
  name: string
  type?: string
  description?: string
  required?: boolean
}

export const Field = ({
  children,
  name,
  type,
  description,
  required,
}: FieldProps) => (
  <div className="my-4 border border-subtle bg-surface/50 p-4 rounded-xl flex flex-col gap-1 text-sm select-none">
    <div className="flex items-center gap-2">
      <span className="font-mono font-bold text-primary-500">{name}</span>
      {type && (
        <span className="text-xs text-muted font-mono bg-soft px-1.5 py-0.5 rounded-md">
          {type}
        </span>
      )}
      {required && (
        <span className="text-xs text-rose-500 font-semibold">required</span>
      )}
    </div>
    {description && (
      <div className="text-muted text-xs mt-1">{description}</div>
    )}
    {children && <div className="mt-2">{children}</div>}
  </div>
)
