import { Link } from 'boltdocs/primitives'
import { useRef } from 'react'
import { useScrollStagger } from '../../src/hooks/useScrollAnimation'
import { Github } from '../../src/components/ui/icons'
import { NoiseOverlay } from '../../src/components/ui/noise-overlay'
import { useTranslations } from '../../src/i18n/index'

export default function AboutPage() {
  const contentRef = useRef<HTMLDivElement>(null)
  const t = useTranslations()

  useScrollStagger(contentRef, { stagger: 0.04 })

  return (
    <div className="font-sans antialiased min-h-screen bg-main text-body flex flex-col justify-start relative">
      <NoiseOverlay />
      <div className="max-w-2xl mx-auto px-6 py-28 md:py-36 w-full grow">
        <div ref={contentRef} className="flex flex-col gap-10">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-primary-400 block mb-3">
              {t.aboutLabel}
            </span>
            <h1 className="text-4xl md:text-5xl font-black text-body tracking-tight leading-tight">
              Boltdocs
            </h1>
            <div className="w-full h-px bg-white/10 mt-8" />
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-body">
              {t.aboutMissionTitle}
            </h2>
            <p className="text-body/75 leading-relaxed text-base md:text-lg">
              {t.aboutMissionDescription}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-body">
              {t.aboutOpenSourceTitle}
            </h2>
            <p className="text-body/75 leading-relaxed text-base md:text-lg">
              {t.aboutOpenSourceDescription}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-body">
              {t.aboutDeveloperTitle}
            </h2>
            <p className="text-body/75 leading-relaxed text-base md:text-lg">
              {t.aboutDeveloperDescription}{' '}
              <strong className="text-body font-bold">
                {t.aboutDeveloperName}
              </strong>
              {t.aboutDeveloperSuffix}
            </p>

            <div className="pt-3">
              <Link
                href="https://github.com/jesusalcaladev"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 text-body font-bold rounded-xl border border-white/10 hover:border-white/20 transition-all duration-300 cursor-pointer text-sm"
              >
                <Github className="w-4.5 h-4.5" /> {t.aboutFollowGithub}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
