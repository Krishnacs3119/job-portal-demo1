import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { ShieldCheck, CheckCircle2, ArrowLeft } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import PageTransition from "@/components/PageTransition"

export default function ResetPassword() {
  const { updatePasswordAndUnlock } = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [successMsg, setSuccessMsg] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg("")
    setSuccessMsg("")

    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters.")
      return
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.")
      return
    }

    setLoading(true)
    try {
      await updatePasswordAndUnlock(password)
      setSuccessMsg("Password updated successfully! Your account is unlocked.")
      setTimeout(() => {
        navigate("/dashboard", { replace: true })
      }, 1500)
    } catch (err) {
      setErrorMsg(err.message || "Failed to update password. Please make sure the reset link is valid.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageTransition className="max-w-md mx-auto py-8 sm:py-12 space-y-4">
      <div className="flex justify-center">
        <Link to="/" className="inline-block group">
          <img src="/logo.png" alt="Job Pe Charcha" className="h-14 sm:h-16 md:h-20 w-auto object-contain mx-auto transition-transform group-hover:scale-105" />
        </Link>
      </div>
      <Card className="shadow-lg border bg-card/95 backdrop-blur-sm">
        <CardHeader className="space-y-1.5 text-center pb-4">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-1">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <CardTitle className="text-2xl font-heading font-extrabold tracking-tight">
            Set New Password
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Enter a new password for your account to lift any active lockout
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          {errorMsg && (
            <Alert variant="destructive" className="text-xs py-2.5">
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          {successMsg && (
            <Alert className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800  text-xs py-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 " />
              <AlertDescription>{successMsg}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold">New Password *</Label>
              <PasswordInput
                id="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <p className="text-[10px] text-muted-foreground">Minimum 8 characters</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-xs font-semibold">Confirm New Password *</Label>
              <PasswordInput
                id="confirmPassword"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            <Button type="submit" className="w-full h-10 text-sm font-semibold shadow-md shadow-primary/20" disabled={loading}>
              {loading ? "Updating Password..." : "Update Password & Unlock →"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t py-4 bg-muted/20 rounded-b-xl">
          <Link to="/login" className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
          </Link>
        </CardFooter>
      </Card>
    </PageTransition>
  )
}
