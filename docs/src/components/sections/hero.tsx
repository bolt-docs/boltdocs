import { Link } from 'boltdocs/primitives'
import { Button } from '@/theme/button'
import { ArrowRight, Copy, Check } from 'lucide-react'
import { getVersion } from '@/data/version'
import { useTranslations } from '@/i18n/index'
import { useState } from 'react'
import { LightRays } from '@/components/effects/light-rays'

export const Hero = () => {
  const t = useTranslations()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText('pnpm create boltdocs@latest')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="relative w-full min-h-[70vh] overflow-hidden px-4 sm:px-6 md:px-12 flex items-center">
      <LightRays
        raysOrigin="top-center"
        raysColor="#fff"
        raysSpeed={0.6}
        lightSpread={1.2}
        rayLength={1.4}
        fadeDistance={1.0}
        followMouse={true}
        mouseInfluence={0.2}
        noiseAmount={0.06}
        distortion={0.03}
        className="absolute h-full inset-0 light-rays-fade-bottom"
      />

      <div className="max-w-5xl mx-auto text-center relative z-10 w-full py-14 sm:py-16 md:py-20">
        <Link
          href="site:/blog/boltdocs-3.3.0"
          className="group inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white font-medium cursor-pointer transition-all duration-300 hover:bg-white/20 hover:border-white/30"
        >
          <span className="text-sm flex items-center gap-2.5">
            {t.heroAvailable}
            <span className="font-mono text-primary-300 flex flex-row gap-1 items-center">
              v{getVersion()}
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </span>
        </Link>

        <h1 className="mt-8 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-body tracking-[-0.03em] leading-[1.08] text-balance">
          {t.heroTitle}{' '}
          <span className="bg-linear-to-r from-primary-300 via-primary-400 to-primary-500 bg-clip-text text-transparent">
            {t.heroTitleHighlight}
          </span>
        </h1>

        <p className="max-w-2xl mx-auto mt-6 text-base sm:text-lg md:text-xl text-paragraph/80 leading-relaxed text-balance">
          {t.heroDescription}
        </p>

        <div className="mt-8 mx-auto w-full flex justify-center">
          <div className="flex flex-row justify-around items-center gap-2.5 px-1 py-1.5 rounded-xl bg-code-bg/80 border border-subtle/50 text-sm font-mono text-body w-full max-w-sm sm:w-auto sm:min-w-96">
            <div className="inline-flex gap-2">
              <span className="text-primary-400 select-none" aria-hidden="true">
                $
              </span>
              <code className="truncate">pnpm create boltdocs@latest</code>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onPress={handleCopy}
              className="rounded-lg hover:bg-subtle/50 shrink-0"
              aria-label={copied ? 'Command copied' : 'Copy command'}
            >
              {copied ? (
                <Check className="size-16 text-success-500" />
              ) : (
                <Copy className="size-16 text-muted" />
              )}
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 mt-6">
          <Link
            href="/docs/guides"
            className="group px-6 py-3.5 bg-primary-500 text-white font-medium rounded-xl flex items-center justify-center gap-2 border border-primary-400/30 hover:brightness-110 transition-all duration-300 sm:hover:scale-[1.03]"
          >
            {t.heroGetStarted}
            <ArrowRight className="size-16 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/docs/api"
            className="px-6 py-3.5 bg-muted/60 backdrop-blur-md text-body font-medium rounded-xl border border-subtle hover:border-strong hover:bg-surface flex items-center justify-center transition-all duration-300 sm:hover:scale-[1.03]"
          >
            {t.heroReadApi}
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-10 md:mt-12 mb-5">
          {t.heroStats.map((s) => (
            <div
              key={s.label}
              className="px-4 sm:px-6 py-5 sm:py-6 rounded-xl border border-subtle/50 bg-surface/40 text-center"
            >
              <div className="text-xl sm:text-2xl font-black text-body tracking-tight">
                {s.value}
              </div>
              <div className="mt-1 text-xs font-medium text-muted tracking-wide">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
