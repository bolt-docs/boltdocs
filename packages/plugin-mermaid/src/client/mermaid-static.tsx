import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MermaidPluginOptions } from '../shared/types'
import { useTheme } from 'boltdocs/client'
import { useZoomPan } from './use-zoom-pan'
import { Toolbar } from './toolbar'
import { MermaidFullscreen } from './mermaid-fullscreen'
import { cn } from 'boltdocs/client'

export interface MermaidStaticProps {
  chart: string
  svgLight?: string
  svgDark?: string
  config?: MermaidPluginOptions
}

/**
 * Static Mermaid component — renders pre-rendered SVGs only.
 *
 * Unlike the full `Mermaid` component, this does NOT import
 * `mermaid` for client-side rendering, which eliminates the
 * ~800KB of code-split mermaid chunks (architectureDiagram,
 * sequenceDiagram, etc.) from the client bundle.
 *
 * When pre-rendered SVGs are not available (e.g. build failure),
 * it falls back to displaying the raw chart code.
 */
export function MermaidStatic({
  chart,
  svgLight,
  svgDark,
}: MermaidStaticProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [instanceId] = useState(() =>
    Math.random().toString(36).substring(2, 9),
  )
  const { resolvedTheme } = useTheme()

  const hasPreRendered = !!svgLight && !!svgDark
  const svgStr = useMemo(
    () =>
      hasPreRendered ? (resolvedTheme === 'dark' ? svgDark : svgLight) : null,
    [hasPreRendered, resolvedTheme, svgLight, svgDark],
  )

  const {
    state: zoomPan,
    resetZoom,
    zoomIn,
    zoomOut,
    interactiveProps,
  } = useZoomPan({ resetTrigger: chart })

  // Inject scoped styles into `<head>` instead of rendering an in-tree
  // `<style>` element. See the matching comment in `mermaid.tsx`.
  useEffect(() => {
    if (typeof document === 'undefined') return
    const styleEl = document.createElement('style')
    styleEl.setAttribute('data-mermaid-static-style', instanceId)
    styleEl.textContent = `
      .mermaid-inline-${instanceId} .mermaid-rendered,
      .mermaid-inline-${instanceId} .mermaid-rendered * {
        cursor: ${zoomPan.isDragging ? 'grabbing' : 'grab'} !important;
      }
      .mermaid-inline-${instanceId} .mermaid-rendered {
        overflow: visible;
      }
      .mermaid-inline-${instanceId} .mermaid-rendered svg {
        display: block !important;
        width: 100% !important;
        height: auto !important;
        max-width: 100% !important;
        max-height: 240px !important;
        margin: 0 !important;
      }
    `
    document.head.appendChild(styleEl)
    return () => {
      styleEl.remove()
    }
  }, [instanceId, zoomPan.isDragging])

  const expand = useCallback(() => setIsFullscreen(true), [])
  const close = useCallback(() => setIsFullscreen(false), [])

  // Without pre-rendered SVGs, show the chart code as a fallback
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
          'not-prose mermaid-inline relative my-6 w-full max-h-[300px] overflow-hidden rounded-xl border border-subtle bg-surface/30 backdrop-blur-sm',
          `mermaid-inline-${instanceId}`,
          {
            'cursor-grabbing': zoomPan.isDragging,
            'cursor-grab': !zoomPan.isDragging,
          },
        )}
        {...interactiveProps}
      >
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

        {/* SVG — small preview, click to expand to fullscreen */}
        <div className="relative flex h-[300px] w-full items-center justify-center overflow-hidden p-6">
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
