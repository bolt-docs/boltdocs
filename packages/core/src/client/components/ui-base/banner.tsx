import { useState, useEffect } from 'react'
import { X } from './icons'

export interface BannerProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * If true, shows a close button to dismiss the banner.
   */
  dismissible?: boolean
  /**
   * Unique identifier for the banner. If provided and dismissible is true,
   * the dismissed state will be saved in localStorage so it doesn't reappear
   * on subsequent visits.
   */
  id?: string
}

export function Banner({
  children,
  className = '',
  dismissible = false,
  id = 'boltdocs-banner',
  ...props
}: BannerProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    if (dismissible && id) {
      const isDismissed = localStorage.getItem(
        `boltdocs-banner-dismissed-${id}`,
      )
      if (isDismissed === 'true') {
        setIsVisible(false)
      }
    }
  }, [dismissible, id])

  const handleDismiss = () => {
    setIsVisible(false)
    if (dismissible && id) {
      localStorage.setItem(`boltdocs-banner-dismissed-${id}`, 'true')
    }
  }

  if (!isVisible) return null

  return (
    <div
      className={`relative flex items-center justify-center px-4 py-2.5 text-xs font-semibold tracking-wide bg-primary-500/10 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300 border-b border-primary-500/20 select-none animate-in fade-in duration-300 ${className}`}
      {...props}
    >
      <div className="flex-1 text-center flex items-center justify-center gap-2">
        {children}
      </div>
      {dismissible && (
        <button
          onClick={handleDismiss}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 opacity-70 hover:opacity-100 transition-all duration-300 rounded-xl hover:bg-primary-500/10 cursor-pointer border-none bg-transparent flex items-center justify-center outline-none"
          aria-label="Dismiss banner"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
export default Banner
