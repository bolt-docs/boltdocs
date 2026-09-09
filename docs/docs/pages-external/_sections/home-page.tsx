import { FeaturesGrid } from '@/components/sections/features-grid'
import { Integrations } from '@/components/sections/integrations'
import { Hero } from '@/components/sections/hero'
import { FeaturedResources } from '@/components/sections/featured-resources'

export default function HomePage() {
  return (
    <div className="font-sans antialiased">
      <Hero />
      <Integrations />
      <FeaturesGrid />
      <FeaturedResources />
    </div>
  )
}
