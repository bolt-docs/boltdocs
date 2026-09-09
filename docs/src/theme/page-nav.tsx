import { PageNav as PN } from 'boltdocs/primitives'
import { usePageNav } from 'boltdocs/client'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function PageNav() {
  const { prevPage, nextPage } = usePageNav()

  if (!prevPage && !nextPage) return null

  return (
    <PN.Root className="pt-8 mt-12 grid grid-cols-2 gap-4">
      {/* 1. Previous Page Direction */}
      {prevPage ? (
        <PN.Link
          to={prevPage.path}
          direction="prev"
          className="group p-5 rounded-xl flex flex-row gap-2 bg-surface hover:opacity-90 transition-colors"
        >
          <PN.Icon className="shrink-0 text-muted transition-transform group-hover:-translate-x-2 duration-300">
            <ChevronLeft size={20} />
          </PN.Icon>
          <div className="flex flex-col">
            <PN.Title className="text-xs font-medium text-muted group-hover:text-primary-500 transition-colors">
              Previous Chapter
            </PN.Title>
            <PN.Description className="text-sm font-semibold text-body mt-1">
              {prevPage.title}
            </PN.Description>
          </div>
        </PN.Link>
      ) : (
        <div /> // Column offset spacer
      )}

      {/* 2. Next Page Direction */}
      {nextPage ? (
        <PN.Link
          to={nextPage.path}
          direction="next"
          className="group p-5 rounded-xl flex flex-row gap-2 bg-surface hover:opacity-90 transition-colors"
        >
          <div className="flex flex-col">
            <PN.Title className="text-xs font-medium text-muted group-hover:text-primary-500 transition-colors">
              Next Chapter
            </PN.Title>
            <PN.Description className="text-sm font-semibold text-body mt-1">
              {nextPage.title}
            </PN.Description>
          </div>
          <PN.Icon className="shrink-0 text-muted transition-transform group-hover:translate-x-2 duration-300">
            <ChevronRight size={20} />
          </PN.Icon>
        </PN.Link>
      ) : (
        <div />
      )}
    </PN.Root>
  )
}
