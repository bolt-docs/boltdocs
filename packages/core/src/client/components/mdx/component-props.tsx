import { cn } from '../../utils/cn'

export interface PropItem {
  name: string
  type: string
  defaultValue?: string
  required?: boolean
  description: React.ReactNode
}

export interface ComponentPropsProps {
  title?: string
  props: PropItem[]
  className?: string
}

export function ComponentProps({
  title,
  props,
  className = '',
}: ComponentPropsProps) {
  return (
    <div className={cn('my-6', className)}>
      {title && <h3 className="text-base font-bold text-body mb-3">{title}</h3>}
      <div className="overflow-x-auto rounded-lg border border-subtle">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="text-left px-4 py-3 border-b-2 border-subtle text-xs font-bold uppercase tracking-wider text-muted">
                Property
              </th>
              <th className="text-left px-4 py-3 border-b-2 border-subtle text-xs font-bold uppercase tracking-wider text-muted">
                Type
              </th>
              <th className="text-left px-4 py-3 border-b-2 border-subtle text-xs font-bold uppercase tracking-wider text-muted">
                Default
              </th>
              <th className="text-left px-4 py-3 border-b-2 border-subtle text-xs font-bold uppercase tracking-wider text-muted">
                Description
              </th>
            </tr>
          </thead>
          <tbody>
            {props.map((prop, index) => (
              <tr
                key={`${prop.name}-${index}`}
                className="transition-colors hover:bg-surface"
              >
                <td className="px-4 py-2.5 border-b border-subtle">
                  <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs font-bold text-primary-400">
                    {prop.name}
                  </code>
                  {prop.required && (
                    <span className="ml-1 text-red-400 font-bold">*</span>
                  )}
                </td>
                <td className="px-4 py-2.5 border-b border-subtle">
                  <code className="rounded bg-soft px-1.5 py-0.5 font-mono text-xs text-muted">
                    {prop.type}
                  </code>
                </td>
                <td className="px-4 py-2.5 border-b border-subtle">
                  {prop.defaultValue ? (
                    <code className="rounded bg-soft px-1.5 py-0.5 font-mono text-xs text-primary-400">
                      {prop.defaultValue}
                    </code>
                  ) : (
                    <span className="text-dim">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 border-b border-subtle text-muted">
                  {prop.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
