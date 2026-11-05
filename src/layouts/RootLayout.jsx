import { Outlet, useLocation, Navigate } from "react-router-dom"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import ErrorBoundary from "@/components/ErrorBoundary"
import { useAuth } from "@/context/AuthContext"

export default function RootLayout() {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  const isPendingRole = !loading && Boolean(user) && (profile === null || profile.role === null)
  const shouldBounceToOnboarding = isPendingRole && location.pathname !== "/onboarding"

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors selection:bg-brand-orange/20 selection:text-brand-orange">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-7xl">
        <ErrorBoundary>
          {shouldBounceToOnboarding ? (
            <Navigate to="/onboarding" replace />
          ) : (
            <Outlet />
          )}
        </ErrorBoundary>
      </main>
      <Footer />
    </div>
  )
}
