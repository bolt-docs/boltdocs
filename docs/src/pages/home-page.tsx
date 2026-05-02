import { FeaturesGrid } from '../features-grid'
import { CTASection } from '../cta-section'
import { Hero } from '../hero'
import { StatsSection } from '../stats-section'
import { WhyBoltdocs } from '../why-boltdocs'

export default function HomePage() {
  return (
    <div className="font-sans antialiased">
      <Hero />
      {/* <Integrations /> */}
      <StatsSection />
      <FeaturesGrid />
      <WhyBoltdocs />
      <CTASection />
    </div>
  )
}
