import { useState } from "react"
import { Link, NavLink, useNavigate } from "react-router-dom"
import { Briefcase, Menu, X, Sparkles, User, LogOut } from "lucide-react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import NotificationBell from "@/components/NotificationBell"
import ErrorBoundary from "@/components/ErrorBoundary"

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const shouldReduceMotion = useReducedMotion()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navLinkClass = ({ isActive }) =>
    `text-sm font-medium transition-colors hover:text-primary ${
      isActive
        ? "text-primary font-semibold relative after:absolute after:-bottom-[18px] after:left-0 after:right-0 after:h-0.5 after:bg-primary after:rounded-full"
        : "text-muted-foreground"
    }`

  const mobileNavLinkClass = ({ isActive }) =>
    `flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? "bg-primary/10 text-primary font-semibold"
        : "text-foreground/80 hover:bg-muted hover:text-foreground"
    }`

  const handleLogout = async () => {
    setMobileMenuOpen(false)
    await signOut()
    navigate("/login")
  }

  const role = profile?.role
  const adminDisplayName = profile?.full_name?.trim() || "Administrator"
  const userDisplayName =
    role === "admin"
      ? adminDisplayName
      : profile?.full_name || profile?.phone || user?.phone || user?.email || "User"

  const roleBadgeVariants = {
    admin: "bg-red-500/15 text-red-700 border border-red-500/30",
    recruiter: "bg-blue-600/15 text-blue-700 border border-blue-600/30",
    candidate: "bg-emerald-600/15 text-emerald-700 border border-emerald-600/30",
  }

  return (
    <header className="border-b bg-background/90 backdrop-blur-md sticky top-0 z-50 transition-colors">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight group"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-primary to-blue-500 flex items-center justify-center text-primary-foreground shadow-sm shadow-primary/30 group-hover:scale-105 transition-transform duration-200">
            <Briefcase className="h-5 w-5" />
          </div>
          <span className="font-heading bg-gradient-to-r from-foreground via-foreground to-foreground/80 bg-clip-text text-foreground">
            Job<span className="text-primary">Portal</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center space-x-6">
          <NavLink to="/" className={navLinkClass}>
            Home
          </NavLink>
          <NavLink to="/jobs" className={navLinkClass}>
            Jobs
          </NavLink>

          {user && role === "candidate" && (
            <>
              <NavLink to="/dashboard/my-applications" className={navLinkClass}>
                My Applications
              </NavLink>
              <NavLink to="/saved" className={navLinkClass}>
                Saved Jobs
              </NavLink>
            </>
          )}

          {user && role === "recruiter" && (
            <>
              <NavLink to="/jobs/new" className={navLinkClass}>
                Post a Job
              </NavLink>
              <NavLink to="/dashboard/my-jobs" className={navLinkClass}>
                My Jobs
              </NavLink>
              <NavLink to="/dashboard/credits" className={navLinkClass}>
                Credits
              </NavLink>
            </>
          )}

          {user && role === "admin" && (
            <NavLink to="/admin" className={navLinkClass}>
              Admin Panel
            </NavLink>
          )}

          {user && role !== "admin" && (
            <NavLink to="/dashboard" className={navLinkClass}>
              Dashboard
            </NavLink>
          )}
        </nav>

        <div className="hidden md:flex items-center space-x-3">
          {user ? (
            <div className="flex items-center space-x-3 pl-2 border-l">
              <ErrorBoundary compact fallback={<span className="text-xs text-muted-foreground p-1">🔔</span>}>
                <NotificationBell />
              </ErrorBoundary>
              {role && (
                <Badge className={`uppercase text-[10px] font-bold tracking-wider ${roleBadgeVariants[role] || ""}`}>
                  {role}
                </Badge>
              )}
              <span className="text-xs font-medium text-muted-foreground max-w-[130px] truncate" title={userDisplayName}>
                {userDisplayName}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="h-8 text-xs hover:border-destructive hover:text-destructive transition-colors"
              >
                Logout
              </Button>
            </div>
          ) : (
            <div className="flex items-center space-x-2 pl-2 border-l">
              <Link to="/login">
                <Button variant="ghost" size="sm" className="h-9">
                  Login
                </Button>
              </Link>
              <Link to="/signup">
                <Button size="sm" className="h-9 shadow-sm shadow-primary/20">
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  Sign Up
                </Button>
              </Link>
            </div>
          )}
        </div>

        <div className="flex md:hidden items-center space-x-2">
          {user && (
            <ErrorBoundary compact fallback={<span className="text-xs text-muted-foreground p-1">🔔</span>}>
              <NotificationBell />
            </ErrorBoundary>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden border-b bg-background/98 backdrop-blur-lg px-4 pt-2 pb-6 space-y-3 overflow-hidden shadow-lg"
          >
            {user && (
              <div className="flex items-center justify-between pb-3 border-b px-1">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="leading-tight">
                    <p className="text-xs font-semibold truncate max-w-[180px]">
                      {userDisplayName}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase">{role || "User"}</p>
                  </div>
                </div>
                {role && (
                  <Badge className={`uppercase text-[9px] font-bold tracking-wider ${roleBadgeVariants[role] || ""}`}>
                    {role}
                  </Badge>
                )}
              </div>
            )}

            <div className="space-y-1">
              <NavLink to="/" className={mobileNavLinkClass} onClick={() => setMobileMenuOpen(false)}>
                Home
              </NavLink>
              <NavLink to="/jobs" className={mobileNavLinkClass} onClick={() => setMobileMenuOpen(false)}>
                Explore Jobs
              </NavLink>

              {user && role === "candidate" && (
                <>
                  <NavLink to="/dashboard/my-applications" className={mobileNavLinkClass} onClick={() => setMobileMenuOpen(false)}>
                    My Applications
                  </NavLink>
                  <NavLink to="/saved" className={mobileNavLinkClass} onClick={() => setMobileMenuOpen(false)}>
                    Saved Jobs
                  </NavLink>
                </>
              )}

              {user && role === "recruiter" && (
                <>
                  <NavLink to="/jobs/new" className={mobileNavLinkClass} onClick={() => setMobileMenuOpen(false)}>
                    Post a Job
                  </NavLink>
                  <NavLink to="/dashboard/my-jobs" className={mobileNavLinkClass} onClick={() => setMobileMenuOpen(false)}>
                    My Jobs
                  </NavLink>
                  <NavLink to="/dashboard/credits" className={mobileNavLinkClass} onClick={() => setMobileMenuOpen(false)}>
                    Credits
                  </NavLink>
                </>
              )}

              {user && role === "admin" && (
                <NavLink to="/admin" className={mobileNavLinkClass} onClick={() => setMobileMenuOpen(false)}>
                  Admin Panel
                </NavLink>
              )}

              {user && role !== "admin" && (
                <NavLink to="/dashboard" className={mobileNavLinkClass} onClick={() => setMobileMenuOpen(false)}>
                  Dashboard
                </NavLink>
              )}
            </div>

            <div className="pt-3 border-t">
              {user ? (
                <Button
                  variant="outline"
                  className="w-full justify-center gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" className="w-full">
                      Login
                    </Button>
                  </Link>
                  <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>
                    <Button className="w-full">Sign Up</Button>
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}