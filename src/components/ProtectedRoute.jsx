import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"

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

  if (profile && profile.role === null) {
    return <Navigate to="/onboarding" replace />
  }

  return children ? children : <Outlet />
}

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

export function AdminRoute({ children }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Verifying administrator permissions...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (profile && profile.role === null) {
    return <Navigate to="/onboarding" replace />
  }

  if (profile?.role !== "admin") {
    return <Navigate to="/dashboard" replace />
  }

  return children ? children : <Outlet />
}

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
