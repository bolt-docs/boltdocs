import { Search, X } from 'lucide-react'
import { useSearch } from 'boltdocs/client'
import { SearchDialog as SearchDialogPrimitive } from 'boltdocs/primitives'
import { Navbar } from 'boltdocs/primitives'
import { ErrorBoundary } from 'boltdocs/client'
import type { ComponentRoute } from 'boltdocs/client'

interface SearchResult {
  id: string
  title: string
  path: string
  bio: string
  groupTitle?: string
  isHeading?: boolean
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query || !text) return <>{text}</>
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escapedQuery})`, 'gi')
  const parts = text.split(regex)
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="bg-primary-500/20 text-primary-400 font-bold px-0.5 rounded-sm"
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

export function SearchDialog({ routes }: { routes: ComponentRoute[] }) {
  const {
    isOpen,
    setIsOpen,
    query,
    setQuery,
    list,
    searchDataLoading,
    searchDataError,
    handleSelect,
  } = useSearch(routes)

  return (
    <>
      <Navbar.SearchTrigger.Desktop
        onPress={() => setIsOpen(true)}
        className="rounded-lg w-[70%] bg-subtle text-muted transition-all duration-150 hover:text-body focus-visible:ring-2 focus-visible:ring-primary-500/30"
      >
        <div className="flex items-center gap-2">
          <Search size={16} />
          <span className="hidden sm:inline-block">Search docs...</span>
        </div>
        <Navbar.SearchTrigger.Kbd className="[&_kbd]:bg-surface [&_kbd]:rounded-sm [&_kbd]:px-2 [&_kbd]:h-5 [&_kbd]:w-auto [&_kbd]:text-[0.625rem]" />
      </Navbar.SearchTrigger.Desktop>

      <Navbar.SearchTrigger.Mobile
        onPress={() => setIsOpen(true)}
        className="rounded-md text-muted transition-all duration-150 hover:text-body focus-visible:ring-2 focus-visible:ring-primary-500/30"
      >
        <Search size={20} />
      </Navbar.SearchTrigger.Mobile>

      <ErrorBoundary>
        <SearchDialogPrimitive.Overlay
          isOpen={isOpen}
          isDismissable
          onOpenChange={() => setIsOpen(false)}
          className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-main/70 backdrop-blur-sm animate-fade-in"
        >
          <SearchDialogPrimitive.Content className="w-full max-w-2xl bg-surface rounded-xl overflow-hidden p-6">
            <SearchDialogPrimitive.Dialog
              aria-label="Search documentation"
              className="flex flex-col w-full min-h-0 h-[90%]"
            >
              <SearchDialogPrimitive.Autocomplete className="flex flex-col min-h-0">
                <SearchDialogPrimitive.Input
                  value={query}
                  onChange={setQuery}
                  className="flex items-center gap-2 bg-subtle px-6 py-2.5 rounded-md focus-within:border-primary-500 mb-5"
                >
                  <SearchDialogPrimitive.Input.SearchInput
                    placeholder="Search documentation..."
                    className="w-full outline-none text-body text-sm"
                  />
                  {query && (
                    <SearchDialogPrimitive.Input.Button
                      onPress={() => setQuery('')}
                      className="text-muted hover:text-body hover:bg-surface rounded-md p-1 cursor-pointer select-none transition-colors"
                    >
                      <X size={16} />
                    </SearchDialogPrimitive.Input.Button>
                  )}
                </SearchDialogPrimitive.Input>

                {searchDataLoading ? (
                  <div className="flex flex-1 items-center justify-center px-4 py-8 text-sm text-muted">
                    Loading search index…
                  </div>
                ) : searchDataError ? (
                  <div className="flex flex-1 items-center justify-center px-4 py-8 text-center text-sm text-muted">
                    Search is temporarily unavailable.
                  </div>
                ) : query && list.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center px-4 py-8 text-sm text-muted">
                    No results found.
                  </div>
                ) : (
                  <SearchDialogPrimitive.List
                    items={list as SearchResult[]}
                    onAction={handleSelect}
                    className={'gap-2 flex flex-col'}
                  >
                    {(item: SearchResult) => (
                      <SearchDialogPrimitive.Item
                        key={item.id}
                        textValue={item.title}
                        className="flex items-center px-3 py-2 rounded-md group hover:bg-soft/70 data-focused:bg-soft/70 transition-colors duration-100"
                      >
                        <div className="flex flex-col justify-center min-w-0 gap-1">
                          <SearchDialogPrimitive.Item.Title className="text-md font-medium text-body truncate group-hover:text-body">
                            <Highlight text={item.title} query={query} />
                          </SearchDialogPrimitive.Item.Title>
                          <SearchDialogPrimitive.Item.Bio className="text-xs text-muted truncate">
                            <Highlight text={item.bio} query={query} />
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
