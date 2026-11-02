import { useState, useEffect } from 'react'
import { X } from './icons'
import { cn } from '../../utils/cn'

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
    if (dismissible && id && typeof window !== 'undefined') {
      try {
        const isDismissed = window.localStorage.getItem(
          `boltdocs-banner-dismissed-${id}`,
        )
        if (isDismissed === 'true') {
          setIsVisible(false)
        }
      } catch {}
    }
  }, [dismissible, id])

  const handleDismiss = () => {
    setIsVisible(false)
    if (dismissible && id && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(`boltdocs-banner-dismissed-${id}`, 'true')
      } catch {}
    }
  }

  if (!isVisible) return null

  return (
    <div className={cn('bdocs-banner', className)} {...props}>
      <div className="bdocs-banner__text">{children}</div>
      {dismissible && (
        <button
          onClick={handleDismiss}
          className="bdocs-banner__dismiss"
          aria-label="Dismiss banner"
        >
          <X className="bdocs-banner__dismiss-icon" />
        </button>
      )}
    </div>
  )
}
export default Banner
