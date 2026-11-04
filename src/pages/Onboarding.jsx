import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function Onboarding() {
  const { profile, setInitialRole } = useAuth()
  const navigate = useNavigate()

  const [selectedRole, setSelectedRole] = useState("candidate")
  const [errorMsg, setErrorMsg] = useState("")
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setErrorMsg("")
    if (!selectedRole || !["candidate", "recruiter"].includes(selectedRole)) {
      setErrorMsg("Please select whether you are a Candidate or a Recruiter.")
      return
    }

    setLoading(true)
    try {
      await setInitialRole(selectedRole)
      navigate("/dashboard", { replace: true })
    } catch (err) {
      setErrorMsg(err.message || "Failed to set role. Please refresh or try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto py-12 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight">Welcome to Job Portal</h1>
        <p className="text-muted-foreground">
          {profile?.full_name ? `Hi ${profile.full_name}, ` : ""}please choose how you plan to use the portal.
          This selection is permanent.
        </p>
      </div>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Candidate Option */}
        <Card
          className={`cursor-pointer transition-all border-2 ${
            selectedRole === "candidate"
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground/50"
          }`}
          onClick={() => setSelectedRole("candidate")}
        >
          <CardHeader>
            <CardTitle className="text-xl flex items-center justify-between">
              <span>Candidate</span>
              {selectedRole === "candidate" && (
                <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-normal">
                  Selected
                </span>
              )}
            </CardTitle>
            <CardDescription>Looking for job opportunities</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• Explore verified company job listings</p>
            <p>• Bookmark and save jobs for later</p>
            <p>• Apply with resume and track status</p>
          </CardContent>
        </Card>

        {/* Recruiter Option */}
        <Card
          className={`cursor-pointer transition-all border-2 ${
            selectedRole === "recruiter"
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground/50"
          }`}
          onClick={() => setSelectedRole("recruiter")}
        >
          <CardHeader>
            <CardTitle className="text-xl flex items-center justify-between">
              <span>Recruiter</span>
              {selectedRole === "recruiter" && (
                <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-normal">
                  Selected
                </span>
              )}
            </CardTitle>
            <CardDescription>Hiring talent for companies</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• Post and manage job openings</p>
            <p>• Review candidate applications</p>
            <p>• Update application statuses (Shortlisted, Hired, etc.)</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center pt-4">
        <Button size="lg" className="px-8" onClick={handleConfirm} disabled={loading}>
          {loading ? "Saving role..." : `Continue as ${selectedRole === "candidate" ? "Candidate" : "Recruiter"}`}
        </Button>
      </div>
    </div>
  )
}
