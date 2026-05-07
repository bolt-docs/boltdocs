import { Inbox } from 'lucide-react'

export function FeatureEmpty({ label }: { label: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-2xl opacity-20 py-20 translate-y-4">
      <div className="p-4 rounded-full bg-white/5 mb-4">
        <Inbox className="size-8" />
      </div>
      <p className="text-xs font-bold uppercase tracking-widest text-center">
        No {label} posts
      </p>
    </div>
  )
}
