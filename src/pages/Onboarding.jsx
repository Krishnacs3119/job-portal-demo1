import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { UserCheck, Building2, CheckCircle2, ShieldCheck, ArrowRight } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import PageTransition from "@/components/PageTransition"

export default function Onboarding() {
  const { user, profile, setInitialRole } = useAuth()
  const navigate = useNavigate()
  const shouldReduceMotion = useReducedMotion()

  const [selectedRole, setSelectedRole] = useState(null)
  const [errorMsg, setErrorMsg] = useState("")
  const [loading, setLoading] = useState(false)

  const displayName =
    profile?.full_name?.trim() ||
    user?.user_metadata?.full_name?.trim() ||
    user?.user_metadata?.name?.trim() ||
    user?.email?.split("@")[0] ||
    "there"

  const handleConfirm = async () => {
    setErrorMsg("")
    if (!selectedRole || !["candidate", "recruiter"].includes(selectedRole)) {
      setErrorMsg("Please select whether you are a Candidate or a Recruiter.")
      return
    }

    setLoading(true)
    try {
      await setInitialRole(selectedRole)
      if (selectedRole === "candidate") {
        navigate("/jobs", { replace: true })
      } else if (selectedRole === "recruiter") {
        const { data: comps } = await supabase.rpc("get_my_companies")
        if (!comps || comps.length === 0) {
          navigate("/company/setup", { replace: true })
        } else {
          navigate("/dashboard", { replace: true })
        }
      } else {
        navigate("/dashboard", { replace: true })
      }
    } catch (err) {
      setErrorMsg(err.message || "Failed to set role. Please refresh or try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageTransition className="max-w-2xl mx-auto py-8 sm:py-12 pb-28 sm:pb-12 space-y-6">
      <div className="text-center space-y-2">
        <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-foreground">
          Welcome, {displayName}. How will you use JobPortal?
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
          Choose how you plan to use the platform. This selection sets your account permissions.
        </p>
      </div>

      {errorMsg && (
        <Alert variant="destructive" className="text-xs">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div
          whileHover={shouldReduceMotion ? {} : { y: -2 }}
          transition={{ duration: 0.15 }}
          onClick={() => setSelectedRole("candidate")}
        >
          <Card
            className={`cursor-pointer transition-all border-2 h-full ${
              selectedRole === "candidate"
                ? "border-primary bg-primary/[0.04] shadow-md shadow-primary/10 ring-2 ring-primary/20"
                : "border-border hover:border-muted-foreground/40 bg-card"
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <UserCheck className="h-5 w-5" />
                </div>
                {selectedRole === "candidate" && (
                  <span className="flex items-center gap-1 text-[11px] bg-primary text-primary-foreground px-2.5 py-0.5 rounded-full font-bold shadow-sm">
                    <CheckCircle2 className="h-3 w-3" /> Selected
                  </span>
                )}
              </div>
              <CardTitle className="text-lg font-heading font-bold mt-2">
                Job Seeker / Candidate
              </CardTitle>
              <CardDescription className="text-xs">Exploring tech roles and applying</CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2 pt-0">
              <p className="flex items-center gap-1.5">• Search salary-transparent tech roles</p>
              <p className="flex items-center gap-1.5">• 1-click apply with PDF resume</p>
              <p className="flex items-center gap-1.5">• Real-time application status tracking</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          whileHover={shouldReduceMotion ? {} : { y: -2 }}
          transition={{ duration: 0.15 }}
          onClick={() => setSelectedRole("recruiter")}
        >
          <Card
            className={`cursor-pointer transition-all border-2 h-full ${
              selectedRole === "recruiter"
                ? "border-primary bg-primary/[0.04] shadow-md shadow-primary/10 ring-2 ring-primary/20"
                : "border-border hover:border-muted-foreground/40 bg-card"
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  <Building2 className="h-5 w-5" />
                </div>
                {selectedRole === "recruiter" && (
                  <span className="flex items-center gap-1 text-[11px] bg-primary text-primary-foreground px-2.5 py-0.5 rounded-full font-bold shadow-sm">
                    <CheckCircle2 className="h-3 w-3" /> Selected
                  </span>
                )}
              </div>
              <CardTitle className="text-lg font-heading font-bold mt-2">
                Employer / Recruiter
              </CardTitle>
              <CardDescription className="text-xs">Hiring developers and tech talent</CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2 pt-0">
              <p className="flex items-center gap-1.5">• Register your company for verification</p>
              <p className="flex items-center gap-1.5">• Post targeted job listings</p>
              <p className="flex items-center gap-1.5">• Review applicants with credit-based hiring</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t sm:static sm:bg-transparent sm:border-0 sm:p-0 flex flex-col items-center gap-2 z-20">
        <p className="text-xs text-muted-foreground text-center">
          Choose one, then tap Continue
        </p>
        <Button
          size="lg"
          className="w-full sm:w-auto h-11 px-8 text-sm font-semibold shadow-md shadow-primary/25 gap-2"
          onClick={handleConfirm}
          disabled={loading || !selectedRole}
        >
          <span>
            {loading
              ? "Saving role..."
              : selectedRole
              ? `Continue as ${selectedRole === "candidate" ? "Candidate" : "Recruiter"}`
              : "Continue"}
          </span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </PageTransition>
  )
}