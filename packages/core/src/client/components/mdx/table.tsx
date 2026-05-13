import { cn } from '../../utils/cn'

const Table = (props: React.HTMLAttributes<HTMLTableElement>) => (
  <div className="my-6 w-full overflow-x-auto rounded-xl border border-subtle bg-surface/30">
    <table className="w-full border-collapse text-left text-sm" {...props} />
  </div>
)

const TableHead = (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead
    className={cn('border-b border-subtle bg-soft/50', props.className)}
    {...props}
  />
)

const TableBody = (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody {...props} />
)

const TableRow = (props: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr
    className={cn(
      'border-b border-subtle last:border-0 even:bg-soft/10 hover:bg-soft/20 transition-colors',
      props.className,
    )}
    {...props}
  />
)

const TableHeader = (props: React.HTMLAttributes<HTMLTableCellElement>) => (
  <th
    className={cn(
      'px-4 py-3 font-semibold text-body text-xs font-mono',
      props.className,
    )}
    {...props}
  />
)

const TableCell = (props: React.HTMLAttributes<HTMLTableCellElement>) => (
  <td
    className={cn('px-4 py-3 text-paragraph leading-relaxed', props.className)}
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
