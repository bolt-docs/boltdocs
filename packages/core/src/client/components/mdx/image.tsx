import { useState } from 'react'
import type { ImgHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { Button } from 'react-aria-components'
import { useTheme } from '../../app/theme-context'
import { cn } from '../../utils/cn'
import { Tooltip } from '../primitives/tooltip'

export interface ImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string
  theme?: 'light' | 'dark'
  caption?: React.ReactNode
  zoom?: boolean
}

/**
 * A themed and interactive Image component for Boltdocs.
 * Supports light/dark variants, markdown/rich captions, and a premium lightbox zoom effect.
 */
export function Image({
  src,
  alt,
  theme: imageTheme,
  caption,
  zoom = false,
  className,
  ...props
}: ImageProps) {
  const { theme: currentTheme } = useTheme()
  const [isZoomed, setIsZoomed] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)

  // If a specific theme restriction is active, only render if it matches
  if (imageTheme && imageTheme !== currentTheme) {
    return null
  }

  const handleOpen = () => {
    setShouldRender(true)
    setTimeout(() => {
      setIsZoomed(true)
    }, 10)
  }

  const handleClose = () => {
    setIsZoomed(false)
    setTimeout(() => {
      setShouldRender(false)
    }, 200) // matches transition duration (200ms)
  }

  const imageElement = (
    <img
      src={src}
      alt={alt || ''}
      className={cn(
        'rounded-xl max-w-full h-auto my-0! border border-subtle bg-surface/5 transition-all duration-300',
        { 'cursor-zoom-in': zoom },
      )}
      onClick={(e) => {
        if (zoom) {
          e.stopPropagation()
          handleOpen()
        }
      }}
      {...props}
    />
  )

  const portalOverlay =
    zoom && shouldRender && typeof document !== 'undefined'
      ? createPortal(
          <div
            className={cn(
              'fixed inset-0 z-9999 flex flex-col items-center justify-center bg-black/80 transition-all duration-200 ease-out cursor-zoom-out',
              {
                'opacity-100 backdrop-blur-md': isZoomed,
                'opacity-0 backdrop-blur-none': !isZoomed,
              },
            )}
            onClick={handleClose}
          >
            <div
              className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center justify-center select-none"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={src}
                alt={alt || ''}
                className={cn(
                  'max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl cursor-zoom-out transition-all duration-200 ease-out',
                  {
                    'scale-100 opacity-100': isZoomed,
                    'scale-95 opacity-0': !isZoomed,
                  },
                )}
                onClick={handleClose}
              />
              {caption && (
                <div
                  className={cn(
                    'mt-4 text-center text-xs sm:text-sm text-neutral-300 max-w-2xl px-6 leading-relaxed font-medium transition-all duration-200 ease-out',
                    {
                      'opacity-100 translate-y-0': isZoomed,
                      'opacity-0 translate-y-2': !isZoomed,
                    },
                  )}
                >
                  {caption}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )
      : null

  const contentElement = caption ? (
    <Tooltip
      content={caption}
      delay={100}
      closeDelay={0}
      className="max-w-xs sm:max-w-md whitespace-normal leading-relaxed text-center font-normal"
    >
      <Button className="relative bg-transparent p-0 border-none outline-hidden cursor-default block max-w-full text-left">
        {imageElement}
      </Button>
    </Tooltip>
  ) : (
    imageElement
  )

  return (
    <>
      <figure
        className={cn(
          'relative my-6 flex flex-col items-center justify-center max-w-full',
          className,
        )}
      >
        {contentElement}
      </figure>
      {portalOverlay}
    </>
  )
}
