import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function JobApplicants() {
  const { id } = useParams()
  const { user } = useAuth()

  const [job, setJob] = useState(null)
  const [applicants, setApplicants] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState("")
  const [successMsg, setSuccessMsg] = useState("")
  const [resumeLoadingId, setResumeLoadingId] = useState(null)

  const [statusFilter, setStatusFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")

  const [pendingAction, setPendingAction] = useState(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const [expandedHistory, setExpandedHistory] = useState(new Set())

  const loadApplicants = async () => {
    try {
      setLoading(true)
      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select("id, title, location, status, company:companies(name)")
        .eq("id", id)
        .single()

      if (jobError) throw jobError
      setJob(jobData)

      const { data: appData, error: appError } = await supabase
        .from("applications")
        .select(`
          *,
          history:application_status_history(
            id,
            from_status,
            to_status,
            note,
            created_at
          )
        `)
        .eq("job_id", id)
        .order("created_at", { ascending: false })

      if (appError) throw appError
      setApplicants(appData || [])
    } catch (err) {
      setErrorMsg(err.message || "Failed to load job applicants.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id && user?.id) {
      loadApplicants()
    }
  }, [id, user])

  const handleViewResume = async (appId, resumePath) => {
    setResumeLoadingId(appId)
    try {
      const { data, error } = await supabase.storage
        .from("resumes")
        .createSignedUrl(resumePath, 60)

      if (error) throw error
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank", "noopener,noreferrer")
      }
    } catch (err) {
      alert("Failed to access applicant resume: " + (err.message || "File unavailable"))
    } finally {
      setResumeLoadingId(null)
    }
  }

  const handleInitiateStatusChange = (applicant, targetStatus) => {
    const isFinal = targetStatus === "selected" || targetStatus === "rejected"
    setPendingAction({
      applicantId: applicant.id,
      applicantName: applicant.full_name,
      applicantEmail: applicant.email,
      currentStatus: applicant.status,
      targetStatus,
      note: "",
      requiresConfirmation: isFinal,
    })
  }

  const handleConfirmStatusChange = async () => {
    if (!pendingAction) return

    setUpdatingStatus(true)
    setErrorMsg("")
    setSuccessMsg("")

    try {
      const { error } = await supabase.rpc("update_application_status", {
        p_application_id: pendingAction.applicantId,
        p_new_status: pendingAction.targetStatus,
        p_note: pendingAction.note.trim() || null,
      })

      if (error) throw error

      if (pendingAction.targetStatus === "selected") {
        try {
          await supabase.functions.invoke("send-selection-email", {
            body: {
              applicationId: pendingAction.applicantId,
              candidateEmail: pendingAction.applicantEmail,
              candidateName: pendingAction.applicantName,
              jobTitle: job?.title || "Position",
              companyName: job?.company?.name || "Hiring Company",
            },
          })
        } catch (emailErr) {
          console.warn("Selection email dispatch notice:", emailErr.message)
        }
      }

      setSuccessMsg(
        `Application for ${pendingAction.applicantName} updated to ${pendingAction.targetStatus.toUpperCase()}.`
      )
      setPendingAction(null)
      await loadApplicants()
    } catch (err) {
      setErrorMsg(err.message || "Failed to update application status.")
    } finally {
      setUpdatingStatus(false)
    }
  }

  const toggleHistory = (appId) => {
    setExpandedHistory((prev) => {
      const next = new Set(prev)
      if (next.has(appId)) {
        next.delete(appId)
      } else {
        next.add(appId)
      }
      return next
    })
  }

  const filteredApplicants = applicants.filter((app) => {
    const matchesStatus = statusFilter === "all" || app.status === statusFilter
    const term = searchQuery.toLowerCase().trim()
    const matchesSearch =
      term === "" ||
      app.full_name.toLowerCase().includes(term) ||
      app.email.toLowerCase().includes(term) ||
      app.phone.toLowerCase().includes(term)
    return matchesStatus && matchesSearch
  })

  const statusBadgeVariants = {
    applied: "bg-blue-600 text-white",
    shortlisted: "bg-amber-600 text-white",
    selected: "bg-emerald-600 text-white",
    rejected: "bg-red-600 text-white",
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/dashboard/my-jobs" className="text-sm text-muted-foreground hover:underline">
          &larr; Back to My Job Postings
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Applicant Pipeline</h1>
          {job && (
            <p className="text-muted-foreground mt-1">
              Position: <span className="font-semibold text-foreground">{job.title}</span> ({job.company?.name})
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={job?.status === "open" ? "default" : "secondary"}>
            Job {job?.status === "open" ? "Active" : job?.status || ""}
          </Badge>
          <span className="text-sm font-medium text-muted-foreground">
            {applicants.length} Total Applicant{applicants.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {successMsg && (
        <Alert className="border-emerald-500 bg-emerald-50 text-emerald-900">
          <AlertDescription className="flex items-center justify-between">
            <span>{successMsg}</span>
            <button
              onClick={() => setSuccessMsg("")}
              className="text-xs font-semibold hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </AlertDescription>
        </Alert>
      )}

      {pendingAction && (
        <Card className="border-2 border-primary shadow-sm bg-background">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Confirm Status Change: {pendingAction.applicantName}</span>
              <Badge className={`uppercase text-xs ${statusBadgeVariants[pendingAction.targetStatus] || ""}`}>
                &rarr; {pendingAction.targetStatus}
              </Badge>
            </CardTitle>
            <CardDescription>
              Transitioning application from{" "}
              <span className="font-semibold uppercase">{pendingAction.currentStatus}</span> to{" "}
              <span className="font-semibold uppercase">{pendingAction.targetStatus}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingAction.requiresConfirmation && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs p-3 rounded-md">
                <strong>Important Notice:</strong> &apos;{pendingAction.targetStatus}&apos; is a final status decision.
                Once confirmed, recruiters cannot change it back.
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="action-note" className="text-xs font-semibold">
                Internal Recruiter Note (Optional):
              </label>
              <Textarea
                id="action-note"
                placeholder="e.g. Cleared technical interview round with high scores..."
                value={pendingAction.note}
                onChange={(e) => setPendingAction({ ...pendingAction, note: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPendingAction(null)}
                disabled={updatingStatus}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                variant={pendingAction.targetStatus === "rejected" ? "destructive" : "default"}
                onClick={handleConfirmStatusChange}
                disabled={updatingStatus}
              >
                {updatingStatus
                  ? "Saving..."
                  : `Confirm ${pendingAction.targetStatus.charAt(0).toUpperCase() + pendingAction.targetStatus.slice(1)}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-muted/40 p-3 rounded-lg border">
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-background h-9 text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground mr-1">Status:</span>
          {["all", "applied", "shortlisted", "selected", "rejected"].map((st) => (
            <Button
              key={st}
              size="sm"
              variant={statusFilter === st ? "default" : "outline"}
              className="h-8 text-xs capitalize"
              onClick={() => setStatusFilter(st)}
            >
              {st}
              {st !== "all" && (
                <span className="ml-1 opacity-70">
                  ({applicants.filter((a) => a.status === st).length})
                </span>
              )}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading applicants...</p>
        </div>
      ) : filteredApplicants.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center space-y-3">
          <h3 className="text-lg font-medium">No candidates match the selected filters</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {applicants.length === 0
              ? "When candidates submit applications, their contact details and verified resume documents will appear here."
              : "Try adjusting your search query or status filter to see other applicants."}
          </p>
          {(statusFilter !== "all" || searchQuery) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusFilter("all")
                setSearchQuery("")
              }}
            >
              Reset Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredApplicants.map((app) => {
            const isHistoryOpen = expandedHistory.has(app.id)
            const sortedHistory = (app.history || []).sort(
              (a, b) => new Date(a.created_at) - new Date(b.created_at)
            )

            return (
              <Card key={app.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-xl font-bold">{app.full_name}</CardTitle>
                        <Badge className={`uppercase text-[11px] tracking-wide ${statusBadgeVariants[app.status] || ""}`}>
                          {app.status}
                        </Badge>
                      </div>
                      <CardDescription className="flex flex-wrap gap-x-4 pt-1 text-xs">
                        <span>Email: {app.email}</span>
                        <span>Phone: {app.phone}</span>
                        <span>Applied: {new Date(app.created_at).toLocaleDateString()}</span>
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewResume(app.id, app.resume_path)}
                        disabled={resumeLoadingId === app.id}
                      >
                        {resumeLoadingId === app.id ? "Opening..." : "View Resume"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pt-0">
                  {app.cover_note && (
                    <div className="bg-muted/50 p-3 rounded-md text-xs leading-relaxed text-muted-foreground">
                      <span className="font-semibold text-foreground">Candidate Note: </span>
                      {app.cover_note}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-muted-foreground">Next Action:</span>
                      {app.status === "applied" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-amber-600 text-amber-700 hover:bg-amber-50"
                            onClick={() => handleInitiateStatusChange(app, "shortlisted")}
                          >
                            Shortlist
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-red-600 text-red-700 hover:bg-red-50"
                            onClick={() => handleInitiateStatusChange(app, "rejected")}
                          >
                            Reject
                          </Button>
                        </>
                      )}

                      {app.status === "shortlisted" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                            onClick={() => handleInitiateStatusChange(app, "selected")}
                          >
                            Select Candidate
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-red-600 text-red-700 hover:bg-red-50"
                            onClick={() => handleInitiateStatusChange(app, "rejected")}
                          >
                            Reject
                          </Button>
                        </>
                      )}

                      {(app.status === "selected" || app.status === "rejected") && (
                        <span className="text-muted-foreground italic">
                          Decision finalized ({app.status}). Final statuses cannot be changed by recruiters.
                        </span>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground cursor-pointer"
                      onClick={() => toggleHistory(app.id)}
                    >
                      {isHistoryOpen ? "Hide Status History" : `Status History (${sortedHistory.length})`}
                    </Button>
                  </div>

                  {isHistoryOpen && (
                    <div className="mt-3 p-3 bg-muted/30 rounded-md border text-xs space-y-2">
                      <p className="font-semibold text-foreground">Application Status History (Audit Log):</p>
                      {sortedHistory.length === 0 ? (
                        <p className="text-muted-foreground">No transition records found.</p>
                      ) : (
                        <div className="space-y-2 divide-y divide-border/60">
                          {sortedHistory.map((item, idx) => (
                            <div key={item.id || idx} className="pt-2 first:pt-0">
                              <div className="flex items-center justify-between text-muted-foreground">
                                <span className="font-medium text-foreground">
                                  {item.from_status ? (
                                    <>
                                      <span className="uppercase">{item.from_status}</span> &rarr;{" "}
                                      <span className="uppercase font-bold">{item.to_status}</span>
                                    </>
                                  ) : (
                                    <>
                                      Created as <span className="uppercase font-bold">{item.to_status}</span>
                                    </>
                                  )}
                                </span>
                                <span>{new Date(item.created_at).toLocaleString()}</span>
                              </div>
                              {item.note && (
                                <p className="mt-1 text-muted-foreground italic bg-background/60 p-1.5 rounded">
                                  Recruiter note: &ldquo;{item.note}&rdquo;
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
