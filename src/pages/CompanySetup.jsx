import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function CompanySetup() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [website, setWebsite] = useState("")
  const [location, setLocation] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [loading, setLoading] = useState(false)

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
      const { data, error } = await supabase.rpc("setup_company", {
        company_name: name.trim(),
        company_desc: description.trim(),
        company_website: website.trim(),
        company_location: location.trim(),
        company_logo_url: logoUrl.trim() || null,
      })

      if (error) throw error

      // Company created and recruiter added as member!
      navigate("/jobs/new", { replace: true })
    } catch (err) {
      setErrorMsg(err.message || "Failed to create company profile.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto py-8">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Register Your Company</CardTitle>
          <CardDescription>
            Before posting jobs, set up your company profile. You will automatically become an administrator of this company.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMsg && (
            <Alert variant="destructive">
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="comp-name">Company Name *</Label>
              <Input
                id="comp-name"
                placeholder="e.g. Acme Corporation"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="comp-location">Headquarters / Location *</Label>
              <Input
                id="comp-location"
                placeholder="e.g. Bengaluru, India or Remote"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="comp-website">Website URL</Label>
              <Input
                id="comp-website"
                type="url"
                placeholder="https://example.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="comp-logo">Logo Image URL (Optional)</Label>
              <Input
                id="comp-logo"
                type="url"
                placeholder="https://example.com/logo.png"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="comp-desc">Company Overview</Label>
              <Textarea
                id="comp-desc"
                placeholder="Briefly describe what your company does, your culture, and mission..."
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating Company..." : "Save Company & Continue to Post Job"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
