import { usePageNav } from '../../hooks/use-page-nav'
import { PageNav as PageNavPrimitive } from '../composition/page-nav'
import { ChevronLeft, ChevronRight } from './icons'

/**
 * Previous and next page navigation.
 *
 * Styling lives in `styles/components/page-nav.css`, not in utility classes
 * here. The primitives carry `bdocs-page-nav*` and `data-direction`; this layer
 * only supplies content and the caller override.
 */
export function PageNav({ className }: { className?: string }) {
  const { prevPage, nextPage } = usePageNav()

  if (!prevPage && !nextPage) return null

  return (
    <PageNavPrimitive.Root className={className}>
      {prevPage ? (
        <PageNavPrimitive.Link to={prevPage.path} direction="prev">
          <PageNavPrimitive.Icon>
            <ChevronLeft />
          </PageNavPrimitive.Icon>
          <PageNavPrimitive.Body>
            <PageNavPrimitive.Title>Previous</PageNavPrimitive.Title>
            <PageNavPrimitive.Description>
              {prevPage.title}
            </PageNavPrimitive.Description>
          </PageNavPrimitive.Body>
        </PageNavPrimitive.Link>
      ) : (
        <div />
      )}

      {nextPage ? (
        <PageNavPrimitive.Link to={nextPage.path} direction="next">
          <PageNavPrimitive.Body>
            <PageNavPrimitive.Title>Next</PageNavPrimitive.Title>
            <PageNavPrimitive.Description>
              {nextPage.title}
            </PageNavPrimitive.Description>
          </PageNavPrimitive.Body>
          <PageNavPrimitive.Icon>
            <ChevronRight />
          </PageNavPrimitive.Icon>
        </PageNavPrimitive.Link>
      ) : (
        <div />
      )}
    </PageNavPrimitive.Root>
  )
}
