import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

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
      className={`relative flex items-center justify-center px-4 py-3 text-sm font-medium ${className}`}
      {...props}
    >
      <div className="flex-1 text-center flex items-center justify-center gap-2">
        {children}
      </div>
      {dismissible && (
        <button
          onClick={handleDismiss}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 opacity-70 hover:opacity-100 transition-opacity rounded-md hover:bg-black/10 dark:hover:bg-white/10"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
