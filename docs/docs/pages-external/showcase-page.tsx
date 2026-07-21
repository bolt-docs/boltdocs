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
} from 'lucide-react'
import { Link } from 'boltdocs/primitives'
import { useRef, useState, useEffect, useCallback } from 'react'
import {
  useScrollAnimation,
  useScrollStagger,
} from '../../src/hooks/useScrollAnimation'
import { Github } from '../../src/icons'
import { NoiseOverlay } from '../../src/noise-overlay'
import { useTranslations } from '../../src/use-translations'

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
      features: [
        {
          label: t.showcaseFeatures.colorSystem,
          icon: <Palette className="w-4 h-4" />,
        },
        {
          label: t.showcaseFeatures.tablesAndBoxes,
          icon: <Table2 className="w-4 h-4" />,
        },
        {
          label: t.showcaseFeatures.spinners,
          icon: <LoaderCircle className="w-4 h-4" />,
        },
        {
          label: t.showcaseFeatures.progressBars,
          icon: <BarChart3 className="w-4 h-4" />,
        },
        {
          label: t.showcaseFeatures.interactivePrompts,
          icon: <TextCursorInput className="w-4 h-4" />,
        },
        {
          label: t.showcaseFeatures.stepsAndLists,
          icon: <ListChecks className="w-4 h-4" />,
        },
        {
          label: t.showcaseFeatures.keyframeAnimation,
          icon: <KeyRound className="w-4 h-4" />,
        },
      ],
    },
  ]
  return items
}

function ImageCarousel({ images }: { images: string[] }) {
  const [current, setCurrent] = useState(0)
  const [loaded, setLoaded] = useState<Set<number>>(new Set([0]))

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
    <div className="relative w-full overflow-hidden rounded-3xl border border-subtle bg-surface group">
      <div className="relative aspect-video overflow-hidden">
        {images.map((src, i) => (
          <img
            key={src}
            src={src}
            alt={`Showcase image ${i + 1}`}
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
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-black/70 cursor-pointer border-0"
            aria-label="Next image"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
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
  const titleRef = useRef<HTMLHeadingElement>(null)
  const subtitleRef = useRef<HTMLParagraphElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)
  const carouselRef = useRef<HTMLDivElement>(null)
  const t = useTranslations()
  const showcaseItems = ShowcaseItems()

  useScrollAnimation(titleRef, 'fade-up')
  useScrollAnimation(subtitleRef, 'fade-up')
  useScrollStagger(cardsRef, { stagger: 0.1 })
  useScrollAnimation(carouselRef, 'fade-up')

  return (
    <div className="font-sans antialiased min-h-screen bg-main text-body flex flex-col justify-start relative">
      <NoiseOverlay />
      {/* Hero Section */}
      <section className="relative py-20 px-6 w-full overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary-400/15 via-main to-main" />
        </div>

        <div className="max-w-4xl mx-auto text-center">
          <h1
            ref={titleRef}
            className="text-4xl md:text-6xl font-black tracking-tighter text-body mb-6"
          >
            {t.showcaseTitle}
          </h1>
          <p
            ref={subtitleRef}
            className="text-lg md:text-xl text-body/70 max-w-2xl mx-auto leading-relaxed"
          >
            {t.showcaseDescription}
          </p>
        </div>
      </section>

      {/* Showcase Cards */}
      <section className="pb-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div ref={cardsRef} className="flex flex-col gap-16">
            {showcaseItems.map((item) => (
              <div key={item.name}>
                {/* Card Header */}
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
                <div ref={carouselRef} className="mb-8">
                  <ImageCarousel images={item.images} />
                </div>

                {/* Action Links */}
                <div className="flex flex-wrap gap-3 mb-10">
                  <Link
                    href={item.href}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 text-white font-bold rounded-full hover:scale-105 hover:shadow-[0_0_30px_rgba(235,88,40,0.3)] transition-all duration-300 text-sm border-0"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {t.showcaseVisitDocs}
                  </Link>
                  <Link
                    href={item.repo}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 backdrop-blur-md text-body font-bold rounded-full border border-white/10 hover:bg-white/10 hover:scale-105 transition-all duration-300 text-sm"
                  >
                    <Github />
                    {t.showcaseViewGithub}
                  </Link>
                </div>

                {/* Feature Tags */}
                <div className="flex flex-wrap gap-2">
                  {item.features.map((feat) => (
                    <span
                      key={feat.label}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-surface/80 border border-subtle text-body/70"
                    >
                      {feat.icon}
                      {feat.label}
                    </span>
                  ))}
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
            className="inline-flex items-center gap-2 px-8 py-4 bg-white/5 backdrop-blur-md text-body font-bold rounded-full border border-white/10 hover:bg-white/10 hover:scale-105 transition-all duration-300"
          >
            {t.showcaseOpenIssue} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  )
}
