import { useEffect, useState } from "react"
import { useParams, Link, useNavigate, useLocation } from "react-router-dom"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { 
  Building2, 
  MapPin, 
  Briefcase, 
  Calendar, 
  CheckCircle2, 
  Bookmark, 
  BookmarkCheck, 
  Upload, 
  X,
  ExternalLink,
  ShieldCheck,
  AlertCircle
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import PageTransition from "@/components/PageTransition"

export default function JobDetails() {
  const { id } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const shouldReduceMotion = useReducedMotion()

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
      <div className="max-w-4xl mx-auto py-6 space-y-6">
        <Skeleton className="h-6 w-32" />
        <Card className="p-6 space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-5 w-1/3" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-32" />
          </div>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card className="p-6 space-y-3">
              <Skeleton className="h-6 w-1/4" />
              <Skeleton className="h-24 w-full" />
            </Card>
          </div>
          <Card className="p-6 space-y-3">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </Card>
        </div>
      </div>
    )
  }

  if (errorMsg || !job) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMsg || "Job posting could not be found."}</AlertDescription>
        </Alert>
        <Link to="/jobs">
          <Button variant="outline">&larr; Back to All Jobs</Button>
        </Link>
      </div>
    )
  }

  const isRecruiterOwner = profile?.role === "recruiter" && job.posted_by === user?.id
  const isJobOpen = job.status === "open"

  return (
    <PageTransition className="max-w-4xl mx-auto py-4 sm:py-6 space-y-6">
      <div>
        <Link
          to="/jobs"
          className="inline-flex items-center text-xs sm:text-sm text-muted-foreground hover:text-foreground font-medium transition-colors"
        >
          &larr; Back to all job openings
        </Link>
      </div>

      {applySuccess && (
        <Alert className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800 ">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 " />
          <AlertDescription>
            🎉 Your application has been submitted successfully! You can track its progress in your dashboard.
          </AlertDescription>
        </Alert>
      )}

      {/* Header Hero Card */}
      <Card className="p-5 sm:p-6 shadow-sm border bg-card">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                {job.title}
              </h1>
              <Badge
                variant={job.status === "open" ? "default" : "secondary"}
                className={job.status === "open" ? "bg-emerald-600 text-white hover:bg-emerald-600" : ""}
              >
                {job.status === "open" ? "Actively Hiring" : job.status === "paused" ? "Paused" : "Closed"}
              </Badge>
            </div>

            <p className="text-sm font-medium text-muted-foreground flex flex-wrap items-center gap-x-2">
              <span className="font-semibold text-foreground flex items-center gap-1">
                <Building2 className="h-4 w-4 text-primary" />
                {job.company?.name}
              </span>
              <span>&bull;</span>
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {job.location}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {profile?.role === "candidate" && (
              <Button
                variant={isSaved ? "secondary" : "outline"}
                size="sm"
                onClick={handleToggleSave}
                disabled={savingLoading}
                className="gap-1.5 h-9"
              >
                {isSaved ? (
                  <>
                    <BookmarkCheck className="h-4 w-4 text-primary fill-primary" />
                    <span>Saved</span>
                  </>
                ) : (
                  <>
                    <Bookmark className="h-4 w-4" />
                    <span>Save Job</span>
                  </>
                )}
              </Button>
            )}

            {isRecruiterOwner && (
              <div className="flex gap-2">
                <Link to={`/dashboard/jobs/${job.id}/applications`}>
                  <Button variant="outline" size="sm" className="h-9">
                    View Applicants
                  </Button>
                </Link>
                <Link to="/dashboard/my-jobs">
                  <Button variant="outline" size="sm" className="h-9">
                    Manage Job
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-4 mt-4 border-t text-xs">
          <Badge variant="secondary" className="capitalize gap-1">
            <Briefcase className="h-3 w-3" />
            {job.job_type.replace("_", " ")}
          </Badge>
          <Badge variant="outline">🎯 {job.experience_level} years experience</Badge>
          {(job.salary_min || job.salary_max) && (
            <Badge variant="outline" className="font-semibold text-emerald-600  bg-emerald-500/5 border-emerald-500/20">
              💰 Salary: {job.salary_min ? `₹${job.salary_min.toLocaleString("en-IN")}` : ""}
              {job.salary_max ? ` - ₹${job.salary_max.toLocaleString("en-IN")}` : ""} / yr
            </Badge>
          )}
          <Badge variant="outline" className="text-muted-foreground gap-1">
            <Calendar className="h-3 w-3" />
            Posted on {new Date(job.created_at).toLocaleDateString()}
          </Badge>
        </div>
      </Card>

      {/* Main Grid: Job Details & Sidebar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-heading font-bold">About the Position</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed whitespace-pre-line text-foreground/80">
              {job.description}
            </CardContent>
          </Card>

          {job.requirements && (
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-heading font-bold">Candidate Requirements & Skills</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-relaxed whitespace-pre-line text-foreground/80">
                {job.requirements}
              </CardContent>
            </Card>
          )}

          {/* Application Call-to-action Section */}
          <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-6 shadow-sm">
            <div className="text-center space-y-3">
              <h3 className="font-heading font-bold text-lg text-foreground">
                Ready to Join {job.company?.name}?
              </h3>

              {!user ? (
                <div className="space-y-3">
                  <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
                    Sign in with a candidate account to upload your resume and apply directly to the hiring team.
                  </p>
                  <Link to="/login" state={{ from: location }}>
                    <Button className="shadow-sm shadow-primary/20">Login to Apply</Button>
                  </Link>
                </div>
              ) : profile?.role === "candidate" ? (
                existingApplication ? (
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-700  font-semibold text-xs border border-emerald-500/30">
                      <CheckCircle2 className="h-4 w-4" />
                      Applied on {new Date(existingApplication.created_at).toLocaleDateString()}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Current Status: <span className="font-bold uppercase text-foreground">{existingApplication.status}</span>.
                      Track your live updates in{" "}
                      <Link to="/dashboard/my-applications" className="text-primary font-semibold underline underline-offset-2">
                        My Applications
                      </Link>.
                    </p>
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
                    <Button
                      size="lg"
                      onClick={() => setShowApplyModal(true)}
                      className="shadow-md shadow-primary/25 h-11 px-8 font-semibold"
                    >
                      Apply Now for this Position &rarr;
                    </Button>
                  </div>
                )
              ) : (
                <p className="text-xs text-muted-foreground">
                  You are viewing this listing as an employer (<span className="font-semibold">{profile?.role}</span>). Candidates can submit applications here.
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* Right Sidebar: Company Card */}
        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-heading font-bold">About {job.company?.name}</CardTitle>
                {job.company?.verification_status === "approved" && (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-600  font-medium">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Verified
                  </span>
                )}
              </div>
              <CardDescription className="text-xs flex items-center gap-1">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                {job.company?.location || "Headquarters"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {job.company?.description ? (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {job.company.description}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Verified employer registered on JobPortal network.
                </p>
              )}

              {job.company?.website && (
                <div className="pt-2 border-t">
                  <a
                    href={job.company.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary font-medium hover:underline break-all flex items-center gap-1"
                  >
                    <span>Visit Company Website</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Animated Modal Dialog for Application */}
      <AnimatePresence>
        {showApplyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !applyLoading && setShowApplyModal(false)}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            />

            {/* Modal Dialog Content */}
            <motion.div
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 12 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl z-10 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-2 border-b">
                <div>
                  <h3 className="font-heading font-bold text-lg text-foreground">
                    Apply: {job.title}
                  </h3>
                  <p className="text-xs text-muted-foreground">{job.company?.name}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => setShowApplyModal(false)}
                  disabled={applyLoading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {applyError && (
                <Alert variant="destructive" className="text-xs py-2">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <AlertDescription>{applyError}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmitApplication} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="app-fullname" className="text-xs font-semibold">
                    Full Name *
                  </Label>
                  <Input
                    id="app-fullname"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="app-phone" className="text-xs font-semibold">
                    Phone Number *
                  </Label>
                  <Input
                    id="app-phone"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="app-resume" className="text-xs font-semibold flex items-center justify-between">
                    <span>Resume (PDF, Max 2 MB) *</span>
                    {resumeFile && (
                      <span className="text-[11px] text-emerald-600  font-medium">
                        ✓ {resumeFile.name}
                      </span>
                    )}
                  </Label>
                  <div className="relative border-2 border-dashed border-input hover:border-primary/50 rounded-xl p-4 text-center cursor-pointer transition-colors bg-muted/20">
                    <input
                      id="app-resume"
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={handleFileChange}
                      required
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <div className="flex flex-col items-center justify-center gap-1.5 pointer-events-none">
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        <Upload className="h-4 w-4" />
                      </div>
                      <p className="text-xs font-medium text-foreground">
                        {resumeFile ? resumeFile.name : "Click to select or drop your PDF resume"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Only PDF documents up to 2 MB. Stored privately and securely.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="app-note" className="text-xs font-semibold">
                    Cover Note (Optional)
                  </Label>
                  <Textarea
                    id="app-note"
                    placeholder="Briefly highlight relevant experience, top skills, or portfolio links..."
                    rows={3}
                    value={coverNote}
                    onChange={(e) => setCoverNote(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 justify-end pt-3 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowApplyModal(false)}
                    disabled={applyLoading}
                    className="text-xs h-9"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={applyLoading} className="text-xs h-9 shadow-sm shadow-primary/20">
                    {applyLoading ? "Submitting Application..." : "Submit Application"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </PageTransition>
  )
}
