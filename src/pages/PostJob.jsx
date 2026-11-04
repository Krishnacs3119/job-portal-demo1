import { useEffect, useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function PostJob() {
  const { user } = useAuth()
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

  // Load recruiter's companies
  useEffect(() => {
    async function loadCompanies() {
      try {
        const { data, error } = await supabase.rpc("get_my_companies")
        if (error) {
          // Fallback query if RPC isn't loaded
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
  }, [user])

  // If no company found, redirect to /company/setup
  useEffect(() => {
    if (!checkingCompanies && companies.length === 0) {
      navigate("/company/setup", { replace: true })
    }
  }, [checkingCompanies, companies, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg("")
    setNoticeMsg("")

    if (!title.trim() || !location.trim() || !description.trim()) {
      setErrorMsg("Please fill in title, location, and job description.")
      return
    }

    if (!selectedCompanyId) {
      setErrorMsg("Please select a company to post for.")
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
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Checking company status...</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Post a New Job Opening</CardTitle>
          <CardDescription>
            Reach qualified candidates by providing clear role requirements and compensation details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {noticeMsg && (
            <Alert className="border-amber-500 bg-amber-50 text-amber-900">
              <AlertDescription className="space-y-3">
                <p className="font-semibold">{noticeMsg}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link to="/dashboard/my-jobs" state={{ notice: noticeMsg }}>
                    <Button type="button" size="sm" variant="outline">
                      View My Jobs
                    </Button>
                  </Link>
                  <Link to="/dashboard">
                    <Button type="button" size="sm">
                      Dashboard / Add Credits
                    </Button>
                  </Link>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {errorMsg && (
            <Alert variant="destructive">
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Company selection */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="company-select">Hiring Company *</Label>
                <Link to="/company/setup" className="text-xs text-primary hover:underline">
                  + Add another company
                </Link>
              </div>
              <select
                id="company-select"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                required
              >
                {companies.map((comp) => (
                  <option key={comp.id} value={comp.id}>
                    {comp.name} ({comp.location})
                  </option>
                ))}
              </select>
            </div>

            {/* Job Title */}
            <div className="space-y-2">
              <Label htmlFor="job-title">Job Title *</Label>
              <Input
                id="job-title"
                placeholder="e.g. Senior Frontend Engineer"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {/* Location & Job Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="job-location">Location / Work Mode *</Label>
                <Input
                  id="job-location"
                  placeholder="e.g. Bengaluru, India or Remote"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="job-type">Employment Type *</Label>
                <select
                  id="job-type"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={jobType}
                  onChange={(e) => setJobType(e.target.value)}
                >
                  <option value="full_time">Full-time</option>
                  <option value="part_time">Part-time</option>
                  <option value="internship">Internship</option>
                  <option value="contract">Contract</option>
                  <option value="remote">Remote</option>
                </select>
              </div>
            </div>

            {/* Experience Level & Salary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="experience-level">Experience Required *</Label>
                <select
                  id="experience-level"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                >
                  <option value="fresher">Fresher / Entry level</option>
                  <option value="1-3">1 - 3 Years</option>
                  <option value="3-5">3 - 5 Years</option>
                  <option value="5+">5+ Years</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="salary-min">Min Annual Salary (₹ INR)</Label>
                <Input
                  id="salary-min"
                  type="number"
                  placeholder="e.g. 800000"
                  value={salaryMin}
                  onChange={(e) => setSalaryMin(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="salary-max">Max Annual Salary (₹ INR)</Label>
                <Input
                  id="salary-max"
                  type="number"
                  placeholder="e.g. 1400000"
                  value={salaryMax}
                  onChange={(e) => setSalaryMax(e.target.value)}
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="job-desc">Job Description *</Label>
              <Textarea
                id="job-desc"
                placeholder="Describe key responsibilities, daily workflows, team culture..."
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            {/* Requirements */}
            <div className="space-y-2">
              <Label htmlFor="job-req">Skills & Qualifications</Label>
              <Textarea
                id="job-req"
                placeholder="• 3+ years experience with React and TypeScript&#10;• Experience with database schema design&#10;• Good communication skills"
                rows={4}
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Publishing Job..." : "Publish Job Opening"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
