import { FeaturesGrid } from '../../src/components/sections/features-grid'
import { Integrations } from '../../src/components/sections/integrations'
import { CTASection } from '../../src/components/sections/cta-section'
import { Hero } from '../../src/components/sections/hero'
import { FeaturedResources } from '../../src/components/sections/featured-resources'

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
