import { Outlet, Link, useLocation, Navigate } from "react-router-dom"
import Navbar from "@/components/Navbar"
import ErrorBoundary from "@/components/ErrorBoundary"
import { useAuth } from "@/context/AuthContext"
import { Briefcase, ShieldCheck, Heart } from "lucide-react"

const CURRENT_YEAR = new Date().getFullYear()

export default function RootLayout() {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  const isPendingRole = !loading && Boolean(user) && (profile === null || profile.role === null)
  const shouldBounceToOnboarding = isPendingRole && location.pathname !== "/onboarding"

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors selection:bg-primary/20 selection:text-primary">
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
      <footer className="border-t bg-card/60 backdrop-blur-sm mt-12 py-8 text-sm text-muted-foreground transition-colors">
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Briefcase className="h-3.5 w-3.5" />
              </div>
              <span className="font-semibold text-foreground">JobPortal</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">&bull; India&apos;s Verified Tech Job Network</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-xs">
              <Link to="/jobs" className="hover:text-foreground transition-colors">
                Browse Jobs
              </Link>
              <Link to="/login" className="hover:text-foreground transition-colors">
                Employer Sign In
              </Link>
              <div className="flex items-center gap-1 text-emerald-600">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Verified Recruiters</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <span>&copy; {CURRENT_YEAR} JobPortal. Crafted with</span>
              <Heart className="h-3 w-3 text-red-500 fill-red-500 inline" />
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}