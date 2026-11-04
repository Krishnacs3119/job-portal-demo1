import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"

// Ensures user is logged in and has completed role onboarding
export function ProtectedRoute({ children }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Checking authentication...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // If user hasn't selected a role yet, redirect to onboarding
  if (profile && profile.role === null) {
    return <Navigate to="/onboarding" replace />
  }

  return children ? children : <Outlet />
}

// Role-based route guard for Recruiter / Admin / Candidate protected views
export function RoleRoute({ allowedRoles, children }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Verifying permissions...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (profile && profile.role === null) {
    return <Navigate to="/onboarding" replace />
  }

  if (!allowedRoles.includes(profile?.role)) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 border rounded-lg text-center space-y-4">
        <h2 className="text-xl font-bold text-destructive">Access Restricted</h2>
        <p className="text-sm text-muted-foreground">
          This section requires one of the following roles: {allowedRoles.join(", ")}.
        </p>
        <p className="text-xs text-muted-foreground">
          Your current role is: <span className="font-semibold">{profile?.role || "Unassigned"}</span>
        </p>
      </div>
    )
  }

  return children ? children : <Outlet />
}

// Only accessible when logged out (e.g. Login, Signup)
export function PublicOnlyRoute({ children }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (user) {
    if (profile && profile.role === null) {
      return <Navigate to="/onboarding" replace />
    }
    return <Navigate to="/dashboard" replace />
  }

  return children ? children : <Outlet />
}

// Only accessible if logged in but role is not chosen yet
export function OnboardingRoute({ children }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading onboarding...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (profile && profile.role !== null) {
    return <Navigate to="/dashboard" replace />
  }

  return children ? children : <Outlet />
}
