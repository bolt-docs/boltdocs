import type { ReactNode } from 'react'

interface BenchmarkCardProps {
  children: ReactNode
}

export const BenchmarkCard = ({ children }: BenchmarkCardProps) => {
  return (
    <div className="flex flex-col justify-between p-8 rounded-3xl bg-surface/50 border border-subtle backdrop-blur-xl">
      {children}
    </div>
  )
}
