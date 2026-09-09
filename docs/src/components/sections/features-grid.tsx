import {
  ImageDown,
  Languages,
  Palette,
  Search,
  Library,
  Stethoscope,
} from 'lucide-react'
import { useTranslations } from '@/i18n/index'
import { MagicBento } from '@/components/effects/magic-bento'
import type { BentoCardData } from '@/components/effects/magic-bento'
import { Section } from '@/theme'

const FEATURES: BentoCardData[] = [
  {
    icon: ImageDown,
    label: 'Optimization',
    title: 'Image Optimization',
    description:
      'Every image is compressed automatically at build time with Sharp and SVGO — AVIF, WebP, PNG and JPEG with zero config.',
  },
  {
    icon: Languages,
    label: 'Localization',
    title: 'i18n & Versioning',
    description:
      'Ship docs in multiple locales with automatic fallbacks, version-based routing, and localized navigation.',
  },
  {
    icon: Palette,
    label: 'Framework',
    title: 'CSS Agnostic',
    description:
      'Bring your own styling — Tailwind, UnoCSS, Sass or plain CSS. The engine stays out of your design system.',
  },
  {
    icon: Search,
    label: 'Ranking',
    title: 'SEO Ready',
    description:
      'Automatic Open Graph images, sitemaps, structured data, and meta tags. Every page SEO-ready from line one.',
  },
  {
    icon: Library,
    label: 'Content',
    title: 'Collections',
    description:
      'Group posts into rich collections with dates, tags, authors and typed frontmatter-driven metadata.',
  },
  {
    icon: Stethoscope,
    label: 'Health',
    title: 'Doctor & Audit',
    description:
      'Deep diagnostics, dependency auditing, and hardened build checks surface problems before every deploy.',
  },
]

export const FeaturesGrid = () => {
  const t = useTranslations()

  return (
    <Section maxWidth="lg" className="relative">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-5xl font-black tracking-tighter text-body">
          {t.featuresTitle}
        </h2>
        <p className="max-w-2xl mx-auto text-lg leading-relaxed text-paragraph mt-2">
          {t.featuresDescription}
        </p>
      </div>

      <MagicBento
        variant="featured"
        data={FEATURES}
        textAutoHide
        enableStars
        enableSpotlight
        enableBorderGlow
        clickEffect
        enableMagnetism
        spotlightRadius={200}
        particleCount={12}
        glowColor="61, 139, 250"
        enableTilt
      />
    </Section>
  )
}
