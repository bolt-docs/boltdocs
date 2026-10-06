import { cn } from '../../utils/cn'

export interface TableProps
  extends React.TableHTMLAttributes<HTMLTableElement> {
  wrapperClassName?: string
}

/**
 * Table, header, row, cell.
 *
 * Structural classes only. Every visual decision — the wrapper's hairline, the
 * zebra striping, the header's monospace caps, the cell padding — is in
 * `styles/components/table.css`, which means a theme can restyle a table without
 * this file changing and without knowing that `even:` or `last:` ever existed.
 */
const Table = ({ wrapperClassName, ...props }: TableProps) => (
  <div className={cn('bdocs-table', wrapperClassName)}>
    <table className="bdocs-table__table" {...props} />
  </div>
)

const TableHead = (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={cn('bdocs-table__head', props.className)} {...props} />
)

const TableBody = (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody {...props} />
)

const TableRow = (props: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={cn('bdocs-table__row', props.className)} {...props} />
)

const TableHeader = (props: React.HTMLAttributes<HTMLTableCellElement>) => (
  <th className={cn('bdocs-table__header', props.className)} {...props} />
)

const TableCell = (props: React.HTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn('bdocs-table__cell', props.className)} {...props} />
)

export { Table, TableHead, TableBody, TableRow, TableHeader, TableCell }
