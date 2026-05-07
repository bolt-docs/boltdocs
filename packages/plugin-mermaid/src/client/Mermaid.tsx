import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { useTheme } from 'boltdocs/client'

export interface MermaidProps {
  chart: string
}

export function Mermaid({ chart }: MermaidProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svgStr, setSvgStr] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    let isMounted = true

    // Generate a unique ID for this mermaid diagram to avoid DOM collisions
    const id = `mermaid-${Math.random().toString(36).substring(2, 11)}`

    const renderDiagram = async () => {
      try {
        const isDark = resolvedTheme === 'dark'

        mermaid.initialize({
          startOnLoad: false,
          theme: 'base',
          securityLevel: 'loose',
          fontFamily:
            'var(--font-sans, Inter, ui-sans-serif, system-ui, sans-serif)',
          themeVariables: isDark
            ? {
                // Dark Theme Variables
                primaryColor: '#1e293b',
                primaryTextColor: '#f8fafc',
                primaryBorderColor: '#334155',
                lineColor: '#94a3b8',
                secondaryColor: '#0f172a',
                tertiaryColor: '#1e293b',
                nodeBorder: '#334155',
                mainBkg: '#0f172a',
                nodeTextColor: '#f8fafc',
                edgeLabelBackground: '#1e293b',
                clusterBkg: '#1e293b',
                clusterBorder: '#334155',
              }
            : {
                // Light Theme Variables
                primaryColor: '#f8fafc',
                primaryTextColor: '#0f172a',
                primaryBorderColor: '#e2e8f0',
                lineColor: '#64748b',
                secondaryColor: '#f1f5f9',
                tertiaryColor: '#ffffff',
                nodeBorder: '#e2e8f0',
                mainBkg: '#ffffff',
                nodeTextColor: '#0f172a',
                edgeLabelBackground: '#f8fafc',
                clusterBkg: '#f8fafc',
                clusterBorder: '#e2e8f0',
              },
          darkMode: isDark,
        })

        const { svg } = await mermaid.render(id, chart)
        if (isMounted) {
          setSvgStr(svg)
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
    }
  }, [chart, resolvedTheme])

  if (error) {
    return (
      <div className="my-6 flex items-center justify-center rounded-lg border border-red-200 bg-red-500/5 p-4 text-sm text-red-600 dark:border-red-900/30 dark:text-red-400">
        {error}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`mermaid-container my-8 flex min-h-[100px] items-center justify-center overflow-auto rounded-xl border border-subtle bg-surface/30 p-8 backdrop-blur-sm transition-colors duration-300 ${
        !svgStr ? 'animate-pulse' : ''
      }`}
      dangerouslySetInnerHTML={{ __html: svgStr }}
    />
  )
}
