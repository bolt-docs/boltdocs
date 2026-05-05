import { useEffect, useCallback } from 'react'
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
      <Navbar.SearchTrigger onPress={() => setIsOpen(true)} />

      <SearchDialogPrimitive.Root isOpen={isOpen} onOpenChange={setIsOpen}>
        <SearchDialogPrimitive.Autocomplete
          onSelectionChange={handleSelect}
          className="flex-1 min-h-0"
        >
          <SearchDialogPrimitive.Input
            value={query}
            onChange={setQuery}
            onClear={() => setQuery('')}
          />
          <SearchDialogPrimitive.List items={list as SearchResult[]}>
            {(item: SearchResult) => (
              <SearchDialogPrimitive.Item
                key={item.id}
                onPress={() => handleSelect(item.id)}
                textValue={item.title}
              >
                <SearchDialogPrimitive.Item.Icon isHeading={item.isHeading} />
                <div className="flex flex-col justify-center gap-0.5">
                  <SearchDialogPrimitive.Item.Title>
                    <Highlight text={item.title} query={query} />
                  </SearchDialogPrimitive.Item.Title>
                  <SearchDialogPrimitive.Item.Bio>
                    <Highlight text={item.bio} query={query} />
                  </SearchDialogPrimitive.Item.Bio>
                </div>
              </SearchDialogPrimitive.Item>
            )}
          </SearchDialogPrimitive.List>
        </SearchDialogPrimitive.Autocomplete>
      </SearchDialogPrimitive.Root>
    </>
  )
}
