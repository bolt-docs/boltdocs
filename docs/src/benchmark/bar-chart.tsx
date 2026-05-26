interface BarItem {
  label: string
  value: string
  width: number
  color: string
  labelColor?: string
}

interface BarChartProps {
  items: BarItem[]
}

export const BarChart = ({ items }: BarChartProps) => {
  return (
    <div className="space-y-5 my-6">
      {items.map((item, i) => (
        <div key={i}>
          <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-body/60 mb-1.5">
            <span>{item.label}</span>
            <span className={item.labelColor || 'text-body/60'}>
              {item.value}
            </span>
          </div>
          <div className="h-3 w-full bg-soft rounded-full overflow-hidden border border-subtle">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${item.color}`}
              style={{ width: `${item.width}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
