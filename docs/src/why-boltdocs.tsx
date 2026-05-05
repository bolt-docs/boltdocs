import { useRef } from 'react'
import { Check, MoveRight } from 'lucide-react'
import { useGSAPScroll, useGSAPStaggerIn } from './hooks/useGSAPScroll'

const DIFFERENTIATORS = [
  {
    title: 'Zero Configuration',
    description: 'Start in seconds. No complex setup, no boilerplate. Just write your docs.',
  },
  {
    title: 'Full SEO Out of the Box',
    description: 'Auto-generated sitemaps, Open Graph images, and meta tags without extra work.',
  },
  {
    title: 'Built-in Local Search',
    description: 'Typo-tolerant FlexSearch, no external services required, works offline.',
  },
  {
    title: 'Edge-Optimized Images',
    description: 'Automatic optimization at build time for blazing fast loads globally.',
  },
  {
    title: 'First-Class MDX Support',
    description: 'Use React components inside your markdown. Interactive docs made easy.',
  },
  {
    title: 'Type-Safe by Default',
    description: 'Built with TypeScript from the ground up. Full type safety guaranteed.',
  },
]

export const WhyBoltdocs = () => {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const subtitleRef = useRef<HTMLParagraphElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)

  useGSAPScroll(titleRef, { animation: 'fade-up', delay: 0, duration: 0.6 })
  useGSAPScroll(subtitleRef, { animation: 'fade-up', delay: 0.1, duration: 0.6 })
  useGSAPStaggerIn(cardsRef, { stagger: 0.08, duration: 0.5, y: 30 })

  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 ref={titleRef} className="text-2xl md:text-4xl font-black text-text mb-4 opacity-0">
            Why Boltdocs?
          </h2>
          <p ref={subtitleRef} className="text-lg text-on-surface-variant max-w-2xl mx-auto opacity-0">
            Built for developers who value speed, simplicity, and beautiful documentation.
          </p>
        </div>

        <div ref={cardsRef} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {DIFFERENTIATORS.map((item, idx) => (
            <div
              key={idx}
              className="group p-6 rounded-2xl bg-surface border border-white/5 hover:border-primary-400/20 transition-all duration-300"
            >
              <div className="flex items-start gap-4">
                <div className="shrink-0 p-2 rounded-lg bg-primary-500/10 text-primary-400 group-hover:bg-primary-500/20 group-hover:scale-110 transition-all duration-300">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-body mb-2 group-hover:text-primary-400 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <a
            href="/docs/guides/overview/introduction"
            className="inline-flex items-center gap-2 text-primary-400 font-semibold hover:gap-3 transition-all group"
          >
            Get started in 30 seconds
            <MoveRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </a>
        </div>
      </div>
    </section>
  )
}