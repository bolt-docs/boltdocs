import { usePageNav } from '../../hooks/use-page-nav'
import { PageNav as PageNavPrimitive } from '../primitives/page-nav'
import { ChevronLeft, ChevronRight } from './icons'

/**
 * Previous and next page navigation.
 *
 * Styling lives in `styles/components/page-nav.css` under a `bdocs-` prefix, not
 * in utility classes here. `className` still works and is appended last, so a site
 * can override any single piece without restating the rest.
 */
export function PageNav({ className }: { className?: string }) {
  const { prevPage, nextPage } = usePageNav()

  if (!prevPage && !nextPage) return null

  const card = 'bdocs-page-nav__card'

  return (
    <PageNavPrimitive.Root
      className={`bdocs-page-nav${className ? ` ${className}` : ''}`}
    >
      {prevPage ? (
        <PageNavPrimitive.Link
          to={prevPage.path}
          direction="prev"
          className={`${card} bdocs-page-nav__card--prev`}
        >
          <PageNavPrimitive.Icon className="bdocs-page-nav__icon">
            <ChevronLeft />
          </PageNavPrimitive.Icon>
          <div className="bdocs-page-nav__body">
            <PageNavPrimitive.Title className="bdocs-page-nav__title">
              Previous
            </PageNavPrimitive.Title>
            <PageNavPrimitive.Description className="bdocs-page-nav__label">
              {prevPage.title}
            </PageNavPrimitive.Description>
          </div>
        </PageNavPrimitive.Link>
      ) : (
        <div />
      )}

      {nextPage ? (
        <PageNavPrimitive.Link
          to={nextPage.path}
          direction="next"
          className={`${card} bdocs-page-nav__card--next`}
        >
          <div className="bdocs-page-nav__body">
            <PageNavPrimitive.Title className="bdocs-page-nav__title">
              Next
            </PageNavPrimitive.Title>
            <PageNavPrimitive.Description className="bdocs-page-nav__label">
              {nextPage.title}
            </PageNavPrimitive.Description>
          </div>
          <PageNavPrimitive.Icon className="bdocs-page-nav__icon">
            <ChevronRight />
          </PageNavPrimitive.Icon>
        </PageNavPrimitive.Link>
      ) : (
        <div />
      )}
    </PageNavPrimitive.Root>
  )
}
