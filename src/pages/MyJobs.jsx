import { useEffect, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function MyJobs() {
  const { user } = useAuth()
  const location = useLocation()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState("")
  const [noticeMsg, setNoticeMsg] = useState(location.state?.notice || "")
  const [actionLoadingId, setActionLoadingId] = useState(null)

  // Editing state modal/inline
  const [editingJob, setEditingJob] = useState(null)
  const [editTitle, setEditTitle] = useState("")
  const [editLocation, setEditLocation] = useState("")
  const [editSalaryMin, setEditSalaryMin] = useState("")
  const [editSalaryMax, setEditSalaryMax] = useState("")

  const fetchMyJobs = async () => {
    try {
      setLoading(true)
      // Recruiter's jobs: fetch jobs for company with application records for per-status metrics
      const { data, error } = await supabase
        .from("jobs")
        .select(`
          *,
          company:companies(id, name, location),
          applications:applications(id, status)
        `)
        .order("created_at", { ascending: false })

      if (error) throw error
      setJobs(data || [])
    } catch (err) {
      setErrorMsg(err.message || "Failed to load jobs.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.id) {
      fetchMyJobs()
    }
  }, [user])

  // Toggle Job status between open and closed
  const handleToggleStatus = async (job) => {
    const newStatus = job.status === "open" ? "closed" : "open"
    setActionLoadingId(job.id)
    setErrorMsg("")
    try {
      const { error } = await supabase
        .from("jobs")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
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

  // Delete Job
  const handleDeleteJob = async (jobId) => {
    if (!window.confirm("Are you sure you want to delete this job listing?")) return
    setActionLoadingId(jobId)
    setErrorMsg("")
    try {
      const { error } = await supabase.from("jobs").delete().eq("id", jobId)
      if (error) throw error
      setJobs((prev) => prev.filter((j) => j.id !== jobId))
    } catch (err) {
      // Friendly message if database trigger rejected deletion
      const friendlyMsg = err.message?.includes("applications")
        ? "This job has applications and cannot be deleted. Close it instead."
        : (err.message || "Failed to delete job.")
      setErrorMsg(friendlyMsg)
      alert(friendlyMsg)
    } finally {
      setActionLoadingId(null)
    }
  }

  // Open Edit
  const handleStartEdit = (job) => {
    setEditingJob(job)
    setEditTitle(job.title)
    setEditLocation(job.location)
    setEditSalaryMin(job.salary_min || "")
    setEditSalaryMax(job.salary_max || "")
  }

  // Save Edit
  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editingJob) return

    setActionLoadingId(editingJob.id)
    try {
      const { error } = await supabase
        .from("jobs")
        .update({
          title: editTitle.trim(),
          location: editLocation.trim(),
          salary_min: editSalaryMin ? parseInt(editSalaryMin, 10) : null,
          salary_max: editSalaryMax ? parseInt(editSalaryMax, 10) : null,
          updated_at: new Date().toISOString(),
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Company Job Postings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your company listings, toggle active status, and track applicants.
          </p>
        </div>
        <Link to="/jobs/new">
          <Button>+ Post a Job</Button>
        </Link>
      </div>

      {noticeMsg && (
        <Alert className="border-amber-500 bg-amber-50 text-amber-900">
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
        <Alert variant="destructive">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {/* Edit Job Modal / Card */}
      {editingJob && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-lg">Quick Edit: {editingJob.title}</CardTitle>
            <CardDescription>Update basic details for this opening</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold">Title</label>
                  <input
                    type="text"
                    className="w-full rounded-md border px-3 py-1.5 text-sm"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold">Location</label>
                  <input
                    type="text"
                    className="w-full rounded-md border px-3 py-1.5 text-sm"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold">Min Salary (₹)</label>
                  <input
                    type="number"
                    className="w-full rounded-md border px-3 py-1.5 text-sm"
                    value={editSalaryMin}
                    onChange={(e) => setEditSalaryMin(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold">Max Salary (₹)</label>
                  <input
                    type="number"
                    className="w-full rounded-md border px-3 py-1.5 text-sm"
                    value={editSalaryMax}
                    onChange={(e) => setEditSalaryMax(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingJob(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={actionLoadingId === editingJob.id}>
                  {actionLoadingId === editingJob.id ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading your listings...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center space-y-3">
          <h3 className="text-lg font-medium">No job postings found</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            You haven&apos;t posted any jobs for your company yet.
          </p>
          <Link to="/jobs/new">
            <Button>Post Your First Job</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const apps = job.applications || []
            const totalApplicants = apps.length
            const appliedCount = apps.filter((a) => a.status === "applied").length
            const shortlistedCount = apps.filter((a) => a.status === "shortlisted").length
            const selectedCount = apps.filter((a) => a.status === "selected").length
            const rejectedCount = apps.filter((a) => a.status === "rejected").length
            const hasApplicants = totalApplicants > 0

            return (
              <Card key={job.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Link to={`/jobs/${job.id}`} className="font-semibold text-lg hover:underline">
                      {job.title}
                    </Link>
                    {job.status === "open" ? (
                      <Badge variant="default">Open</Badge>
                    ) : job.status === "paused" ? (
                      <Badge variant="outline" className="border-amber-500 text-amber-700 bg-amber-50">
                        Paused (No Credits)
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Closed</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                    <span>🏢 {job.company?.name || "Company"}</span>
                    <span>📍 {job.location}</span>
                    <span>💼 {job.job_type.replace("_", " ")}</span>
                    <span>
                      💰 {job.salary_min ? `₹${(job.salary_min / 100000).toFixed(1)}L` : ""}
                      {job.salary_max ? ` - ₹${(job.salary_max / 100000).toFixed(1)}L` : ""}
                    </span>
                    <span>📅 Posted: {new Date(job.created_at).toLocaleDateString()}</span>
                  </div>

                  {/* Applicant Count & Per-Status Breakdown */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs pt-1.5">
                    <span className="font-semibold text-foreground">
                      Applicants: {totalApplicants}
                    </span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-blue-600 font-medium">Applied: {appliedCount}</span>
                    <span className="text-amber-600 font-medium">Shortlisted: {shortlistedCount}</span>
                    <span className="text-emerald-600 font-medium">Selected: {selectedCount}</span>
                    <span className="text-red-600 font-medium">Rejected: {rejectedCount}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link to={`/dashboard/jobs/${job.id}/applications`}>
                    <Button variant="secondary" size="sm">
                      Applicants ({totalApplicants})
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleStatus(job)}
                    disabled={actionLoadingId === job.id}
                  >
                    {job.status === "open" ? "Close Job" : "Reopen Job"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStartEdit(job)}
                    disabled={actionLoadingId === job.id}
                  >
                    Edit
                  </Button>
                  {hasApplicants ? (
                    <span title="Has applicants, close instead" className="inline-block">
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled
                        className="opacity-50 cursor-not-allowed"
                      >
                        Delete
                      </Button>
                    </span>
                  ) : (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteJob(job.id)}
                      disabled={actionLoadingId === job.id}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
