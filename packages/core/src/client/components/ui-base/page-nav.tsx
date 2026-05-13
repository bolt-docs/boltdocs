import { usePageNav } from '../../hooks/use-page-nav'
import { PageNav as PageNavPrimitive } from '../primitives/page-nav'

/**
 * Component to display the previous and next page navigation buttons.
 * Enhanced with subtle entrance animations, modern card layout, and hover highlights.
 */
export function PageNav() {
  const { prevPage, nextPage } = usePageNav()

  if (!prevPage && !nextPage) return null

  return (
    <PageNavPrimitive.Root className="mt-16 pt-8 border-t border-subtle grid sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 select-none">
      {prevPage ? (
        <PageNavPrimitive.Link
          to={prevPage.path}
          direction="prev"
          className="group border border-subtle bg-surface p-5 rounded-2xl transition-all duration-300 hover:border-primary-500/50 hover:bg-primary-50/20"
        >
          <PageNavPrimitive.Title className="text-xs font-bold uppercase tracking-wider text-muted/60 mb-1">
            Previous
          </PageNavPrimitive.Title>
          <PageNavPrimitive.Description className="text-sm sm:text-base font-bold text-body group-hover:text-primary-500 transition-colors">
            {prevPage.title}
          </PageNavPrimitive.Description>
        </PageNavPrimitive.Link>
      ) : (
        <div />
      )}

      {nextPage ? (
        <PageNavPrimitive.Link
          to={nextPage.path}
          direction="next"
          className="group border border-subtle bg-surface p-5 rounded-2xl transition-all duration-300 hover:border-primary-500/50 hover:bg-primary-50/20"
        >
          <PageNavPrimitive.Title className="text-xs font-bold uppercase tracking-wider text-muted/60 mb-1">
            Next
          </PageNavPrimitive.Title>
          <PageNavPrimitive.Description className="text-sm sm:text-base font-bold text-body group-hover:text-primary-500 transition-colors">
            {nextPage.title}
          </PageNavPrimitive.Description>
        </PageNavPrimitive.Link>
      ) : (
        <div />
      )}
    </PageNavPrimitive.Root>
  )
}
