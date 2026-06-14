import { useEffect, useRef } from 'react'
import { useConfig } from '../../app/config-context'
import { useTheme } from '../../app/theme-context'
import { cn } from '../../utils/cn'

export interface GiscusProps {
  className?: string
}

export function Giscus({ className }: GiscusProps) {
  const config = useConfig()
  const { resolvedTheme } = useTheme()
  const ref = useRef<HTMLDivElement>(null)
  const initializedRef = useRef(false)

  const giscusConfig = config.integrations?.feedback?.giscus

  useEffect(() => {
    if (!giscusConfig) return

    const theme =
      giscusConfig.theme || (resolvedTheme === 'dark' ? 'dark' : 'light')

    const session = {
      repo: giscusConfig.repo,
      'repo-id': giscusConfig.repoId,
      category: giscusConfig.category,
      'category-id': giscusConfig.categoryId,
      mapping: giscusConfig.mapping || 'pathname',
      strict: String(giscusConfig.strict ?? '0'),
      'reactions-enabled': String(giscusConfig.reactionsEnabled ?? '1'),
      'emit-metadata': String(giscusConfig.emitMetadata ?? '0'),
      'input-position': giscusConfig.inputPosition || 'bottom',
      lang: giscusConfig.lang || 'en',
      loading: giscusConfig.loading || 'lazy',
    }

    if (!initializedRef.current) {
      initializedRef.current = true
      const script = document.createElement('script')
      script.src = 'https://giscus.app/client.js'
      script.setAttribute('data-repo', session.repo)
      script.setAttribute('data-repo-id', session['repo-id'])
      if (session.category) script.setAttribute('data-category', session.category)
      if (session['category-id']) script.setAttribute('data-category-id', session['category-id'])
      script.setAttribute('data-mapping', session.mapping)
      script.setAttribute('data-strict', session.strict)
      script.setAttribute('data-reactions-enabled', session['reactions-enabled'])
      script.setAttribute('data-emit-metadata', session['emit-metadata'])
      script.setAttribute('data-input-position', session['input-position'])
      script.setAttribute('data-lang', session.lang)
      script.setAttribute('data-loading', session.loading)
      script.setAttribute('data-theme', theme)
      script.setAttribute('crossorigin', 'anonymous')
      script.async = true

      if (ref.current) {
        ref.current.appendChild(script)
      }

      return () => {
        initializedRef.current = false
        if (script.parentNode) {
          script.parentNode.removeChild(script)
        }
        const iframes = ref.current?.querySelectorAll('iframe')
        iframes?.forEach((iframe) => iframe.remove())
      }
    }
  }, [giscusConfig])

  useEffect(() => {
    if (!giscusConfig || !initializedRef.current) return

    const theme =
      giscusConfig.theme || (resolvedTheme === 'dark' ? 'dark' : 'light')
    const iframe = ref.current?.querySelector<HTMLIFrameElement>('iframe.giscus-frame')
    if (iframe) {
      iframe.contentWindow?.postMessage(
        { giscus: { setConfig: { theme } } },
        'https://giscus.app',
      )
    }
  }, [resolvedTheme, giscusConfig])

  if (!giscusConfig) return null

  return (
    <div
      ref={ref}
      className={cn(
        'w-full max-w-2xl mt-12 mb-6',
        className,
      )}
    />
  )
}
