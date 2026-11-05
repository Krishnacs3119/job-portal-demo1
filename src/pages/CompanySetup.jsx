import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Building2, Globe, MapPin, Image, ArrowRight, Shield } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import PageTransition from "@/components/PageTransition"

export default function CompanySetup() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [website, setWebsite] = useState("")
  const [location, setLocation] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [loading, setLoading] = useState(false)

  if (profile?.role === "admin") {
    return (
      <PageTransition className="max-w-xl mx-auto py-12 text-center space-y-4">
        <Card className="p-8 shadow-sm space-y-4 border">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Shield className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-heading font-bold text-foreground">
            Platform Administration
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Admins manage the platform from the Admin Panel
          </p>
          <div className="pt-2">
            <Link to="/admin">
              <Button className="h-9 px-6 font-semibold">
                Go to Admin Panel
              </Button>
            </Link>
          </div>
        </Card>
      </PageTransition>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg("")

    if (!name.trim()) {
      setErrorMsg("Company name is required.")
      return
    }
    if (!location.trim()) {
      setErrorMsg("Company location / headquarters is required.")
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.rpc("setup_company", {
        company_name: name.trim(),
        company_desc: description.trim(),
        company_website: website.trim(),
        company_location: location.trim(),
        company_logo_url: logoUrl.trim() || null,
      })

      if (error) throw error

      navigate("/jobs/new", { replace: true })
    } catch (err) {
      setErrorMsg(err.message || "Failed to create company profile.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageTransition className="max-w-xl mx-auto py-6 sm:py-10">
      <Card className="shadow-lg border bg-card">
        <CardHeader className="space-y-1.5 pb-4">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-1">
            <Building2 className="h-5 w-5" />
          </div>
          <CardTitle className="text-xl sm:text-2xl font-heading font-extrabold tracking-tight">
            Register Your Company
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Set up your employer profile. You will automatically become an administrator of this company account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMsg && (
            <Alert variant="destructive" className="text-xs py-2.5">
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="comp-name" className="text-xs font-semibold">Company Name *</Label>
              <Input
                id="comp-name"
                placeholder="e.g. Acme Corporation"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10 text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="comp-location" className="text-xs font-semibold">Headquarters / Location *</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="comp-location"
                  placeholder="e.g. Bengaluru, India or Remote"
                  className="pl-9 h-10 text-sm"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="comp-website" className="text-xs font-semibold">Website (Optional)</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="comp-website"
                  type="url"
                  placeholder="https://example.com"
                  className="pl-9 h-10 text-sm"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="comp-logo" className="text-xs font-semibold">Logo Image URL (Optional)</Label>
              <div className="relative">
                <Image className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="comp-logo"
                  type="url"
                  placeholder="https://example.com/logo.png"
                  className="pl-9 h-10 text-sm"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="comp-desc" className="text-xs font-semibold">Company Overview</Label>
              <Textarea
                id="comp-desc"
                placeholder="Briefly describe what your company does, your engineering culture, and mission..."
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-xs leading-relaxed"
              />
            </div>

            <Button type="submit" className="w-full h-11 text-sm font-semibold shadow-md shadow-primary/20 gap-2" disabled={loading}>
              <span>{loading ? "Registering..." : "Save Company & Continue to Post Job"}</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </PageTransition>
  )
}