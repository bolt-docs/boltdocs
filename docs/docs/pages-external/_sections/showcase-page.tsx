import {
  ArrowRight,
  ExternalLink,
  Terminal,
  Palette,
  ListChecks,
  TextCursorInput,
  LoaderCircle,
  Table2,
  BarChart3,
  KeyRound,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react'
import { Link } from 'boltdocs/primitives'
import { resolvePublicAssetUrl, useConfig } from 'boltdocs/client'
import { useState, useEffect, useCallback } from 'react'
import { Github } from '@/theme/icons'
import { useTranslations } from '@/i18n/index'
import { Section } from '@/theme/section'

function ShowcaseItems() {
  const t = useTranslations()
  const items = [
    {
      name: 'DUI — Terminal UI',
      description:
        'The zero-dependency terminal UI library that powers every Boltdocs CLI. ANSI true-color, boxes, tables, spinners, progress bars, and interactive prompts.',
      href: 'https://dui-terms.vercel.app',
      repo: 'https://github.com/bolt-docs/dui',
      images: ['/showscase-image/dui-1.webp', '/showscase-image/dui-2.webp'],
    },
  ]
  return items
}

function ImageCarousel({ images }: { images: string[] }) {
  const [current, setCurrent] = useState(0)
  const [_loaded, setLoaded] = useState<Set<number>>(new Set([0]))

  const next = useCallback(() => {
    setCurrent((prev) => {
      const nextIdx = (prev + 1) % images.length
      setLoaded((prevLoaded) => new Set(prevLoaded).add(nextIdx))
      return nextIdx
    })
  }, [images.length])

  const prev = useCallback(() => {
    setCurrent((prev) => {
      const prevIdx = (prev - 1 + images.length) % images.length
      setLoaded((prevLoaded) => new Set(prevLoaded).add(prevIdx))
      return prevIdx
    })
  }, [images.length])

  useEffect(() => {
    const timer = setInterval(() => {
      next()
    }, 4000)
    return () => clearInterval(timer)
  }, [next])

  if (images.length === 0) return null

  return (
    <div className="relative w-full overflow-hidden rounded-3xl bg-surface group">
      <div className="relative aspect-video overflow-hidden">
        {images.map((src, i) => (
          <img
            key={src}
            src={src}
            alt={`Showcase ${i + 1}`}
            loading={i === 0 ? 'eager' : 'lazy'}
            onLoad={() => setLoaded((prev) => new Set(prev).add(i))}
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-in-out ${
              i === current
                ? 'opacity-100 scale-100 blur-none'
                : 'opacity-0 scale-105 blur-sm'
            }`}
          />
        ))}
      </div>

      {images.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-black/70 cursor-pointer border-0"
            aria-label="Previous image"
          >
            <ChevronLeft className="size-16" />
          </button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-black/70 cursor-pointer border-0"
            aria-label="Next image"
          >
            <ChevronRight className="size-16" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setCurrent(i)
                  setLoaded((prev) => new Set(prev).add(i))
                }}
                className={`w-2 h-2 rounded-full transition-all duration-300 cursor-pointer border-0 ${
                  i === current
                    ? 'bg-white w-6 shadow-sm'
                    : 'bg-white/40 hover:bg-white/70'
                }`}
                aria-label={`Go to image ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function ShowcasePage() {
  const t = useTranslations()
  const config = useConfig()
  const showcaseItems = ShowcaseItems().map((item) => ({
    ...item,
    images: item.images.map((image) =>
      resolvePublicAssetUrl(image, config.base),
    ),
  }))

  return (
    <Section
      maxWidth="lg"
      className="font-sans antialiased min-h-screen text-body flex flex-col justify-start relative"
    >
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-body mb-6">
          {t.showcaseTitle}
        </h1>
      </div>

      {/* Showcase Cards */}
      <section className="pb-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col gap-16">
            {showcaseItems.map((item) => (
              <div key={item.name}>
                <div className="mb-8">
                  <div className="flex items-center gap-3 mb-3">
                    <Terminal className="w-6 h-6 text-primary-400" />
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-body">
                      {item.name}
                    </h2>
                  </div>
                  <p className="text-body/70 leading-relaxed max-w-3xl">
                    {item.description}
                  </p>
                </div>

                {/* Image Carousel */}
                <div className="mb-8">
                  <ImageCarousel images={item.images} />
                </div>

                {/* Action Links */}
                <div className="flex flex-wrap gap-3  mt-5">
                  <Link
                    href={item.href}
                    className="px-3 py-3 hover:opacity-90 transition-opacity font-semibold bg-primary-500 rounded-full inline-flex gap-2 items-center text-sm"
                  >
                    <ExternalLink className="size-16" />
                    {t.showcaseVisitDocs}
                  </Link>
                  <Link
                    href={item.repo}
                    className="px-3 py-3 hover:opacity-90 transition-opacity font-semibold bg-surface rounded-full inline-flex gap-2 items-center text-sm"
                  >
                    <Github className="size-16" />
                    {t.showcaseViewGithub}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-body mb-4">
            {t.showcaseCtaTitle}
          </h2>
          <p className="text-body/70 mb-8 max-w-xl mx-auto leading-relaxed">
            {t.showcaseCtaDescription}
          </p>
          <Link
            href="https://github.com/jesusalcaladev/boltdocs/issues/new"
            className="inline-flex items-center gap-2 px-5 rounded-full py-2 bg-subtle text-body font-bold hover:scale-105 transition-all duration-300"
          >
            {t.showcaseOpenIssue} <ArrowRight className="size-16" />
          </Link>
        </div>
      </section>
    </Section>
  )
}
