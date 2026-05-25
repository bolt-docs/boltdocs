import { FeaturesGrid } from '../../src/features-grid'
import { Integrations } from '../../src/integrations'
import { CTASection } from '../../src/cta-section'
import { Hero } from '../../src/hero'
import { StatsSection } from '../../src/stats-section'
import { WhyBoltdocs } from '../../src/why-boltdocs'
import { BenchmarkSection } from '../../src/benchmark-section'

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
