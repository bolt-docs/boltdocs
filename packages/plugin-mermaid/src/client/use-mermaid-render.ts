import { useEffect, useMemo, useState } from 'react'
import { useTheme } from 'boltdocs/client'
import type { MermaidPluginOptions } from '../shared/types'
import { defaultTheme } from '../shared/theme-default'

interface UseMermaidRenderResult {
  svgStr: string
  error: string | null
}

/**
 * Clean SVG by removing sizing attributes only from the root <svg> element.
 * Preserves all inner element styles (transforms, font-size, etc.) that
 * mermaid uses for precise node positioning.
 */
function cleanSvg(svg: string): string {
  try {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
    const root = doc.querySelector('svg')
    if (!root) return svg

    root.removeAttribute('height')
    root.removeAttribute('width')
    root.removeAttribute('min-height')
    root.removeAttribute('style')
    root.style.width = '100%'
    root.style.height = 'auto'
    root.style.overflow = 'hidden'

    return new XMLSerializer().serializeToString(root)
  } catch {
    return svg
  }
}

export function useMermaidRender(
  chart: string,
  config: MermaidPluginOptions | string | undefined,
): UseMermaidRenderResult {
  const { resolvedTheme } = useTheme()
  const [svgStr, setSvgStr] = useState('')
  const [error, setError] = useState<string | null>(null)

  const pluginConfig = useMemo(() => {
    if (typeof config === 'string') {
      try {
        return JSON.parse(config)
      } catch (e) {
        console.error('[Boltdocs] Failed to parse Mermaid config:', e)
        return {}
      }
    }
    return config || {}
  }, [config])

  const lightTheme = useMemo(
    () => pluginConfig.themes?.light || defaultTheme.light,
    [pluginConfig],
  )
  const darkTheme = useMemo(
    () => pluginConfig.themes?.dark || defaultTheme.dark,
    [pluginConfig],
  )

  const themeKey = useMemo(
    () => JSON.stringify({ l: lightTheme, d: darkTheme }),
    [lightTheme, darkTheme],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: themeKey covers darkTheme/lightTheme changes
  useEffect(() => {
    let isMounted = true
    let abort = false
    const id = `mermaid-${Math.random().toString(36).substring(2, 11)}`

    const renderDiagram = async () => {
      try {
        const isDark = resolvedTheme === 'dark'
        const { default: mermaid } = await import('mermaid')
        if (abort) return

        mermaid.initialize({
          startOnLoad: false,
          theme: 'base',
          securityLevel: 'loose',
          htmlLabels: false,
          fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
          themeVariables: isDark ? darkTheme : lightTheme,
          darkMode: isDark,
          flowchart: {
            htmlLabels: false,
            useMaxWidth: true,
          },
        })

        const { svg } = await mermaid.render(id, chart)
        if (isMounted) {
          const cleaned = cleanSvg(svg)
          setSvgStr(cleaned)
          setError(null)
        }
      } catch (e) {
        if (isMounted) {
          console.error('[Boltdocs] Failed to render Mermaid diagram:', e)
          setError('Failed to render diagram. Check your syntax.')
        }
      }
    }

    renderDiagram()
    return () => {
      isMounted = false
      abort = true
    }
  }, [chart, resolvedTheme, themeKey])

  return { svgStr, error }
}
