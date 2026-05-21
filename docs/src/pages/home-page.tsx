import { FeaturesGrid } from '../features-grid'
import { Integrations } from '../integrations'
import { CTASection } from '../cta-section'
import { Hero } from '../hero'
import { StatsSection } from '../stats-section'
import { WhyBoltdocs } from '../why-boltdocs'
import { BenchmarkSection } from '../benchmark-section'

export default function HomePage() {
  return (
    <div className="font-sans antialiased">
      <Hero />
      <Integrations />
      <StatsSection />
      <FeaturesGrid />
      <WhyBoltdocs />
      <BenchmarkSection />
      <CTASection />
    </div>
  )
}
