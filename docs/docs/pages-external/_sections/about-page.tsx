import { Link } from 'boltdocs/primitives'
import { Github } from '@/theme/icons'
import { HeartHandshake } from 'lucide-react'
import { useTranslations } from '@/i18n/index'

export default function AboutPage() {
  const t = useTranslations()

  return (
    <div className="font-sans antialiased min-h-screen text-body relative overflow-hidden">
      <div className="max-w-4xl mx-auto px-6 md:px-12 py-10 md:py-16 w-full">
        <div className="grid md:grid-cols-2 gap-6 mt-10">
          <div className="p-8">
            <h2 className="text-2xl font-bold tracking-tight text-body mb-3">
              {t.aboutMissionTitle}
            </h2>
            <p className="text-paragraph leading-relaxed">
              {t.aboutMissionDescription}
            </p>
          </div>

          <div className="p-8">
            <h2 className="text-2xl font-bold tracking-tight text-body mb-3">
              {t.aboutOpenSourceTitle}
            </h2>
            <p className="text-paragraph leading-relaxed">
              {t.aboutOpenSourceDescription}
            </p>
          </div>
        </div>

        <div className="p-8 md:p-10 rounded-3xl bg-surface mt-10">
          <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
            <div className="shrink-0 flex items-center justify-center size-20 text-primary-400">
              <HeartHandshake className="w-9 h-9" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold tracking-tight text-body mb-3">
                {t.aboutDeveloperTitle}
              </h2>
              <p className="text-paragraph leading-relaxed">
                {t.aboutDeveloperDescription}{' '}
                <strong className="text-body font-bold">
                  {t.aboutDeveloperName}
                </strong>
                {t.aboutDeveloperSuffix}
              </p>
            </div>
            <div className="shrink-0">
              <Link
                href="https://github.com/jesusalcaladev"
                className="group inline-flex items-center gap-2 px-6 py-3 bg-primary-500/10 hover:bg-primary-500/20 text-body font-semibold rounded-full border border-primary-500/25 hover:border-primary-500/50 transition-all duration-300 text-sm cursor-pointer"
              >
                <Github className="size-24 text-primary-400" />
                {t.aboutFollowGithub}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
