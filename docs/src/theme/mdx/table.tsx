import { cn } from 'boltdocs/client'

const Table = (props: React.HTMLAttributes<HTMLTableElement>) => (
  <div className="my-8 w-full overflow-x-auto rounded-lg bg-surface">
    <table className="w-full border-collapse text-left text-sm" {...props} />
  </div>
)

const TableHead = (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={cn('px-5', props.className)} {...props} />
)

const TableBody = (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody {...props} />
)

const TableRow = (props: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr
    className={cn(
      'last:border-0 even:bg-soft/10 hover:bg-soft/20 transition-colors',
      props.className,
    )}
    {...props}
  />
)

const TableHeader = (props: React.HTMLAttributes<HTMLTableCellElement>) => (
  <th
    className={cn(
      ' py-5 px-5 font-mono font-semibold text-body text-xs uppercase tracking-wider',
      props.className,
    )}
    {...props}
  />
)

const TableCell = (props: React.HTMLAttributes<HTMLTableCellElement>) => (
  <td
    className={cn('py-3 px-5 text-paragraph leading-relaxed', props.className)}
    {...props}
  />
)

export const TableComponents = {
  table: Table,
  thead: TableHead,
  tbody: TableBody,
  tr: TableRow,
  th: TableHeader,
  td: TableCell,
}
