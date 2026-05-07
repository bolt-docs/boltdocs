import { cn } from '../../utils/cn'
import { cva, type VariantProps } from 'class-variance-authority'

const fieldVariants = cva('group relative my-8 transition-all duration-300', {
  variants: {
    variant: {
      default: 'border-b border-subtle rounded-none py-6 last:border-b-0',
      bordered:
        'border border-subtle bg-transparent rounded-2xl p-6 hover:border-strong',
      card: 'border border-subtle bg-surface/40 p-6 rounded-2xl hover:bg-surface hover:shadow-xl hover:shadow-black/5 hover:-translate-y-0.5',
      ghost: 'border-none bg-transparent rounded-xl p-4 hover:bg-soft/20',
    },
  },
  defaultVariants: {
    variant: 'card',
  },
})

export interface FieldProps extends VariantProps<typeof fieldVariants> {
  name: string
  type?: string
  defaultValue?: string
  required?: boolean
  children: React.ReactNode
  id?: string
  className?: string
}

export function Field({
  name,
  type,
  defaultValue,
  required = false,
  children,
  id,
  variant,
  className = '',
}: FieldProps) {
  return (
    <article className={cn(fieldVariants({ variant }), className)} id={id}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <code className="inline-flex items-center rounded-lg bg-primary-500/10 px-3 py-1 font-mono text-sm font-bold text-primary-400 border border-primary-500/20 shadow-sm transition-colors group-hover:bg-primary-500/15">
            {name}
          </code>
          {type && (
            <span className="rounded-lg bg-soft/50 border border-subtle px-2.5 py-1 text-[11px] font-medium text-muted uppercase tracking-wider">
              {type}
            </span>
          )}
          {required && (
            <div className="flex items-center gap-2 rounded-full bg-danger-500/10 px-3 py-1 text-[10px] font-black uppercase text-danger-500 border border-danger-500/20 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-danger-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
              Required
            </div>
          )}
        </div>

        {defaultValue && (
          <div className="flex items-center gap-2 text-[11px] text-muted bg-soft/30 px-3 py-1 rounded-lg border border-subtle/40">
            <span className="font-bold opacity-40 uppercase tracking-widest text-[9px]">
              Default
            </span>
            <code className="font-mono text-muted group-hover:text-body transition-colors">
              {defaultValue}
            </code>
          </div>
        )}
      </div>

      <div className="text-[14px] text-muted leading-relaxed font-normal [&>p]:m-0 selection:bg-primary-500/30 group-hover:text-body transition-colors duration-300">
        {children}
      </div>
    </article>
  )
}
