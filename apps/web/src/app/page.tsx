import { Nav } from './_landing/Nav'
import { Hero } from './_landing/Hero'
import { HowItWorks } from './_landing/HowItWorks'
import { DashboardPreview } from './_landing/DashboardPreview'
import { Privacy } from './_landing/Privacy'
import { ClosingCta } from './_landing/ClosingCta'
import { Footer } from './_landing/Footer'

export default function HomePage() {
  return (
    <div className="landing">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <HowItWorks />
        <DashboardPreview />
        <Privacy />
        <ClosingCta />
      </main>
      <Footer />
    </div>
  )
}
