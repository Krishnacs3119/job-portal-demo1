import { useState } from "react"
import { Link } from "react-router-dom"
import { KeyRound, Mail, ArrowLeft, CheckCircle2 } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import PageTransition from "@/components/PageTransition"

export default function ForgotPassword() {
  const { resetPasswordForEmail } = useAuth()
  const [email, setEmail] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [successMsg, setSuccessMsg] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg("")
    setSuccessMsg("")

    if (!email) {
      setErrorMsg("Please enter your registered email address.")
      return
    }

    setLoading(true)
    try {
      const { error } = await resetPasswordForEmail(email.trim().toLowerCase())
      if (error) {
        setErrorMsg(error.message)
      } else {
        setSuccessMsg(
          "Password reset link sent! Check your email inbox. Following the link will also unlock your account immediately if it was locked."
        )
      }
    } catch (err) {
      setErrorMsg(err.message || "Failed to send reset email.")
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
            <KeyRound className="h-5 w-5" />
          </div>
          <CardTitle className="text-2xl font-heading font-extrabold tracking-tight">
            Forgot Password
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Enter your email to receive a secure password reset link
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
              <Label htmlFor="email" className="text-xs font-semibold">Registered Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  className="pl-9 h-10 text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-10 text-sm font-semibold shadow-md shadow-primary/20" disabled={loading}>
              {loading ? "Sending reset link..." : "Send Reset Link →"}
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
