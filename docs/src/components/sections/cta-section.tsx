import { Grainient } from '../ui/grainient'
import { Link } from 'boltdocs/primitives'
import { Github } from '../ui/icons'
import { useTranslations } from '../../i18n/index'
import { color_active_version } from '../../color'

export const CTASection = () => {
  const t = useTranslations()

  return (
    <section className="relative overflow-hidden w-full h-[70dvh]">
      <Grainient
        className="-z-10"
        {...color_active_version}
        animated={false}
        timeSpeed={0.25}
        colorBalance={0}
        warpStrength={1}
        warpFrequency={5}
        warpSpeed={2}
        warpAmplitude={50}
        blendAngle={0}
        blendSoftness={0.05}
        rotationAmount={500}
        noiseScale={2}
        grainAmount={0.1}
        grainScale={2}
        grainAnimated={false}
        contrast={1.5}
        gamma={1}
        saturation={1}
        centerX={0}
        centerY={0}
        zoom={0.9}
      />

      {/* CTA Content Area */}
      <div className="relative z-10 pt-20 pb-20 px-6 w-full h-full flex items-center">
        <div className="max-w-3xl mx-auto text-center">
          <div>
            <h2 className="text-3xl md:text-5xl font-black text-white border-0 mb-6 leading-[1.2] tracking-tight">
              {t.ctaTitle} <br className="hidden md:block" />
              {t.ctaTitleHighlight}
            </h2>

            <p className="text-base md:text-lg text-white/70 mb-10 max-w-xl mx-auto leading-relaxed font-medium">
              {t.ctaDescription}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
              <Link
                href="/docs/guides"
                className="px-8 py-4 bg-white text-black font-bold rounded-full flex items-center justify-center border-0"
              >
                {t.ctaGetStarted}
              </Link>
              <Link
                href="https://github.com/jesusalcaladev/boltdocs"
                className="px-8 py-4 bg-white/5 backdrop-blur-md text-white font-bold rounded-full border border-white/20 flex items-center justify-center gap-2"
              >
                <Github /> GitHub
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
