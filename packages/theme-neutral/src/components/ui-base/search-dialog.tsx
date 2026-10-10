import { Search, X } from './icons'
import { useId } from 'react'
import { useSearch } from '../../hooks/use-search'
import { createSearchHighlightRegex } from '../../hooks/use-search-highlight'
import { SearchDialog as SearchDialogPrimitive } from '../composition/search-dialog'
import Navbar from '../composition/navbar'
import type { ComponentRoute } from '@bdocs/runtime'
import { InternalErrorBoundary as ErrorBoundary } from '../internal/error-boundary'
import { cn } from '../../utils/cn'

interface SearchResult {
  id: string
  title: string
  path: string
  bio: string
  groupTitle?: string
  isHeading?: boolean
  snippet?: string
}

/**
 * The matched run inside a result title or snippet.
 *
 * A class rather than an inline style, and `mark` rather than a `span`: the
 * element is already semantic, the browser's default colour is the only thing
 * wrong with it, and a site that restyles the match should restyle it in one
 * place.
 */
export function SearchResultHighlight({
  text,
  query,
  markClassName,
}: {
  text: string
  query: string
  markClassName?: string
}) {
  if (!query.trim() || !text) return <>{text}</>
  const regex = createSearchHighlightRegex(query.split(/\s+/))
  if (!regex) return <>{text}</>
  const parts = text.split(regex)

  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <mark
            key={`${part}-${index}`}
            className={cn('bdocs-search-mark', markClassName)}
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  )
}

export function SearchDialog({
  routes,
  className,
  markClassName,
}: {
  routes: ComponentRoute[]
  className?: string
  markClassName?: string
}) {
  const {
    isOpen,
    setIsOpen,
    query,
    setQuery,
    list,
    status,
    isLoading,
    error,
    handleSelect,
  } = useSearch(routes)
  const statusId = useId()
  const statusMessage =
    status === 'loading'
      ? 'Loading search index…'
      : status === 'indexing'
        ? 'Preparing search…'
        : status === 'searching'
          ? 'Searching…'
          : status === 'error'
            ? 'Search is temporarily unavailable.'
            : query.trim()
              ? `${list.length} result${list.length === 1 ? '' : 's'} found.`
              : `${list.length} suggested page${list.length === 1 ? '' : 's'}.`

  return (
    <>
      <Navbar.SearchTrigger.Desktop
        aria-label="Search docs"
        aria-keyshortcuts="Control+K Meta+K"
        onPress={() => setIsOpen(true)}
        className="bdocs-search-trigger"
      >
        <div className="bdocs-search-trigger__label">
          <Search size={16} />
          {/* paragraph (not muted): the hint text on the trigger background
              must meet 4.5:1 contrast (axe `color-contrast`). */}
          <span className="bdocs-search-trigger__hint">Search docs...</span>
        </div>
        <Navbar.SearchTrigger.Kbd className="bdocs-search-trigger__kbd" />
      </Navbar.SearchTrigger.Desktop>

      <Navbar.SearchTrigger.Mobile
        aria-label="Search docs"
        onPress={() => setIsOpen(true)}
        className="bdocs-search-trigger bdocs-search-trigger--icon"
      >
        <Search size={20} />
      </Navbar.SearchTrigger.Mobile>

      <ErrorBoundary>
        <SearchDialogPrimitive.Overlay
          isOpen={isOpen}
          isDismissable
          onOpenChange={setIsOpen}
          className={cn('bdocs-search-overlay', className)}
        >
          <SearchDialogPrimitive.Content className="bdocs-search-panel">
            <SearchDialogPrimitive.Dialog
              aria-label="Search documentation"
              aria-describedby={statusId}
              aria-busy={isLoading}
              className="bdocs-search-dialog"
            >
              <SearchDialogPrimitive.Autocomplete className="bdocs-search-body">
                <SearchDialogPrimitive.Input
                  value={query}
                  onChange={setQuery}
                  className="bdocs-search-field"
                >
                  <SearchDialogPrimitive.Input.SearchInput
                    aria-label="Search documentation"
                    placeholder="Search documentation..."
                    className="bdocs-search-input"
                  />
                  {query && (
                    <SearchDialogPrimitive.Input.Button
                      slot="clear"
                      aria-label="Clear search"
                      onPress={() => setQuery('')}
                      className="bdocs-search-clear"
                    >
                      <X size={16} />
                    </SearchDialogPrimitive.Input.Button>
                  )}
                </SearchDialogPrimitive.Input>

                <div
                  id={statusId}
                  role={status === 'error' ? 'alert' : 'status'}
                  aria-live={status === 'error' ? 'assertive' : 'polite'}
                  className="sr-only"
                >
                  {statusMessage}
                </div>

                {isLoading ? (
                  <div className="bdocs-search-state" aria-hidden="true">
                    {status === 'loading'
                      ? 'Loading search index…'
                      : status === 'indexing'
                        ? 'Preparing search…'
                        : 'Searching…'}
                  </div>
                ) : error ? (
                  <div className="bdocs-search-state bdocs-search-state--centered">
                    Search is temporarily unavailable.
                  </div>
                ) : query.trim() && list.length === 0 ? (
                  <div className="bdocs-search-state">No results found.</div>
                ) : (
                  <SearchDialogPrimitive.List
                    items={list as SearchResult[]}
                    onAction={handleSelect}
                    className="bdocs-search-results"
                  >
                    {(item: SearchResult) => (
                      <SearchDialogPrimitive.Item
                        key={item.id}
                        textValue={item.title}
                        className="bdocs-search-result"
                      >
                        <SearchDialogPrimitive.Item.Icon
                          isHeading={item.isHeading}
                          className="bdocs-search-result__icon"
                        />
                        <div className="bdocs-search-result__text">
                          <SearchDialogPrimitive.Item.Title className="bdocs-search-result__title">
                            <SearchResultHighlight
                              text={item.title}
                              query={query}
                              markClassName={markClassName}
                            />
                          </SearchDialogPrimitive.Item.Title>
                          <SearchDialogPrimitive.Item.Bio className="bdocs-search-result__bio">
                            <SearchResultHighlight
                              text={item.snippet ?? item.bio}
                              query={query}
                              markClassName={markClassName}
                            />
                          </SearchDialogPrimitive.Item.Bio>
                        </div>
                      </SearchDialogPrimitive.Item>
                    )}
                  </SearchDialogPrimitive.List>
                )}
              </SearchDialogPrimitive.Autocomplete>
            </SearchDialogPrimitive.Dialog>
          </SearchDialogPrimitive.Content>
        </SearchDialogPrimitive.Overlay>
      </ErrorBoundary>
    </>
  )
}
