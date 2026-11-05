import { useEffect, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { 
  Building2, 
  MapPin, 
  Briefcase, 
  PlusCircle, 
  Edit3, 
  Trash2, 
  X, 
  CheckCircle2, 
  Inbox,
  AlertTriangle,
  RotateCcw,
  Shield
} from "lucide-react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import PageTransition from "@/components/PageTransition"

export default function MyJobs() {
  const { user, profile } = useAuth()
  const location = useLocation()
  const shouldReduceMotion = useReducedMotion()

  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState("")
  const [noticeMsg, setNoticeMsg] = useState(location.state?.notice || "")
  const [actionLoadingId, setActionLoadingId] = useState(null)

  const [editingJob, setEditingJob] = useState(null)
  const [editTitle, setEditTitle] = useState("")
  const [editLocation, setEditLocation] = useState("")
  const [editSalaryMin, setEditSalaryMin] = useState("")
  const [editSalaryMax, setEditSalaryMax] = useState("")

  const fetchMyJobs = async () => {
    try {
      setLoading(true)
      let query = supabase
        .from("jobs")
        .select(`
          *,
          company:companies(id, name, location),
          applications:applications(id, status)
        `)
        .order("created_at", { ascending: false })

      const { data: myComps } = await supabase.rpc("get_my_companies")
      const compIds = (myComps || []).map((c) => c.id).filter(Boolean)
      if (compIds.length > 0) {
        query = query.or(`posted_by.eq.${user.id},company_id.in.(${compIds.join(",")})`)
      } else {
        query = query.eq("posted_by", user.id)
      }

      const { data, error } = await query

      if (error) throw error
      setJobs(data || [])
    } catch (err) {
      setErrorMsg(err.message || "Failed to load jobs.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.id && profile?.role !== "admin") {
      fetchMyJobs()
    } else if (profile?.role === "admin") {
      setLoading(false)
    }
  }, [user?.id, profile?.role])

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

  const handleToggleStatus = async (job) => {
    const newStatus = job.status === "open" ? "closed" : "open"
    setActionLoadingId(job.id)
    setErrorMsg("")
    try {
      const nowIso = new Date().toISOString()
      const { error } = await supabase
        .from("jobs")
        .update({ status: newStatus, updated_at: nowIso })
        .eq("id", job.id)

      if (error) throw error

      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, status: newStatus } : j))
      )
    } catch (err) {
      setErrorMsg(err.message || "Failed to update job status.")
      alert(err.message || "Failed to update job status.")
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleDeleteJob = async (jobId) => {
    if (!window.confirm("Are you sure you want to delete this job listing?")) return

    setActionLoadingId(jobId)
    setErrorMsg("")
    try {
      const { error } = await supabase
        .from("jobs")
        .delete()
        .eq("id", jobId)

      if (error) throw error

      setJobs((prev) => prev.filter((j) => j.id !== jobId))
    } catch (err) {
      setErrorMsg(err.message || "Failed to delete job listing.")
      alert(err.message || "Failed to delete job listing.")
    } finally {
      setActionLoadingId(null)
    }
  }

  const startEdit = (job) => {
    setEditingJob(job)
    setEditTitle(job.title)
    setEditLocation(job.location)
    setEditSalaryMin(job.salary_min || "")
    setEditSalaryMax(job.salary_max || "")
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editTitle.trim() || !editLocation.trim()) {
      alert("Title and location cannot be empty.")
      return
    }

    setActionLoadingId(editingJob.id)
    try {
      const nowIso = new Date().toISOString()
      const { error } = await supabase
        .from("jobs")
        .update({
          title: editTitle.trim(),
          location: editLocation.trim(),
          salary_min: editSalaryMin ? parseInt(editSalaryMin, 10) : null,
          salary_max: editSalaryMax ? parseInt(editSalaryMax, 10) : null,
          updated_at: nowIso,
        })
        .eq("id", editingJob.id)

      if (error) throw error

      setJobs((prev) =>
        prev.map((j) =>
          j.id === editingJob.id
            ? {
                ...j,
                title: editTitle.trim(),
                location: editLocation.trim(),
                salary_min: editSalaryMin ? parseInt(editSalaryMin, 10) : null,
                salary_max: editSalaryMax ? parseInt(editSalaryMax, 10) : null,
              }
            : j
        )
      )
      setEditingJob(null)
    } catch (err) {
      alert(err.message || "Failed to save job changes.")
    } finally {
      setActionLoadingId(null)
    }
  }

  return (
    <PageTransition className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-foreground">
            Company Job Postings
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Manage your company listings, review applicant counts, and toggle active hiring.
          </p>
        </div>
        <Link to="/jobs/new">
          <Button size="sm" className="h-9 gap-1.5 shadow-sm shadow-primary/20 font-semibold">
            <PlusCircle className="h-4 w-4" />
            <span>Post a Job</span>
          </Button>
        </Link>
      </div>

      {noticeMsg && (
        <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 text-xs py-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="flex items-center justify-between">
            <span>{noticeMsg}</span>
            <button
              onClick={() => setNoticeMsg("")}
              className="text-xs font-semibold hover:underline ml-4 cursor-pointer"
            >
              Dismiss
            </button>
          </AlertDescription>
        </Alert>
      )}

      {errorMsg && (
        <Alert variant="destructive" className="text-xs py-2.5">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-5 space-y-3">
              <div className="flex justify-between items-start">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-6 w-1/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <Card className="rounded-2xl border-dashed p-10 sm:p-14 text-center space-y-4 bg-card/40">
          <div className="h-12 w-12 rounded-2xl bg-muted/80 text-muted-foreground flex items-center justify-center mx-auto">
            <Inbox className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-heading font-semibold text-foreground">No active job listings</h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
              You haven&apos;t posted any jobs for your company yet. Post an opening to start receiving candidates.
            </p>
          </div>
          <Link to="/jobs/new">
            <Button size="sm" className="gap-1.5 shadow-sm shadow-primary/20">
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Post Your First Job</span>
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const applicants = job.applications || []
            const totalApplicants = applicants.length
            const appliedCount = applicants.filter((a) => a.status === "applied").length
            const shortlistedCount = applicants.filter((a) => a.status === "shortlisted").length
            const selectedCount = applicants.filter((a) => a.status === "selected").length
            const rejectedCount = applicants.filter((a) => a.status === "rejected").length

            return (
              <Card key={job.id} className="p-4 sm:p-5 hover:border-primary/30 transition-all duration-200">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/jobs/${job.id}`}
                        className="font-heading font-bold text-lg text-foreground hover:text-primary transition-colors line-clamp-1"
                      >
                        {job.title}
                      </Link>
                      {job.status === "open" ? (
                        <Badge className="bg-emerald-600/15 text-emerald-700 border border-emerald-600/30 text-[10px] font-bold">
                          Active
                        </Badge>
                      ) : job.status === "paused" ? (
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="border-amber-500/40 text-amber-700 bg-amber-500/10 text-[10px]">
                            Paused (No Credits)
                          </Badge>
                          <Link to="/dashboard/credits">
                            <Button size="sm" variant="default" className="h-5 text-[10px] px-2 py-0 font-semibold">
                              Buy credits
                            </Button>
                          </Link>
                        </div>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Closed
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5 text-primary" />
                        {job.company?.name || "Company"}
                      </span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {job.location}
                      </span>
                      <span>&bull;</span>
                      <span className="capitalize">{job.job_type.replace("_", " ")}</span>
                      {(job.salary_min || job.salary_max) && (
                        <>
                          <span>&bull;</span>
                          <span className="text-emerald-600 font-medium">
                            ₹{job.salary_min ? (job.salary_min / 100000).toFixed(1) : ""}
                            {job.salary_max ? ` - ${(job.salary_max / 100000).toFixed(1)}` : ""}L PA
                          </span>
                        </>
                      )}
                      <span>&bull;</span>
                      <span>{new Date(job.created_at).toLocaleDateString()}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs pt-2">
                      <span className="font-bold text-foreground bg-muted/60 px-2 py-0.5 rounded text-[11px]">
                        Applicants: {totalApplicants}
                      </span>
                      <span className="text-[11px] font-semibold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded">
                        Applied: {appliedCount}
                      </span>
                      <span className="text-[11px] font-semibold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded">
                        Shortlisted: {shortlistedCount}
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">
                        Selected: {selectedCount}
                      </span>
                      <span className="text-[11px] font-semibold text-rose-600 bg-rose-500/10 px-2 py-0.5 rounded">
                        Rejected: {rejectedCount}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0">
                    <Link to={`/dashboard/jobs/${job.id}/applications`}>
                      <Button variant="secondary" size="sm" className="h-8 text-xs font-semibold gap-1.5">
                        <span>Review Applicants</span>
                        {totalApplicants > 0 && (
                          <span className="bg-primary text-primary-foreground rounded-full px-1.5 py-0.2 text-[10px]">
                            {totalApplicants}
                          </span>
                        )}
                      </Button>
                    </Link>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleStatus(job)}
                      disabled={actionLoadingId === job.id}
                      className="h-8 text-xs font-medium"
                    >
                      {actionLoadingId === job.id ? (
                        "Updating..."
                      ) : job.status === "open" ? (
                        "Close Job"
                      ) : (
                        <span className="flex items-center gap-1">
                          <RotateCcw className="h-3 w-3" /> Reopen
                        </span>
                      )}
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => startEdit(job)}
                      title="Edit job opening"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteJob(job.id)}
                      disabled={actionLoadingId === job.id}
                      title="Delete job opening"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {editingJob && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b">
                <h3 className="font-heading font-bold text-lg text-foreground">
                  Quick Edit: {editingJob.title}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => setEditingJob(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Job Title *</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-input bg-background px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Location *</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-input bg-background px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Min Salary (₹)</label>
                    <input
                      type="number"
                      className="w-full rounded-lg border border-input bg-background px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={editSalaryMin}
                      onChange={(e) => setEditSalaryMin(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Max Salary (₹)</label>
                    <input
                      type="number"
                      className="w-full rounded-lg border border-input bg-background px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={editSalaryMax}
                      onChange={(e) => setEditSalaryMax(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-3 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingJob(null)}
                    className="text-xs h-9"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={actionLoadingId === editingJob.id}
                    className="text-xs h-9 font-semibold"
                  >
                    {actionLoadingId === editingJob.id ? "Saving..." : "Save Changes"}
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