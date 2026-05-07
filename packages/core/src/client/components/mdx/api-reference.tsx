import { useState } from 'react'
import { Search, Copy, Check } from 'lucide-react'
import { cn } from '../../utils/cn'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'

const tableVariants = cva('my-8 transition-all duration-300', {
  variants: {
    variant: {
      default: 'border-none bg-transparent rounded-none p-0',
      bordered: 'border border-subtle bg-surface/10 rounded-2xl p-5 md:p-6',
      card: 'border border-subtle bg-surface rounded-2xl p-5 md:p-6',
      ghost: 'border-none bg-transparent rounded-2xl p-4',
    },
  },
  defaultVariants: {
    variant: 'card',
  },
})

export interface PropItem {
  name: string
  type: string
  defaultValue?: string
  required?: boolean
  description: React.ReactNode
}

export interface ApiReferenceProps extends VariantProps<typeof tableVariants> {
  title?: string
  props: PropItem[]
  searchable?: boolean
  className?: string
}

// Helper to parse union types into beautiful individual pills
function parseTypeToPills(typeStr: string) {
  // If it's a simple string union (e.g. "'sm' | 'md' | 'lg'" or "string | number")
  // and doesn't represent a complex function or object definition
  if (
    typeStr.includes('|') &&
    !typeStr.includes('=>') &&
    !typeStr.includes('{')
  ) {
    return (
      <div className="flex flex-wrap gap-1.5 max-w-full">
        {typeStr.split('|').map((t, idx) => {
          const cleanType = t.trim().replace(/^['"]|['"]$/g, '')
          return (
            <code
              key={`${cleanType}-${idx}`}
              className="inline-flex items-center rounded-md bg-soft/50 border border-subtle px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-muted transition-colors duration-200 shadow-3xs"
            >
              {cleanType}
            </code>
          )
        })}
      </div>
    )
  }
  return (
    <code className="inline-flex items-center rounded-md bg-soft/50 border border-subtle px-2 py-0.5 font-mono text-[11px] font-medium text-muted shadow-3xs">
      {typeStr}
    </code>
  )
}

export function ApiReference({
  title,
  props,
  searchable = false,
  variant,
  className = '',
}: ApiReferenceProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [copiedName, setCopiedName] = useState<string | null>(null)

  const handleCopy = (name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(name)
    setCopiedName(name)
    setTimeout(() => setCopiedName(null), 2000)
  }

  const filteredProps = props.filter(
    (prop) =>
      prop.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prop.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (typeof prop.description === 'string' &&
        prop.description.toLowerCase().includes(searchTerm.toLowerCase())),
  )

  return (
    <div className={cn(tableVariants({ variant }), className)}>
      <style>{`
        .api-ref-table tr:hover td {
          background-color: transparent !important;
        }
      `}</style>
      {/* Header section (Title & Search Bar) */}
      {(title || searchable) && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-5 pb-4 border-b border-subtle/50">
          {title ? (
            <h3 className="text-base font-bold text-body tracking-tight m-0!">
              {title}
            </h3>
          ) : (
            <div />
          )}

          {searchable && (
            <div className="relative w-full sm:w-64">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-dim">
                <Search size={14} className="stroke-2" />
              </span>
              <input
                type="text"
                placeholder="Search properties..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(
                  'w-full pl-9 pr-4 py-1.5 rounded-xl border border-subtle bg-surface/50 text-xs text-body placeholder-dim outline-none transition-all duration-200',
                  'hover:border-dim hover:bg-surface',
                  'focus:border-primary-500/50 focus:bg-main focus:ring-2 focus:ring-primary-500/10',
                )}
              />
            </div>
          )}
        </div>
      )}

      {filteredProps.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted">
          No matching properties found.
        </div>
      ) : (
        <>
          {/* Desktop Table Layout */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-subtle bg-main/50">
            <table className="w-full border-collapse text-sm api-ref-table">
              <thead>
                <tr className="border-b border-subtle bg-surface/20">
                  <th className="text-left px-4 py-3 text-sm font-semibold text-body">
                    Property
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-body">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-body">
                    Default
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-body">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle/50">
                {filteredProps.map((prop, index) => (
                  <tr
                    key={`${prop.name}-${index}`}
                    className="group/row transition-colors"
                  >
                    {/* Property Name */}
                    <td className="px-4 py-3.5 align-top">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <div className="relative flex items-center gap-1">
                          <code className="rounded-lg bg-primary-500/10 border border-primary-500/20 px-2 py-0.5 font-mono text-xs font-bold text-primary-400 transition-colors">
                            {prop.name}
                          </code>
                          <button
                            onClick={(e) => handleCopy(prop.name, e)}
                            className={cn(
                              'p-1 rounded-md text-dim hover:text-body hover:bg-soft/50 opacity-0 group-hover/row:opacity-100 transition-all duration-200 outline-none cursor-pointer',
                              copiedName === prop.name &&
                                'opacity-100 text-emerald-400',
                            )}
                            title="Copy property name"
                          >
                            {copiedName === prop.name ? (
                              <Check size={11} className="stroke-[2.5]" />
                            ) : (
                              <Copy size={11} className="stroke-[2.5]" />
                            )}
                          </button>
                        </div>
                        {prop.required && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-danger-500/10 border border-danger-500/20 px-1.5 py-0.5 text-[9px] font-medium text-danger-500 tracking-wider">
                            <span className="h-1 w-1 rounded-full bg-danger-500" />
                            Required
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3.5 align-top">
                      {parseTypeToPills(prop.type)}
                    </td>

                    {/* Default Value */}
                    <td className="px-4 py-3.5 align-top">
                      {prop.defaultValue ? (
                        <code className="rounded-lg bg-soft/30 border border-subtle/40 px-2 py-0.5 font-mono text-xs font-medium text-muted transition-colors duration-200">
                          {prop.defaultValue}
                        </code>
                      ) : (
                        <span className="text-dim/60 font-mono text-xs pl-2">
                          —
                        </span>
                      )}
                    </td>

                    {/* Description */}
                    <td className="px-4 py-3.5 align-top text-muted leading-relaxed transition-colors duration-200">
                      {prop.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout */}
          <div className="md:hidden flex flex-col gap-4">
            {filteredProps.map((prop, index) => (
              <div
                key={`${prop.name}-${index}-mobile`}
                className="group/card rounded-xl border border-subtle bg-surface/20 p-4 transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <code className="rounded-lg bg-primary-500/10 border border-primary-500/20 px-2 py-0.5 font-mono text-xs font-bold text-primary-400">
                      {prop.name}
                    </code>
                    <button
                      onClick={(e) => handleCopy(prop.name, e)}
                      className={cn(
                        'p-1 rounded-md text-dim hover:text-body hover:bg-soft/50 transition-all duration-200 outline-none cursor-pointer',
                        copiedName === prop.name && 'text-emerald-400',
                      )}
                    >
                      {copiedName === prop.name ? (
                        <Check size={11} className="stroke-[2.5]" />
                      ) : (
                        <Copy size={11} className="stroke-[2.5]" />
                      )}
                    </button>
                    {prop.required && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-danger-500/10 border border-danger-500/20 px-1.5 py-0.5 text-[8px] font-black uppercase text-danger-500 tracking-wider">
                        <span className="h-1 w-1 rounded-full bg-danger-500 animate-pulse" />
                        Required
                      </span>
                    )}
                  </div>

                  {prop.defaultValue && (
                    <div className="flex items-center gap-1.5 text-[10px] text-muted bg-soft/30 px-2 py-0.5 rounded-lg border border-subtle/40">
                      <span className="font-bold opacity-40 uppercase text-[8px]">
                        Default
                      </span>
                      <code className="font-mono text-muted">
                        {prop.defaultValue}
                      </code>
                    </div>
                  )}
                </div>

                <div className="mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-dim block mb-1">
                    Type
                  </span>
                  {parseTypeToPills(prop.type)}
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-dim block mb-1">
                    Description
                  </span>
                  <div className="text-xs text-muted leading-relaxed">
                    {prop.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
