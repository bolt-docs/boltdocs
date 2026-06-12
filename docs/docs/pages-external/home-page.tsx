import { FeaturesGrid } from '../../src/features-grid'
import { Integrations } from '../../src/integrations'
import { CTASection } from '../../src/cta-section'
import { Hero } from '../../src/hero'
import { FeaturedResources } from '../../src/featured-resources'

export default function HomePage() {
  return (
    <div className="font-sans antialiased">
      <Hero />
      <Integrations />
      <FeaturesGrid />
      <FeaturedResources />
      <CTASection />
    </div>
  )
}
