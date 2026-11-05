import { useEffect, useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Briefcase, AlertTriangle, ArrowLeft, Shield } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import PageTransition from "@/components/PageTransition"

export default function PostJob() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [companies, setCompanies] = useState([])
  const [checkingCompanies, setCheckingCompanies] = useState(true)
  const [selectedCompanyId, setSelectedCompanyId] = useState("")

  const [title, setTitle] = useState("")
  const [location, setLocation] = useState("")
  const [jobType, setJobType] = useState("full_time")
  const [experienceLevel, setExperienceLevel] = useState("1-3")
  const [salaryMin, setSalaryMin] = useState("")
  const [salaryMax, setSalaryMax] = useState("")
  const [description, setDescription] = useState("")
  const [requirements, setRequirements] = useState("")

  const [errorMsg, setErrorMsg] = useState("")
  const [noticeMsg, setNoticeMsg] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function loadCompanies() {
      if (profile?.role === "admin") {
        setCheckingCompanies(false)
        return
      }

      try {
        const { data, error } = await supabase.rpc("get_my_companies")
        if (error) {
          const { data: memberData } = await supabase
            .from("company_members")
            .select("company:companies(*)")
            .eq("user_id", user?.id)

          const list = memberData?.map((m) => m.company).filter(Boolean) || []
          setCompanies(list)
          if (list.length > 0) setSelectedCompanyId(list[0].id)
        } else {
          setCompanies(data || [])
          if (data && data.length > 0) setSelectedCompanyId(data[0].id)
        }
      } catch (err) {
        console.error("Error fetching recruiter companies:", err)
      } finally {
        setCheckingCompanies(false)
      }
    }

    if (user?.id) {
      loadCompanies()
    }
  }, [user, profile?.role])

  useEffect(() => {
    if (!checkingCompanies && companies.length === 0 && profile?.role !== "admin") {
      navigate("/company/setup", { replace: true })
    }
  }, [checkingCompanies, companies, profile?.role, navigate])

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

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId)
  const isVerified = selectedCompany
    ? selectedCompany.verification_status === "approved"
    : false

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg("")
    setNoticeMsg("")

    if (!selectedCompanyId) {
      setErrorMsg("Please select a company to post for.")
      return
    }

    if (!isVerified) {
      setErrorMsg("Your company must be verified by an administrator before publishing job openings.")
      return
    }

    if (!title.trim() || !location.trim() || !description.trim()) {
      setErrorMsg("Please fill in title, location, and job description.")
      return
    }

    const minSalary = salaryMin ? parseInt(salaryMin, 10) : null
    const maxSalary = salaryMax ? parseInt(salaryMax, 10) : null

    if (minSalary && maxSalary && minSalary > maxSalary) {
      setErrorMsg("Minimum salary cannot exceed maximum salary.")
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("jobs")
        .insert({
          company_id: selectedCompanyId,
          posted_by: user.id,
          title: title.trim(),
          location: location.trim(),
          job_type: jobType,
          experience_level: experienceLevel,
          salary_min: minSalary,
          salary_max: maxSalary,
          description: description.trim(),
          requirements: requirements.trim(),
          status: "open",
        })
        .select()
        .single()

      if (error) throw error

      if (data?.status === "paused") {
        setNoticeMsg("Your job is saved but not visible to candidates until credits are added")
        setTitle("")
        setLocation("")
        setDescription("")
        setRequirements("")
        setSalaryMin("")
        setSalaryMax("")
        window.scrollTo({ top: 0, behavior: "smooth" })
      } else {
        navigate("/dashboard/my-jobs", { replace: true })
      }
    } catch (err) {
      setErrorMsg(err.message || "Failed to publish job.")
    } finally {
      setLoading(false)
    }
  }

  if (checkingCompanies) {
    return (
      <div className="max-w-2xl mx-auto py-8 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <PageTransition className="max-w-2xl mx-auto py-6 sm:py-8 space-y-4">
      <div>
        <Link
          to="/dashboard/my-jobs"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to My Job Postings
        </Link>
      </div>

      {!isVerified && (
        <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 text-xs py-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <AlertDescription className="space-y-2">
            <p className="font-semibold text-sm">Company verification pending approval</p>
            <p className="text-xs">
              {selectedCompany ? selectedCompany.name : "Your company"} is currently marked as{" "}
              <strong>{selectedCompany?.verification_status || "pending"}</strong>. Only approved employer organizations are permitted to publish active job openings.
            </p>
            <div className="pt-2 flex flex-wrap gap-2">
              <Link to="/dashboard">
                <Button variant="outline" size="sm" className="h-8 text-xs font-semibold">
                  ← Back to Dashboard
                </Button>
              </Link>
              <Link to="/dashboard/credits">
                <Button variant="default" size="sm" className="h-8 text-xs font-semibold">
                  Buy credits
                </Button>
              </Link>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {!isVerified ? (
        <Card className="shadow-lg border bg-card p-6 sm:p-8 text-center space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-heading font-semibold text-foreground">
              Employer Verification Required
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
              You cannot post jobs until your company is verified by an administrator. Please check back once approval is granted.
            </p>
          </div>
          <div className="pt-2 flex flex-wrap justify-center gap-2">
            <Link to="/dashboard">
              <Button variant="outline" size="sm" className="h-9 px-4 font-semibold">
                Back to Dashboard
              </Button>
            </Link>
            <Link to="/dashboard/credits">
              <Button size="sm" className="h-9 px-4 font-semibold">
                Buy credits
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <Card className="shadow-lg border bg-card">
          <CardHeader className="space-y-1.5 pb-4">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Briefcase className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-xl sm:text-2xl font-heading font-extrabold tracking-tight">
                  Publish a New Job Opening
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Provide clear role responsibilities and transparent compensation details.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {noticeMsg && (
              <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 text-xs py-2.5">
                <AlertDescription className="space-y-2">
                  <p className="font-semibold">{noticeMsg}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Link to="/dashboard/my-jobs" state={{ notice: noticeMsg }}>
                      <Button type="button" size="sm" variant="outline" className="h-7 text-xs">
                        View My Jobs
                      </Button>
                    </Link>
                    <Link to="/dashboard/credits">
                      <Button type="button" size="sm" className="h-7 text-xs font-semibold">
                        Buy credits
                      </Button>
                    </Link>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {errorMsg && (
              <Alert variant="destructive" className="text-xs py-2.5">
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="company-select" className="text-xs font-semibold">Hiring Company *</Label>
                  <Link to="/company/setup" className="text-xs text-primary font-medium hover:underline">
                    + Add another company
                  </Link>
                </div>
                <select
                  id="company-select"
                  className="w-full rounded-lg border border-input bg-background px-3 h-10 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  required
                >
                  {companies.map((comp) => (
                    <option key={comp.id} value={comp.id}>
                      {comp.name} ({comp.location}) [{comp.verification_status || "pending"}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="job-title" className="text-xs font-semibold">Job Title *</Label>
                <Input
                  id="job-title"
                  placeholder="e.g. Senior Full-Stack Developer"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-10 text-sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="job-loc" className="text-xs font-semibold">Location *</Label>
                <Input
                  id="job-loc"
                  placeholder="e.g. Bangalore, India (or Remote)"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="h-10 text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="job-type" className="text-xs font-semibold">Job Type *</Label>
                  <select
                    id="job-type"
                    className="w-full rounded-lg border border-input bg-background px-3 h-10 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    value={jobType}
                    onChange={(e) => setJobType(e.target.value)}
                  >
                    <option value="full_time">Full-time</option>
                    <option value="part_time">Part-time</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                    <option value="remote">Remote</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="job-exp" className="text-xs font-semibold">Experience Level *</Label>
                  <select
                    id="job-exp"
                    className="w-full rounded-lg border border-input bg-background px-3 h-10 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    value={experienceLevel}
                    onChange={(e) => setExperienceLevel(e.target.value)}
                  >
                    <option value="fresher">Fresher (0 years)</option>
                    <option value="1-3">1 - 3 years</option>
                    <option value="3-5">3 - 5 years</option>
                    <option value="5+">5+ years</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="salary-min" className="text-xs font-semibold">Minimum Salary (₹ PA)</Label>
                  <Input
                    id="salary-min"
                    type="number"
                    placeholder="e.g. 1200000"
                    value={salaryMin}
                    onChange={(e) => setSalaryMin(e.target.value)}
                    className="h-10 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">In INR per annum (optional)</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="salary-max" className="text-xs font-semibold">Maximum Salary (₹ PA)</Label>
                  <Input
                    id="salary-max"
                    type="number"
                    placeholder="e.g. 2000000"
                    value={salaryMax}
                    onChange={(e) => setSalaryMax(e.target.value)}
                    className="h-10 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">In INR per annum (optional)</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="job-desc" className="text-xs font-semibold">Job Description *</Label>
                <Textarea
                  id="job-desc"
                  placeholder="Detail core day-to-day responsibilities, scope, tech stack, and goals..."
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="text-xs leading-relaxed"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="job-req" className="text-xs font-semibold">Qualifications & Requirements (Optional)</Label>
                <Textarea
                  id="job-req"
                  placeholder="Specific requirements, education, key tool competencies..."
                  rows={3}
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  className="text-xs leading-relaxed"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <Button type="submit" className="h-11 flex-1 font-semibold text-sm shadow-md shadow-primary/20" disabled={loading}>
                  {loading ? "Publishing Job..." : "Publish Job Opening →"}
                </Button>
                <Link to="/dashboard/my-jobs">
                  <Button type="button" variant="outline" className="h-11 w-full sm:w-auto text-xs">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </PageTransition>
  )
}