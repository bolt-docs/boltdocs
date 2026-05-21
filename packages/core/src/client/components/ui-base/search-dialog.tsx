import { useEffect, useCallback } from 'react'
import { Search } from './icons'
import { useSearch } from '../../hooks/use-search'
import { SearchDialog as SearchDialogPrimitive } from '../primitives/search-dialog'
import Navbar from '../primitives/navbar'
import { useNavigate } from 'react-router-dom'
import type { ComponentRoute } from '../../types'

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
            className="bg-primary-500/20 text-primary-600 dark:text-primary-400 font-bold px-0.5 rounded-sm"
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
  const { isOpen, setIsOpen, query, setQuery, list } = useSearch(routes)
  const navigate = useNavigate()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = /Mac/.test(navigator.userAgent)
      const isMeta = isMac ? e.metaKey : e.ctrlKey

      if (isMeta && (e.key === 'k' || e.key === 'j')) {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setIsOpen])

  const handleSelect = useCallback(
    (key: React.Key) => {
      const path = String(key)
      setIsOpen(false)

      const [baseUrl, hash] = path.split('#')
      const search = query ? `?hl=${encodeURIComponent(query)}` : ''
      const finalPath = `${baseUrl}${search}${hash ? `#${hash}` : ''}`

      navigate(finalPath)

      if (hash) {
        setTimeout(() => {
          const el = document.getElementById(hash)
          if (el) el.scrollIntoView({ behavior: 'smooth' })
        }, 100)
      }
    },
    [navigate, setIsOpen, query],
  )

  return (
    <>
      <Navbar.SearchTrigger.Desktop
        onPress={() => setIsOpen(true)}
        className="rounded-xl border border-subtle bg-surface text-muted transition-all duration-200 hover:border-primary-500/50 hover:text-body hover:bg-soft/50 hover:shadow-sm active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary-500/30"
      >
        <div className="flex items-center gap-2">
          <Search size={16} />
          <span className="hidden sm:inline-block">Search docs...</span>
        </div>
        <Navbar.SearchTrigger.Kbd className="[&_kbd]:bg-main [&_kbd]:border [&_kbd]:border-subtle [&_kbd]:rounded [&_kbd]:px-1.5 [&_kbd]:h-5 [&_kbd]:w-5" />
      </Navbar.SearchTrigger.Desktop>

      <Navbar.SearchTrigger.Mobile
        onPress={() => setIsOpen(true)}
        className="rounded-xl text-muted transition-all duration-200 hover:text-body active:scale-95 focus-visible:ring-2 focus-visible:ring-primary-500/30"
      >
        <Search size={20} />
      </Navbar.SearchTrigger.Mobile>

      <SearchDialogPrimitive.Overlay
        isOpen={isOpen}
        isDismissable
        onOpenChange={() => setIsOpen(false)}
        className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in"
      >
        <SearchDialogPrimitive.Content className="w-full max-w-lg bg-main border border-subtle shadow-md rounded-2xl overflow-hidden p-6">
          <SearchDialogPrimitive.Dialog
            aria-label="Search documentation"
            className="flex flex-col min-h-0 h-[450px]"
          >
            <SearchDialogPrimitive.Autocomplete
              onSelectionChange={handleSelect}
              className="flex flex-col min-h-0"
            >
              <SearchDialogPrimitive.Input
                value={query}
                onChange={setQuery}
                className="flex items-center gap-2 border border-subtle bg-surface px-4 py-2.5 rounded-xl focus-within:border-primary-500 mb-4"
              >
                <SearchDialogPrimitive.Input.SearchInput
                  placeholder="Search documentation..."
                  className="w-full bg-transparent outline-none text-body text-sm"
                />
                {query && (
                  <SearchDialogPrimitive.Input.Button
                    onPress={() => setQuery('')}
                    className="text-muted hover:text-body text-xs cursor-pointer select-none"
                  >
                    ✕
                  </SearchDialogPrimitive.Input.Button>
                )}
              </SearchDialogPrimitive.Input>

              <SearchDialogPrimitive.List items={list as SearchResult[]}>
                {(item: SearchResult) => (
                  <SearchDialogPrimitive.Item
                    key={item.id}
                    onPress={() => handleSelect(item.id)}
                    textValue={item.title}
                    className="flex items-center gap-3 px-4 py-2 rounded-xl group dark:hover:bg-primary-300/40 hover:bg-primary-200/50 transition-colors duration-100"
                  >
                    <SearchDialogPrimitive.Item.Icon
                      isHeading={item.isHeading}
                      className="text-muted group-hover:text-primary-500 group-focus:text-primary-500"
                    />
                    <div className="flex flex-col justify-center min-w-0">
                      <SearchDialogPrimitive.Item.Title className="text-sm font-medium text-body truncate dark:group-hover:text-primary-100">
                        <Highlight text={item.title} query={query} />
                      </SearchDialogPrimitive.Item.Title>
                      <SearchDialogPrimitive.Item.Bio className="text-xs text-muted truncate">
                        <Highlight text={item.bio} query={query} />
                      </SearchDialogPrimitive.Item.Bio>
                    </div>
                  </SearchDialogPrimitive.Item>
                )}
              </SearchDialogPrimitive.List>
            </SearchDialogPrimitive.Autocomplete>
          </SearchDialogPrimitive.Dialog>
        </SearchDialogPrimitive.Content>
      </SearchDialogPrimitive.Overlay>
    </>
  )
}
