import type { TOCItemInfo, TOCItemType } from '../on-this-page'

export function getItemId(url: string) {
  if (url.startsWith('#')) return url.slice(1)
  return null
}

export class Observer {
  items: TOCItemInfo[] = []
  single = false
  private observer: IntersectionObserver | null = null
  private timers: ReturnType<typeof setTimeout>[] = []
  onChange?: () => void

  private callback(_entries: IntersectionObserverEntry[]) {
    // For each item, check if it's currently in viewport
    for (const item of this.items) {
      const element = document.getElementById(item.id)
      if (!element) {
        item.active = false
        item.fallback = false
        continue
      }

      const rect = element.getBoundingClientRect()
      const viewportHeight =
        typeof window !== 'undefined' ? window.innerHeight : 1000

      // Check if element is currently in viewport (visible)
      // rect.bottom > 0
      // rect.top < viewportHeight:
      const isInViewport = rect.bottom > 0 && rect.top < viewportHeight

      // Update active state based on current position
      item.active = isInViewport

      // Fallback: element has scrolled past but is still near viewport
      item.fallback =
        !isInViewport && rect.top > 0 && rect.top < viewportHeight * 2
    }

    // 3. Determine which items should be active based on single mode
    if (this.single) {
      // Single mode: only ONE active item (the one closest to the top of viewport)
      let highlightIdx = -1

      // Find all visible items and pick the one closest to the top of viewport
      const visibleItems = this.items
        .map((item, idx) => ({ item, idx }))
        .filter(({ item }) => item.active)

      if (visibleItems.length > 0) {
        // Take the first one (closest to top of viewport)
        highlightIdx = visibleItems[0].idx
      } else {
        // If nothing visible, check fallback items
        const fallbackItems = this.items
          .map((item, idx) => ({ item, idx }))
          .filter(({ item }) => item.fallback)

        if (fallbackItems.length > 0) {
          highlightIdx = fallbackItems[0].idx
        } else if (this.items.length > 0) {
          highlightIdx = 0
        }
      }

      // Map back to UI state - only one active
      this.items = this.items.map((item, idx) => ({
        ...item,
        active: idx === highlightIdx,
        t: idx === highlightIdx ? Date.now() : item.t,
      }))
    } else {
      // Multi mode: items active when they are in viewport
      // This ensures items activate when visible and deactivate when they leave viewport
      this.items = this.items.map((item, idx) => ({
        ...item,
        active: item.active,
        t: item.active ? Date.now() : item.t,
      }))
    }

    this.onChange?.()
  }

  setItems(newItems: TOCItemType[]) {
    const observer = this.observer
    if (observer) {
      for (const item of this.items) {
        const element = document.getElementById(item.id)
        if (!element) continue
        observer.unobserve(element)
      }
    }

    this.items = []
    for (const item of newItems) {
      const id = getItemId(item.url)
      if (!id) continue

      this.items.push({
        id,
        active: false,
        fallback: false,
        t: 0,
        original: item,
      })
    }
    this.watchItems()

    // In an SPA, the TOC might update before the MDX content is in the DOM.
    // We perform a few delayed scans to ensure we catch those elements.
    if (typeof window !== 'undefined') {
      this.timers.push(setTimeout(() => this.watchItems(), 100))
      this.timers.push(setTimeout(() => this.watchItems(), 500))
      this.timers.push(setTimeout(() => this.watchItems(), 1000))
    }

    this.onChange?.()
  }

  watch(options?: IntersectionObserverInit) {
    if (this.observer) return
    this.observer = new IntersectionObserver(this.callback.bind(this), options)
    this.watchItems()
  }

  private watchItems() {
    if (!this.observer) return
    for (const item of this.items) {
      const element = document.getElementById(item.id)
      if (!element) continue
      this.observer.observe(element)
    }
  }

  unwatch() {
    for (const timer of this.timers) {
      clearTimeout(timer)
    }
    this.timers = []
    this.observer?.disconnect()
    this.observer = null
  }
}
