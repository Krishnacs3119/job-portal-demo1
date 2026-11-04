import { Link, NavLink, useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import NotificationBell from "@/components/NotificationBell"

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  const navLinkClass = ({ isActive }) =>
    `text-sm font-medium transition-colors hover:text-primary ${
      isActive ? "text-primary font-semibold" : "text-muted-foreground"
    }`

  const handleLogout = async () => {
    await signOut()
    navigate("/login")
  }

  const role = profile?.role

  const roleBadgeVariants = {
    admin: "bg-red-500 text-white",
    recruiter: "bg-blue-600 text-white",
    candidate: "bg-emerald-600 text-white",
  }

  return (
    <header className="border-b bg-background sticky top-0 z-50">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="text-xl font-bold tracking-tight">
          JobPortal
        </Link>

        <nav className="flex items-center space-x-5">
          <NavLink to="/" className={navLinkClass}>
            Home
          </NavLink>
          <NavLink to="/jobs" className={navLinkClass}>
            Jobs
          </NavLink>

          {user && role === "candidate" && (
            <>
              <NavLink to="/saved" className={navLinkClass}>
                Saved Jobs
              </NavLink>
              <NavLink to="/dashboard/my-applications" className={navLinkClass}>
                My Applications
              </NavLink>
            </>
          )}

          {user && (role === "recruiter" || role === "admin") && (
            <>
              <NavLink to="/jobs/new" className={navLinkClass}>
                Post a Job
              </NavLink>
              <NavLink to="/dashboard/my-jobs" className={navLinkClass}>
                My Jobs
              </NavLink>
            </>
          )}

          {user && (
            <NavLink to="/dashboard" className={navLinkClass}>
              Dashboard
            </NavLink>
          )}

          {user ? (
            <div className="flex items-center space-x-3 pl-2 border-l">
              <NotificationBell />
              {role && (
                <Badge className={`uppercase text-[10px] tracking-wider ${roleBadgeVariants[role] || ""}`}>
                  {role}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground hidden sm:inline max-w-[130px] truncate">
                {profile?.full_name || user.email}
              </span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Login
                </Button>
              </Link>
              <Link to="/signup">
                <Button size="sm">Sign Up</Button>
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}
