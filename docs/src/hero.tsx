import { Link } from 'boltdocs/primitives'
import { ArrowRight } from 'lucide-react'
import { Grainient } from './grainient'
import { getVersion } from './data/version'
import { useTranslations } from './use-translations'
import { color_active_version } from './color'

export const Hero = () => {
  const t = useTranslations()
  return (
    <section className="relative py-20 px-6 w-full overflow-hidden min-h-[80dvh] flex items-center">
      <Grainient
        className="-z-10 inset-0"
        {...color_active_version}
        animated={false}
        blendAngle={45}
        blendSoftness={0.15}
        noiseScale={3}
        zoom={0.8}
        grainAmount={0.05}
        contrast={1.3}
      />

      <div className="max-w-4xl mx-auto text-center relative z-10 w-full">
        <Link
          href="site:/blog/boltdocs-3.1.0"
          className="inline-flex items-center gap-3 p-1 pr-4 rounded-full bg-neutral-950/70 border border-neutral-700 cursor-pointer mb-10 backdrop-blur-sm"
        >
          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-black bg-white">
            v{getVersion()}
          </span>
          <span className="text-sm font-bold text-white/70 flex items-center gap-2">
            {t.heroAvailable}
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>

        <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white tracking-tighter mb-8 leading-tight drop-shadow-lg">
          {t.heroTitle} <br className="hidden md:block" />
          <span className="bg-linear-to-r from-white/90 via-white to-white/90 bg-clip-text text-transparent drop-shadow-sm">
            {t.heroTitleHighlight}
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-base md:text-xl text-white/70 mb-10 leading-relaxed font-medium drop-shadow-sm">
          {t.heroDescription}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/docs/guides"
            className="px-8 py-4 bg-white text-black font-bold rounded-full flex items-center justify-center border-0"
          >
            {t.heroGetStarted} <ArrowRight className="w-5 h-5 ml-2" />
          </Link>
          <Link
            href="/docs/api"
            className="px-8 py-4 bg-white/10 backdrop-blur-md text-white font-bold rounded-full border border-white/20 flex items-center justify-center"
          >
            {t.heroReadApi}
          </Link>
        </div>
      </div>
    </section>
  )
}
