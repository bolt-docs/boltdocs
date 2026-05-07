import * as RAC from 'react-aria-components'
import { useTable } from './hooks/useTable'
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import { cn } from '../../utils/cn'
import { cva, type VariantProps } from 'class-variance-authority'

const tableVariants = cva(
  'my-6 overflow-hidden transition-all duration-300',
  {
    variants: {
      variant: {
        default: 'border-none rounded-none',
        bordered: 'border border-subtle rounded-xl',
        card: 'border border-subtle bg-surface shadow-xs hover:shadow-sm rounded-xl',
        ghost: 'border-none bg-transparent rounded-xl'
      }
    },
    defaultVariants: {
      variant: 'card'
    }
  }
)

export interface TableProps extends VariantProps<typeof tableVariants> {
  headers?: string[]
  data?: (string | React.ReactNode)[][]
  children?: React.ReactNode
  className?: string
  sortable?: boolean
  paginated?: boolean
  pageSize?: number
}

export function Table({
  headers,
  data,
  children,
  className = '',
  sortable = false,
  paginated = false,
  pageSize = 10,
  variant,
}: TableProps) {
  const {
    sortConfig,
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedData,
    requestSort,
  } = useTable({
    data,
    sortable,
    paginated,
    pageSize,
  })

  const renderSortIcon = (index: number) => {
    if (!sortable) return null
    if (sortConfig?.key !== index)
      return <ChevronDown size={14} className="ml-1 opacity-30" />
    return sortConfig.direction === 'asc' ? (
      <ChevronUp size={14} className="ml-1 text-primary-400" />
    ) : (
      <ChevronDown size={14} className="ml-1 text-primary-400" />
    )
  }

  const tableContent = children ? (
    children
  ) : (
    <>
      {headers && (
        <thead>
          <tr>
            {headers.map((header, i) => (
              <th
                key={i}
                onClick={() => requestSort(i)}
                className={cn(
                  'text-left px-3 py-2.5 border-b-2 border-subtle text-body font-semibold text-sm',
                  sortable &&
                  'cursor-pointer select-none hover:text-primary-400 transition-colors',
                )}
              >
                <div className="flex items-center">
                  {header}
                  {renderSortIcon(i)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
      )}
      {paginatedData && (
        <tbody>
          {paginatedData.map((row, i) => (
            <tr key={i} className="transition-colors hover:bg-surface">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="px-3 py-2 border-b border-subtle text-sm text-muted"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      )}
    </>
  )

  return (
    <div
      className={cn(
        tableVariants({ variant }),
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">{tableContent}</table>
      </div>

      {paginated && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-subtle px-4 py-3">
          <span className="text-xs text-muted">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <RAC.Button
              onPress={() => setCurrentPage(1)}
              isDisabled={currentPage === 1}
              className="grid place-items-center h-7 w-7 rounded-md text-muted outline-none transition-colors hover:bg-surface disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronsLeft size={16} />
            </RAC.Button>
            <RAC.Button
              onPress={() =>
                setCurrentPage((prev: number) => Math.max(prev - 1, 1))
              }
              isDisabled={currentPage === 1}
              className="grid place-items-center h-7 w-7 rounded-md text-muted outline-none transition-colors hover:bg-surface disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronLeft size={16} />
            </RAC.Button>
            <RAC.Button
              onPress={() =>
                setCurrentPage((prev: number) => Math.min(prev + 1, totalPages))
              }
              isDisabled={currentPage === totalPages}
              className="grid place-items-center h-7 w-7 rounded-md text-muted outline-none transition-colors hover:bg-surface disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronRight size={16} />
            </RAC.Button>
            <RAC.Button
              onPress={() => setCurrentPage(totalPages)}
              isDisabled={currentPage === totalPages}
              className="grid place-items-center h-7 w-7 rounded-md text-muted outline-none transition-colors hover:bg-surface disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronsRight size={16} />
            </RAC.Button>
          </div>
        </div>
      )}
    </div>
  )
}
