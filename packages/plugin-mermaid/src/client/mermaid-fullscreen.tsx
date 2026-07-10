import { useEffect, useState } from 'react'
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
  const {
    state: zoomPan,
    resetZoom,
    zoomIn,
    zoomOut,
    interactiveProps,
  } = useZoomPan()

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Lock body and scroll container scrolling
  useEffect(() => {
    document.documentElement.classList.add('mermaid-lock-scroll')
    return () => {
      document.documentElement.classList.remove('mermaid-lock-scroll')
    }
  }, [])

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-main/90 backdrop-blur-md p-6 sm:p-10"
      role="dialog"
      aria-label="Mermaid diagram fullscreen"
      tabIndex={-1}
    >
      <style>{`
        .mermaid-lock-scroll,
        .mermaid-lock-scroll body,
        .mermaid-lock-scroll .boltdocs-content {
          overflow: hidden !important;
        }
        .mermaid-fullscreen-${instanceId} .mermaid-rendered,
        .mermaid-fullscreen-${instanceId} .mermaid-rendered * {
          cursor: ${zoomPan.isDragging ? 'grabbing' : 'grab'} !important;
        }
        .mermaid-fullscreen-${instanceId} .mermaid-rendered svg {
          max-width: 100% !important;
          max-height: calc(90vh - 4rem) !important;
        }
      `}</style>

      <div
        className={cn(
          'relative flex w-full bg-main p-2 max-w-7xl flex-col rounded-xl border border-subtle shadow-2xl overflow-hidden',
          {
            'cursor-grabbing': zoomPan.isDragging,
            'cursor-grab': !zoomPan.isDragging,
          },
        )}
        style={{
          height: '70%',
        }}
      >
        {/* Toolbar — top right */}
        <div className="absolute right-4 top-4 z-20 flex gap-1.5">
          <Toolbar
            toggleFullscreen={onClose}
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
                transition:
                  zoomPan.isDragging || !zoomPan.hasInteracted
                    ? 'none'
                    : 'transform 0.15s ease-out',
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
