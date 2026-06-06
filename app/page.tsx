import IdIntake from './components/IdIntake'
import BrandHeader from './components/BrandHeader'

export default function Home() {
  return (
    <main className="min-h-screen bg-blue-50">
      <BrandHeader subtitle="CMOP Onboarding" />
      <IdIntake />
    </main>
  )
}
