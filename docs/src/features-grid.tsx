import { useRef } from 'react'
import { Card, Cards } from 'boltdocs/client'
import { Globe, Monitor, Search, Shield, Zap } from 'lucide-react'
import { useGSAPScroll, useGSAPStaggerIn } from './hooks/useGSAPScroll'

const FEATURES = [
  {
    title: 'Instant Hot Reload',
    description:
      'Experience lightning-fast development with HMR that feels instant. Your documentation updates as you type.',
    icon: <Zap className="w-5 h-5" />,
    color: 'text-yellow-400',
  },
  {
    title: 'Full SEO Control',
    description:
      'Automated sitemaps, Open Graph images, and meta tag generation built directly into the core engine.',
    icon: <Globe className="w-5 h-5" />,
    color: 'text-blue-400',
  },
  {
    title: 'Edge-Optimized Images',
    description:
      'Native image processing at the edge for blazing fast load times regardless of where your users are.',
    icon: <Monitor className="w-5 h-5" />,
    color: 'text-purple-400',
  },
  {
    title: 'Multi-Language Support',
    description:
      'Global-first architecture with built-in i18n support and automated translation workflows out of the box.',
    icon: <Globe className="w-5 h-5" />,
    color: 'text-indigo-400',
  },
  {
    title: 'Built-in Search',
    description:
      'Typo-tolerant, lightning fast search powered by Algolia or local indices with zero configuration.',
    icon: <Search className="w-5 h-5" />,
    color: 'text-pink-400',
  },
  {
    title: 'Secure by Default',
    description:
      'Enterprise-grade security with automated dependency auditing and hardened build pipelines.',
    icon: <Shield className="w-5 h-5" />,
    color: 'text-green-400',
  },
]

export const FeaturesGrid = () => {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const subtitleRef = useRef<HTMLParagraphElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)

  useGSAPScroll(titleRef, { animation: 'fade-up', delay: 0, duration: 0.6 })
  useGSAPScroll(subtitleRef, { animation: 'fade-up', delay: 0.1, duration: 0.6 })
  useGSAPStaggerIn(cardsRef, { stagger: 0.1, duration: 0.5, y: 25 })

  return (
    <section className="py-10 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <h2 ref={titleRef} className="text-2xl md:text-4xl font-black tracking-tighter border-0 text-text-main mb-6 opacity-0">
            Powerful Features
          </h2>
          <p ref={subtitleRef} className="text-on-surface-variant max-w-2xl mx-auto text-xl leading-relaxed opacity-0">
            Everything you need to ship world-class technical documentation at the
            speed of light.
          </p>
        </div>
        <Cards ref={cardsRef} className="md:w-[70%] mx-auto">
          {FEATURES.map((feature) => (
            <Card key={feature.title} title={feature.title} icon={feature.icon}>
              {feature.description}
            </Card>
          ))}
        </Cards>
      </div>
    </section>
  )
}
