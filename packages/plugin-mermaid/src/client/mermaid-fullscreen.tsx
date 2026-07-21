import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Toolbar } from './toolbar'
import { useZoomPan } from './use-zoom-pan'
import { cn } from 'boltdocs/client'

interface MermaidFullscreenProps {
  svgStr: string
  onClose: () => void
}

export function MermaidFullscreen({ svgStr, onClose }: MermaidFullscreenProps) {
  const [instanceId] = useState(() =>
    Math.random().toString(36).substring(2, 9),
  )
  const [isVisible, setIsVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  const {
    state: zoomPan,
    resetZoom,
    zoomIn,
    zoomOut,
    interactiveProps,
  } = useZoomPan()

  // Animate in on mount
  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  // Animated close
  const handleClose = useCallback(() => {
    setIsClosing(true)
    setIsVisible(false)
    setTimeout(() => onClose(), 200)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleClose])

  // Lock body and scroll container scrolling
  useEffect(() => {
    document.documentElement.classList.add('mermaid-lock-scroll')
    return () => {
      document.documentElement.classList.remove('mermaid-lock-scroll')
    }
  }, [])

  // Inject scoped styles into `<head>` instead of rendering an in-tree
  // `<style>` element. See the matching comment in `mermaid.tsx`.
  useEffect(() => {
    if (typeof document === 'undefined') return
    const styleEls: HTMLStyleElement[] = []

    styleEls.push(
      (() => {
        const s = document.createElement('style')
        s.setAttribute('data-mermaid-lock-style', instanceId)
        s.textContent = `
        .mermaid-lock-scroll,
        .mermaid-lock-scroll body,
        .mermaid-lock-scroll .boltdocs-content {
          overflow: hidden !important;
        }
      `
        return s
      })(),
    )

    styleEls.push(
      (() => {
        const s = document.createElement('style')
        s.setAttribute('data-mermaid-fullscreen-style', instanceId)
        s.textContent = `
        .mermaid-fullscreen-${instanceId} .mermaid-rendered,
        .mermaid-fullscreen-${instanceId} .mermaid-rendered * {
          cursor: ${zoomPan.isDragging ? 'grabbing' : 'grab'} !important;
        }
        .mermaid-fullscreen-${instanceId} .mermaid-rendered svg {
          max-width: 100% !important;
          max-height: calc(90vh - 4rem) !important;
        }
      `
        return s
      })(),
    )

    for (const s of styleEls) document.head.appendChild(s)
    return () => {
      for (const s of styleEls) s.remove()
    }
  }, [instanceId, zoomPan.isDragging])

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[1000] flex items-center justify-center p-6 sm:p-10 transition-all duration-200 ease-out',
        isVisible && !isClosing
          ? 'bg-main/90 backdrop-blur-md opacity-100'
          : 'bg-main/0 backdrop-blur-none opacity-0',
      )}
      role="dialog"
      aria-label="Mermaid diagram fullscreen"
      tabIndex={-1}
      onClick={handleClose}
    >
      <div
        className={cn(
          'relative flex w-full bg-main p-2 max-w-7xl flex-col rounded-xl border border-subtle shadow-2xl overflow-hidden transition-all duration-200 ease-out',
          isVisible && !isClosing
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 translate-y-4',
          {
            'cursor-grabbing': zoomPan.isDragging,
            'cursor-grab': !zoomPan.isDragging,
          },
        )}
        style={{
          height: '70%',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toolbar — top right */}
        <div className="absolute right-4 top-4 z-20 flex gap-1.5">
          <Toolbar
            toggleFullscreen={handleClose}
            hasInteracted={zoomPan.hasInteracted}
            resetZoom={resetZoom}
            zoomIn={zoomIn}
            zoomOut={zoomOut}
            mode="fullscreen"
          />
        </div>
        <div
          className="flex-1 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className={cn(
              'relative flex w-full items-center justify-center p-8',
              `mermaid-fullscreen-${instanceId}`,
            )}
            {...interactiveProps}
          >
            <div
              className="mermaid-rendered"
              style={{
                transform: `translate(${zoomPan.posX}px, ${zoomPan.posY}px) scale(${zoomPan.scale})`,
                transformOrigin: 'center center',
                willChange: 'transform',
                transition:
                  zoomPan.isDragging || !zoomPan.hasInteracted
                    ? 'none'
                    : 'transform 0.25s cubic-bezier(0.25, 0.1, 0.25, 1)',
              }}
              dangerouslySetInnerHTML={{ __html: svgStr }}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
