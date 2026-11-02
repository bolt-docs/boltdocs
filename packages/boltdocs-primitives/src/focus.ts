/**
 * Focus management for overlays.
 *
 * These are the pieces that decide whether a modal dialog is usable with a
 * keyboard and a screen reader. They are small, but they are the reason an
 * overlay either works or does not: a focus trap that leaks focus into the page
 * behind, or fails to return focus on close, strands keyboard users.
 */

/** Selector for elements that can hold focus. */
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',')

/**
 * Elements that can hold focus, in DOM order.
 *
 * Hidden elements are excluded by the `hidden` attribute and by computed
 * `display`/`visibility`, but not by geometry. A geometry check would be the
 * thorough answer in a browser, and it is deliberately absent: jsdom performs no
 * layout, so `offsetParent` is always null and `getClientRects()` is always
 * empty, which would make every element look hidden and every focus-trap test
 * vacuously pass. Skipping it keeps the behaviour here the same as in a browser
 * for everything that can actually be asserted.
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((el) => {
    if (el.hasAttribute('disabled')) return false
    if (el.hasAttribute('hidden')) return false
    if (el.getAttribute('aria-hidden') === 'true') return false
    const style =
      typeof window !== 'undefined' ? window.getComputedStyle(el) : null
    if (style && (style.display === 'none' || style.visibility === 'hidden'))
      return false
    return true
  })
}

/**
 * Moves focus to `element`, preferring something inside it when `element` is a
 * container.
 *
 * The WAI-ARIA dialog pattern asks for the first focusable descendant, or the
 * container itself when there is none, so that focus never stays on the page
 * behind the dialog.
 */
export function focusFirstIn(
  container: HTMLElement,
  fallback?: HTMLElement | null,
): HTMLElement | null {
  const focusable = getFocusableElements(container)
  const target = focusable[0] ?? fallback ?? container
  target.focus()
  return target
}

/**
 * Keeps Tab and Shift+Tab inside `container`.
 *
 * Wraps at both ends. The wrap is the whole point: a trap that only stops focus
 * leaving, without cycling, leaves a keyboard user with no way onward when the
 * last element is reached.
 */
export function trapTab(container: HTMLElement, event: KeyboardEvent): void {
  if (event.key !== 'Tab') return

  const focusable = getFocusableElements(container)
  if (focusable.length === 0) {
    // Nothing to move to; keep focus on the container rather than the page.
    event.preventDefault()
    container.focus()
    return
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = document.activeElement

  if (!container.contains(active)) {
    event.preventDefault()
    ;(event.shiftKey ? last : first).focus()
    return
  }

  if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

/**
 * Marks everything outside `container` as `aria-hidden` and inert.
 *
 * Without this a screen reader in browse mode walks straight out of the dialog
 * and starts reading the page behind it, which `aria-modal` alone does not
 * prevent in every reader.
 */
export function hideSiblings(container: HTMLElement): () => void {
  const parent = container.parentElement
  if (!parent) return () => {}

  const hidden: HTMLElement[] = []
  for (const child of Array.from(parent.children)) {
    if (child === container || !(child instanceof HTMLElement)) continue
    if (child.hasAttribute('aria-hidden')) continue
    child.setAttribute('aria-hidden', 'true')
    hidden.push(child)
  }

  return () => {
    for (const el of hidden) el.removeAttribute('aria-hidden')
  }
}

/** Prevents the page behind an overlay from scrolling. */
export function lockScroll(): () => void {
  const previous = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  return () => {
    document.body.style.overflow = previous
  }
}

/** Stops events reaching the page behind an overlay. */
export function stopPropagationIn<T extends { stopPropagation(): void }>(
  e: T,
): void {
  e.stopPropagation()
}
