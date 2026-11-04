import { useEffect, useState } from "react"
import { useParams, Link, useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function JobDetails() {
  const { id } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isSaved, setIsSaved] = useState(false)
  const [savingLoading, setSavingLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  // Application State
  const [existingApplication, setExistingApplication] = useState(null)
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [coverNote, setCoverNote] = useState("")
  const [resumeFile, setResumeFile] = useState(null)
  const [applyError, setApplyError] = useState("")
  const [applyLoading, setApplyLoading] = useState(false)
  const [applySuccess, setApplySuccess] = useState(false)

  useEffect(() => {
    async function loadJobDetails() {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from("jobs")
          .select(`
            *,
            company:companies(*)
          `)
          .eq("id", id)
          .single()

        if (error) throw error
        setJob(data)

        // Check if candidate saved this job & check if already applied
        if (user?.id && profile?.role === "candidate") {
          setFullName(profile.full_name || "")

          // Check saved
          const { data: savedData } = await supabase
            .from("saved_jobs")
            .select("id")
            .eq("user_id", user.id)
            .eq("job_id", id)
            .maybeSingle()

          setIsSaved(Boolean(savedData))

          // Check application
          const { data: appData } = await supabase
            .from("applications")
            .select("id, status, created_at")
            .eq("job_id", id)
            .eq("candidate_id", user.id)
            .maybeSingle()

          if (appData) {
            setExistingApplication(appData)
          }
        }
      } catch (err) {
        setErrorMsg(err.message || "Job not found or no longer available.")
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      loadJobDetails()
    }
  }, [id, user, profile])

  const handleToggleSave = async () => {
    if (!user) {
      navigate("/login", { state: { from: location } })
      return
    }
    if (profile?.role !== "candidate") {
      alert("Only candidates can save jobs.")
      return
    }

    setSavingLoading(true)
    try {
      if (isSaved) {
        const { error } = await supabase
          .from("saved_jobs")
          .delete()
          .eq("user_id", user.id)
          .eq("job_id", id)
        if (error) throw error
        setIsSaved(false)
      } else {
        const { error } = await supabase
          .from("saved_jobs")
          .insert({ user_id: user.id, job_id: id })
        if (error) throw error
        setIsSaved(true)
      }
    } catch (err) {
      alert(err.message || "Failed to update saved job.")
    } finally {
      setSavingLoading(false)
    }
  }

  // Handle file selection with client validation
  const handleFileChange = (e) => {
    setApplyError("")
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setApplyError("Invalid file type: Please upload your resume in PDF format.")
      e.target.value = ""
      setResumeFile(null)
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setApplyError("File size exceeds 2 MB limit. Please upload a smaller PDF.")
      e.target.value = ""
      setResumeFile(null)
      return
    }

    setResumeFile(file)
  }

  // Submit Application
  const handleSubmitApplication = async (e) => {
    e.preventDefault()
    setApplyError("")

    if (!user) {
      navigate("/login", { state: { from: location } })
      return
    }

    if (!fullName.trim() || !phone.trim()) {
      setApplyError("Please provide your full name and phone number.")
      return
    }

    if (!resumeFile) {
      setApplyError("Please select a PDF resume file to upload.")
      return
    }

    setApplyLoading(true)
    try {
      // 1. Upload resume to private storage bucket in user's personal directory
      const sanitizedFilename = resumeFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")
      const filePath = `${user.id}/${Date.now()}_${sanitizedFilename}`

      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(filePath, resumeFile, {
          contentType: "application/pdf",
          upsert: false,
        })

      if (uploadError) throw new Error("Resume upload failed: " + uploadError.message)

      // 2. Call atomic apply_to_job RPC
      const { data: appId, error: rpcError } = await supabase.rpc("apply_to_job", {
        p_job_id: id,
        p_full_name: fullName.trim(),
        p_phone: phone.trim(),
        p_cover_note: coverNote.trim() || null,
        p_resume_path: filePath,
      })

      if (rpcError) throw rpcError

      // If NULL was returned (company ran out of credits and jobs were paused)
      if (!appId) {
        setApplyError("This job is not accepting applications right now.")
        setJob((prev) => (prev ? { ...prev, status: "paused" } : prev))
        setShowApplyModal(false)
        return
      }

      setApplySuccess(true)
      setExistingApplication({ id: appId, status: "applied", created_at: new Date().toISOString() })
      setShowApplyModal(false)
    } catch (err) {
      setApplyError(err.message || "Failed to submit application.")
    } finally {
      setApplyLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading job details...</p>
      </div>
    )
  }

  if (errorMsg || !job) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-4">
        <Alert variant="destructive">
          <AlertDescription>{errorMsg || "Job posting could not be found."}</AlertDescription>
        </Alert>
        <Link to="/jobs">
          <Button variant="outline">Back to All Jobs</Button>
        </Link>
      </div>
    )
  }

  const isRecruiterOwner = profile?.role === "recruiter" && job.posted_by === user?.id
  const isJobOpen = job.status === "open"

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6">
      <div>
        <Link to="/jobs" className="text-sm text-muted-foreground hover:underline">
          &larr; Back to all job openings
        </Link>
      </div>

      {applySuccess && (
        <Alert className="border-green-600 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-200">
          <AlertDescription>
            🎉 Your application has been submitted successfully! You can track its progress in your dashboard.
          </AlertDescription>
        </Alert>
      )}

      {/* Header Card */}
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-3xl font-extrabold">{job.title}</CardTitle>
                <Badge variant={job.status === "open" ? "default" : "secondary"}>
                  {job.status === "open" ? "Active" : job.status === "paused" ? "Paused" : "Closed"}
                </Badge>
              </div>
              <p className="text-base text-muted-foreground font-medium">
                {job.company?.name} • 📍 {job.location}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {profile?.role === "candidate" && (
                <Button
                  variant={isSaved ? "secondary" : "outline"}
                  onClick={handleToggleSave}
                  disabled={savingLoading}
                >
                  {isSaved ? "★ Saved" : "☆ Save"}
                </Button>
              )}

              {isRecruiterOwner && (
                <>
                  <Link to={`/dashboard/jobs/${job.id}/applications`}>
                    <Button variant="outline">View Applicants</Button>
                  </Link>
                  <Link to="/dashboard/my-jobs">
                    <Button variant="outline">Manage in My Jobs</Button>
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Badge variant="secondary">💼 Type: {job.job_type.replace("_", " ")}</Badge>
            <Badge variant="outline">🎯 Experience: {job.experience_level} years</Badge>
            {(job.salary_min || job.salary_max) && (
              <Badge variant="outline">
                💰 Salary: {job.salary_min ? `₹${job.salary_min.toLocaleString("en-IN")}` : ""}
                {job.salary_max ? ` - ₹${job.salary_max.toLocaleString("en-IN")}` : ""} / yr
              </Badge>
            )}
            <Badge variant="outline">
              📅 Posted on {new Date(job.created_at).toLocaleDateString()}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content & Company Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">About the Role</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
              {job.description}
            </CardContent>
          </Card>

          {job.requirements && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Candidate Requirements & Skills</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                {job.requirements}
              </CardContent>
            </Card>
          )}

          {/* Application Call-to-action Section */}
          <Card className="border-dashed bg-muted/40">
            <CardContent className="p-6 text-center space-y-4">
              <h3 className="font-semibold text-lg">Interested in this role?</h3>

              {!user ? (
                <div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Sign in with a candidate account to apply directly.
                  </p>
                  <Link to="/login" state={{ from: location }}>
                    <Button>Login to Apply</Button>
                  </Link>
                </div>
              ) : profile?.role === "candidate" ? (
                existingApplication ? (
                  <div className="space-y-2">
                    <Badge className="bg-green-600 text-white hover:bg-green-600 text-sm px-3 py-1">
                      ✓ Already Applied on {new Date(existingApplication.created_at).toLocaleDateString()}
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      Status: <span className="font-semibold capitalize">{existingApplication.status}</span>. View all your submissions in{" "}
                      <Link to="/dashboard/my-applications" className="text-primary underline">
                        My Applications
                      </Link>.
                    </p>
                    <Button disabled variant="outline" className="mt-2">
                      Application Submitted
                    </Button>
                  </div>
                ) : !isJobOpen ? (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-destructive">Applications Closed</p>
                    <p className="text-xs text-muted-foreground">
                      This opening is currently not accepting new applications.
                    </p>
                  </div>
                ) : (
                  <div>
                    {!showApplyModal ? (
                      <Button size="lg" onClick={() => setShowApplyModal(true)}>
                        Apply for this Position
                      </Button>
                    ) : null}
                  </div>
                )
              ) : (
                <p className="text-xs text-muted-foreground">
                  You are viewing this job as an employer (<span className="font-semibold">{profile?.role}</span>). Candidates can submit applications here.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Application Form */}
          {showApplyModal && (
            <Card className="border-primary">
              <CardHeader>
                <CardTitle className="text-lg">Submit Application: {job.title}</CardTitle>
                <CardDescription>
                  Provide your contact details and upload your resume in PDF format (Max 2 MB).
                </CardDescription>
              </CardHeader>
              <CardContent>
                {applyError && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{applyError}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleSubmitApplication} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="app-fullname">Full Name *</Label>
                    <Input
                      id="app-fullname"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="app-phone">Phone Number *</Label>
                    <Input
                      id="app-phone"
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="app-resume">Resume (PDF, Max 2 MB) *</Label>
                    <Input
                      id="app-resume"
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={handleFileChange}
                      required
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Only PDF documents under 2 MB are accepted. Securely stored in your private directory.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="app-note">Cover Note (Optional)</Label>
                    <Textarea
                      id="app-note"
                      placeholder="Highlight relevant projects, key achievements, or why you'd be a great match for this role..."
                      rows={3}
                      value={coverNote}
                      onChange={(e) => setCoverNote(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowApplyModal(false)}
                      disabled={applyLoading}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={applyLoading}>
                      {applyLoading ? "Submitting Application..." : "Submit Application"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right 1 Col: Company Card */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">About {job.company?.name}</CardTitle>
              <CardDescription>📍 {job.company?.location || "Headquarters"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {job.company?.description ? (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {job.company.description}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Verified employer registered on JobPortal.
                </p>
              )}

              {job.company?.website && (
                <div className="pt-2 border-t">
                  <a
                    href={job.company.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline break-all"
                  >
                    🔗 Visit Website
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
