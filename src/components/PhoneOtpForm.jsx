import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { normalizePhoneNumber, isValidPhoneNumber, formatIndianDisplay } from "@/lib/phoneUtils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function PhoneOtpForm({ mode = "login" }) {
  const { signInWithPhoneOtp, verifyPhoneOtp, setInitialRole } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || "/dashboard"

  const [step, setStep] = useState("phone")
  const [countryCode, setCountryCode] = useState("+91")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [fullName, setFullName] = useState("")
  const [otpToken, setOtpToken] = useState("")
  const [countdown, setCountdown] = useState(0)

  const [selectedRole, setSelectedRole] = useState("candidate")
  const [roleLoading, setRoleLoading] = useState(false)

  const [errorMsg, setErrorMsg] = useState("")
  const [infoMsg, setInfoMsg] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let timer = null
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1)
      }, 1000)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [countdown])

  const fullNormalizedNumber = phoneNumber.startsWith("+")
    ? normalizePhoneNumber(phoneNumber)
    : normalizePhoneNumber(`${countryCode}${phoneNumber.replace(/\D/g, "")}`)

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault()
    setErrorMsg("")
    setInfoMsg("")

    if (!phoneNumber.trim()) {
      setErrorMsg("Please enter your mobile phone number.")
      return
    }

    if (!isValidPhoneNumber(fullNormalizedNumber)) {
      setErrorMsg("Please enter a valid 10-digit mobile number.")
      return
    }

    setLoading(true)
    try {
      const { error } = await signInWithPhoneOtp({
        phone: fullNormalizedNumber,
        fullName: mode === "signup" ? fullName.trim() : undefined,
      })

      if (error) {
        if (error.code === "phone_provider_disabled" || error.message?.includes("Unsupported phone provider")) {
          setErrorMsg(
            "Phone Auth provider is disabled in Supabase. Please enable Phone in Supabase Dashboard (Authentication > Providers > Phone) or configure a Test Phone Number (e.g. +919999999999 with code 123456)."
          )
        } else {
          setErrorMsg(error.message || "Failed to send verification code.")
        }
        return
      }

      setStep("otp")
      setCountdown(60)
      setInfoMsg(`A 6-digit verification code has been sent to ${formatIndianDisplay(fullNormalizedNumber)}.`)
    } catch (err) {
      setErrorMsg(err.message || "An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setErrorMsg("")
    setInfoMsg("")

    const cleanToken = otpToken.replace(/\D/g, "")
    if (cleanToken.length !== 6) {
      setErrorMsg("Please enter the 6-digit verification code.")
      return
    }

    setLoading(true)
    try {
      const { data, error } = await verifyPhoneOtp({
        phone: fullNormalizedNumber,
        token: cleanToken,
      })

      if (error) {
        setErrorMsg(error.message || "Invalid or expired verification code.")
        return
      }

      const verifiedProfile = data?.profile
      if (!verifiedProfile || verifiedProfile.role === null) {
        setStep("role")
      } else if (verifiedProfile.role === "admin") {
        navigate("/admin", { replace: true })
      } else {
        navigate(from, { replace: true })
      }
    } catch (err) {
      setErrorMsg(err.message || "Verification failed.")
    } finally {
      setLoading(false)
    }
  }

  const handleRoleSelection = async () => {
    setErrorMsg("")
    setRoleLoading(true)
    try {
      await setInitialRole(selectedRole)
      navigate("/dashboard", { replace: true })
    } catch (err) {
      setErrorMsg(err.message || "Failed to save account role.")
    } finally {
      setRoleLoading(false)
    }
  }

  if (step === "role") {
    return (
      <div className="space-y-4">
        <div className="text-center space-y-1">
          <h3 className="text-lg font-semibold">Select Your Role</h3>
          <p className="text-xs text-muted-foreground">
            Welcome! Choose how you will use Job Pe Charcha to finish setup.
          </p>
        </div>

        {errorMsg && (
          <Alert variant="destructive">
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-3 pt-2">
          <Card
            className={`cursor-pointer border-2 transition-all p-3 text-center ${
              selectedRole === "candidate" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"
            }`}
            onClick={() => setSelectedRole("candidate")}
          >
            <CardTitle className="text-sm font-semibold">Candidate</CardTitle>
            <CardDescription className="text-xs mt-1">Looking for jobs</CardDescription>
          </Card>

          <Card
            className={`cursor-pointer border-2 transition-all p-3 text-center ${
              selectedRole === "recruiter" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"
            }`}
            onClick={() => setSelectedRole("recruiter")}
          >
            <CardTitle className="text-sm font-semibold">Recruiter</CardTitle>
            <CardDescription className="text-xs mt-1">Hiring talent</CardDescription>
          </Card>
        </div>

        <Button
          type="button"
          className="w-full mt-4"
          onClick={handleRoleSelection}
          disabled={roleLoading}
        >
          {roleLoading ? "Setting up account..." : `Continue as ${selectedRole === "candidate" ? "Candidate" : "Recruiter"}`}
        </Button>
      </div>
    )
  }

  if (step === "otp") {
    return (
      <form onSubmit={handleVerifyOtp} className="space-y-4">
        {infoMsg && (
          <Alert className="border-primary/50 bg-primary/5 text-primary">
            <AlertDescription className="text-xs">{infoMsg}</AlertDescription>
          </Alert>
        )}

        {errorMsg && (
          <Alert variant="destructive">
            <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="otp-input" className="text-xs">Enter 6-digit Code</Label>
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => {
                setStep("phone")
                setOtpToken("")
                setErrorMsg("")
                setInfoMsg("")
              }}
            >
              Change number
            </button>
          </div>

          <Input
            id="otp-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="• • • • • •"
            className="text-center font-mono text-xl tracking-[0.5em] h-12"
            value={otpToken}
            onChange={(e) => setOtpToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
            autoFocus
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading || otpToken.length !== 6}>
          {loading ? "Verifying..." : "Verify & Sign In"}
        </Button>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <span>Didn&apos;t receive code?</span>
          {countdown > 0 ? (
            <span>Resend in {countdown}s</span>
          ) : (
            <button
              type="button"
              className="text-primary font-medium hover:underline"
              onClick={handleSendOtp}
              disabled={loading}
            >
              Resend OTP
            </button>
          )}
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={handleSendOtp} className="space-y-4">
      {errorMsg && (
        <Alert variant="destructive">
          <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
        </Alert>
      )}

      {mode === "signup" && (
        <div className="space-y-2">
          <Label htmlFor="phone-fullname" className="text-xs">Full Name</Label>
          <Input
            id="phone-fullname"
            placeholder="e.g. Rahul Sharma"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="phone-number" className="text-xs">Mobile Number</Label>
        <div className="flex gap-2">
          <select
            className="w-24 rounded-md border border-input bg-background px-2.5 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
          >
            <option value="+91">+91 (IN)</option>
            <option value="+1">+1 (US)</option>
            <option value="+44">+44 (UK)</option>
          </select>

          <Input
            id="phone-number"
            type="tel"
            inputMode="tel"
            placeholder="98765 43210"
            className="flex-1 font-mono text-sm"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            required
            autoComplete="tel"
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Enter your 10-digit Indian mobile number to receive an OTP.
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Sending OTP..." : "Send OTP"}
      </Button>

      <div className="rounded-md bg-muted/40 p-2.5 text-[11px] text-muted-foreground border border-border/50">
        <span className="font-semibold text-foreground">Dev / Testing Tip:</span> Add a test phone number in Supabase (Authentication &gt; Providers &gt; Phone) such as <code className="font-mono text-primary">+919999999999</code> with code <code className="font-mono text-primary">123456</code> to test without SMS gateways.
      </div>
    </form>
  )
}
