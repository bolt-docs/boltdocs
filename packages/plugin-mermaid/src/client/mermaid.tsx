import { useCallback, useState } from 'react'
import type { MermaidPluginOptions } from '../shared/types'
import { useMermaidRender } from './use-mermaid-render'
import { useZoomPan } from './use-zoom-pan'
import { Toolbar } from './toolbar'
import { MermaidFullscreen } from './mermaid-fullscreen'
import { cn } from 'boltdocs/client'

export interface MermaidProps {
  chart: string
  config?: MermaidPluginOptions
}

export function Mermaid({ chart, config }: MermaidProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [instanceId] = useState(() =>
    Math.random().toString(36).substring(2, 9),
  )
  const { svgStr, error } = useMermaidRender(chart, config)

  const {
    state: zoomPan,
    resetZoom,
    zoomIn,
    zoomOut,
    interactiveProps,
  } = useZoomPan({ resetTrigger: chart })

  const expand = useCallback(() => setIsFullscreen(true), [])
  const close = useCallback(() => setIsFullscreen(false), [])

  if (error) {
    return (
      <div className="my-6 flex items-center justify-center rounded-lg border border-red-200 bg-red-500/5 p-4 text-sm text-red-600 dark:border-red-900/30 dark:text-red-400">
        {error}
      </div>
    )
  }

  if (!svgStr) {
    return (
      <div className="not-prose relative my-6 flex min-h-[80px] items-center justify-center overflow-auto rounded-xl border border-subtle bg-surface/30 p-6 backdrop-blur-sm">
        <pre className="w-full overflow-auto font-mono text-xs leading-relaxed text-secondary/60">
          <code>{chart}</code>
        </pre>
      </div>
    )
  }

  return (
    <>
      <div
        className={cn(
          'not-prose mermaid-inline relative my-6 w-full max-h-[65vh] overflow-hidden rounded-xl border border-subtle bg-surface/30 backdrop-blur-sm',
          `mermaid-inline-${instanceId}`,
          {
            'cursor-grabbing': zoomPan.isDragging,
            'cursor-grab': !zoomPan.isDragging,
          },
        )}
        {...interactiveProps}
      >
        <style>{`
          .mermaid-inline-${instanceId} .mermaid-rendered,
          .mermaid-inline-${instanceId} .mermaid-rendered * {
            cursor: ${zoomPan.isDragging ? 'grabbing' : 'grab'} !important;
          }
          .mermaid-inline-${instanceId} .mermaid-rendered {
            overflow: hidden;
          }
          .mermaid-inline-${instanceId} .mermaid-rendered svg {
            display: block !important;
            width: 100% !important;
            height: auto !important;
            max-width: 100% !important;
            max-height: calc(65vh - 3rem) !important;
            margin: 0 !important;
          }
        `}</style>

        {/* Toolbar */}
        <div className="absolute right-2 top-2 z-10 flex gap-1.5">
          <Toolbar
            toggleFullscreen={expand}
            hasInteracted={zoomPan.hasInteracted}
            resetZoom={resetZoom}
            zoomIn={zoomIn}
            zoomOut={zoomOut}
            mode="normal"
          />
        </div>

        {/* SVG — scrollable, constrained height */}
        <div className="relative flex max-h-[65vh] w-full items-center justify-center overflow-hidden p-6">
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

      {isFullscreen && <MermaidFullscreen svgStr={svgStr} onClose={close} />}
    </>
  )
}
