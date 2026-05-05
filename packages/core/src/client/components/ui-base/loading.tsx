import { cn } from '../../utils/cn'
import { Skeleton } from '../primitives/skeleton'

/**
 * A premium loading component that only skeletons the markdown content area.
 * Designed to be used as a Suspense fallback within a persistent layout.
 */
export function Loading() {
  return (
    <div
      className={cn(
        'w-full h-full relative overflow-y-auto transition-opacity duration-300 animate-fade-in',
      )}
    >
      <div className="mx-auto max-w-(--spacing-content-max) px-4 py-8 space-y-10">
        {/* Breadcrumbs */}
        <div className="flex gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>

        {/* Page Title */}
        <Skeleton className="h-10 w-[60%] sm:h-12" />

        {/* Intro Paragraph */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[95%]" />
          <Skeleton className="h-4 w-[40%]" />
        </div>

        {/* Section 1 */}
        <div className="space-y-6 pt-4">
          <Skeleton className="h-7 w-32" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[98%]" />
            <Skeleton className="h-4 w-[92%]" />
            <Skeleton className="h-4 w-[60%]" />
          </div>
        </div>

        {/* Code Block Placeholder */}
        <Skeleton className="h-32 w-full rounded-lg bg-soft/50" />

        {/* Section 2 */}
        <div className="space-y-6 pt-4">
          <Skeleton className="h-7 w-48" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[85%]" />
          </div>
        </div>
      </div>
    </div>
  )
}
