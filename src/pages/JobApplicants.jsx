import { useEffect, useState, useCallback } from "react"
import { useParams, Link } from "react-router-dom"
import { 
  Building2, 
  MapPin, 
  FileText, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  Award, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  ArrowLeft,
  Mail,
  Phone,
  AlertCircle
} from "lucide-react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import PageTransition from "@/components/PageTransition"

export default function JobApplicants() {
  const { id } = useParams()
  const { user } = useAuth()
  const shouldReduceMotion = useReducedMotion()

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

  const loadApplicants = useCallback(async () => {
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
  }, [id])

  useEffect(() => {
    if (id && user?.id) {
      loadApplicants()
    }
  }, [id, user?.id, loadApplicants])

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
        let emailNote = ""
        try {
          const { data: emailData, error: emailErr } = await supabase.functions.invoke("send-selection-email", {
            body: { applicationId: pendingAction.applicantId },
          })
          if (emailErr) {
            console.warn("Selection email dispatch notice:", emailErr.message)
            emailNote = " (In-app notification sent; email not sent: request_failed)"
          } else if (emailData?.sent) {
            emailNote = " (Candidate notified by email)"
          } else if (emailData?.reason === "no_email") {
            emailNote = " (Candidate has no email; in-app notification sent)"
          } else if (emailData?.reason) {
            emailNote = ` (In-app notification sent; email not sent: ${emailData.reason})`
          }
        } catch (emailErr) {
          console.warn("Selection email dispatch notice:", emailErr.message)
          emailNote = " (In-app notification sent; email not sent: client_error)"
        }
        setSuccessMsg(
          `Application for ${pendingAction.applicantName} updated to SELECTED.${emailNote}`
        )
      } else {
        setSuccessMsg(
          `Application for ${pendingAction.applicantName} updated to ${pendingAction.targetStatus.toUpperCase()}.`
        )
      }
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
      (app.full_name && app.full_name.toLowerCase().includes(term)) ||
      (app.email && app.email.toLowerCase().includes(term)) ||
      (app.phone && app.phone.toLowerCase().includes(term))
    return matchesStatus && matchesSearch
  })

  const statusBadgeVariants = {
    applied: "bg-blue-600/15 text-blue-700 border border-blue-600/30",
    shortlisted: "bg-amber-600/15 text-amber-700 border border-amber-600/30",
    selected: "bg-emerald-600/15 text-emerald-700 border border-emerald-600/30",
    rejected: "bg-rose-600/15 text-rose-700 border border-rose-600/30",
  }

  return (
    <PageTransition className="space-y-6">
      <div>
        <Link
          to="/dashboard/my-jobs"
          className="inline-flex items-center gap-1 text-xs sm:text-sm text-muted-foreground hover:text-foreground font-medium transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to My Job Postings
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-foreground">
            Applicant Pipeline
          </h1>
          {job && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Position: <span className="font-semibold text-foreground">{job.title}</span> ({job.company?.name})
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={job?.status === "open" ? "default" : "secondary"} className="text-xs">
            {job?.status === "open" ? "Active Listing" : job?.status || ""}
          </Badge>
          <Badge variant="outline" className="text-xs font-semibold">
            {applicants.length} Total Applicant{applicants.length === 1 ? "" : "s"}
          </Badge>
        </div>
      </div>

      {errorMsg && (
        <Alert variant="destructive" className="text-xs py-2.5">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {successMsg && (
        <Alert className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800 text-xs py-2.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
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

      <AnimatePresence>
        {pendingAction && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: -8 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <Card className="border-2 border-primary shadow-lg bg-card p-5 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="font-heading font-bold text-base text-foreground">
                    Confirm Decision: {pendingAction.applicantName}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Transition status from <span className="uppercase font-semibold text-foreground">{pendingAction.currentStatus}</span> →{" "}
                    <span className="uppercase font-bold text-primary">{pendingAction.targetStatus}</span>
                  </p>
                </div>
                <Badge className={`uppercase text-xs font-bold ${statusBadgeVariants[pendingAction.targetStatus] || ""}`}>
                  → {pendingAction.targetStatus}
                </Badge>
              </div>

              {pendingAction.requiresConfirmation && (
                <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 text-xs p-3 rounded-xl flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p>
                    <strong>Important Decision:</strong> &apos;{pendingAction.targetStatus}&apos; is a final status.
                    Once confirmed, this candidate will be notified and recruiters cannot alter the decision.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="action-note" className="text-xs font-semibold text-foreground">
                  Internal Feedback / Note (Optional):
                </label>
                <Textarea
                  id="action-note"
                  placeholder="e.g. Performed exceptionally in system design round..."
                  value={pendingAction.note}
                  onChange={(e) => setPendingAction({ ...pendingAction, note: e.target.value })}
                  rows={3}
                  className="text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPendingAction(null)}
                  disabled={updatingStatus}
                  className="text-xs h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={pendingAction.targetStatus === "rejected" ? "destructive" : "default"}
                  onClick={handleConfirmStatusChange}
                  disabled={updatingStatus}
                  className="text-xs h-9 font-semibold shadow-sm"
                >
                  {updatingStatus
                    ? "Updating Status..."
                    : `Confirm ${pendingAction.targetStatus.charAt(0).toUpperCase() + pendingAction.targetStatus.slice(1)}`}
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-muted/40 p-3 rounded-xl border">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search candidate name, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-background h-9 text-xs sm:text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground mr-1 hidden sm:inline">Filter:</span>
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
                <span className="ml-1 opacity-75 font-mono text-[10px]">
                  ({applicants.filter((a) => a.status === st).length})
                </span>
              )}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-5 space-y-3">
              <div className="flex justify-between items-start">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-6 w-1/4" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
            </Card>
          ))}
        </div>
      ) : filteredApplicants.length === 0 ? (
        <Card className="rounded-2xl border-dashed p-10 sm:p-14 text-center space-y-3 bg-card/40">
          <h3 className="text-base sm:text-lg font-heading font-semibold text-foreground">
            No candidates match the filter
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
            {applicants.length === 0
              ? "When candidates submit their applications, their verified credentials and resumes will show up here."
              : "Try switching status filters or clearing your search query."}
          </p>
          {(statusFilter !== "all" || searchQuery) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusFilter("all")
                setSearchQuery("")
              }}
              className="text-xs"
            >
              Reset Filters
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredApplicants.map((app) => {
            const isHistoryOpen = expandedHistory.has(app.id)
            const sortedHistory = (app.history || []).sort(
              (a, b) => new Date(a.created_at) - new Date(b.created_at)
            )

            return (
              <motion.div
                key={app.id}
                whileHover={shouldReduceMotion ? {} : { y: -1 }}
                transition={{ duration: 0.15 }}
              >
                <Card className="p-4 sm:p-5 shadow-sm hover:border-primary/40 transition-colors space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-heading font-bold text-base sm:text-lg text-foreground">
                          {app.full_name}
                        </h3>
                        <Badge
                          className={`uppercase text-[10px] font-bold tracking-wider ${
                            statusBadgeVariants[app.status] || ""
                          }`}
                        >
                          {app.status}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {app.email || "No email"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {app.phone}
                        </span>
                        <span>Applied: {new Date(app.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5 font-medium"
                        onClick={() => handleViewResume(app.id, app.resume_path)}
                        disabled={resumeLoadingId === app.id}
                      >
                        <FileText className="h-3.5 w-3.5 text-primary" />
                        <span>{resumeLoadingId === app.id ? "Opening..." : "View Resume"}</span>
                      </Button>
                    </div>
                  </div>

                  {app.cover_note && (
                    <div className="bg-muted/40 p-3 rounded-xl text-xs leading-relaxed text-foreground/80 border">
                      <span className="font-semibold text-foreground">Candidate Cover Note: </span>
                      &ldquo;{app.cover_note}&rdquo;
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-muted-foreground text-[11px]">Advance Candidate:</span>
                      {app.status === "applied" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-amber-600/40 text-amber-700 hover:bg-amber-500/10"
                            onClick={() => handleInitiateStatusChange(app, "shortlisted")}
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            Shortlist
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-rose-600/40 text-rose-700 hover:bg-rose-500/10"
                            onClick={() => handleInitiateStatusChange(app, "rejected")}
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}

                      {app.status === "shortlisted" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-emerald-600/40 text-emerald-700 hover:bg-emerald-500/10 font-semibold"
                            onClick={() => handleInitiateStatusChange(app, "selected")}
                          >
                            <Award className="h-3 w-3 mr-1" />
                            Select Candidate
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-rose-600/40 text-rose-700 hover:bg-rose-500/10"
                            onClick={() => handleInitiateStatusChange(app, "rejected")}
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}

                      {(app.status === "selected" || app.status === "rejected") && (
                        <span className="text-muted-foreground text-[11px] italic">
                          Decision finalized ({app.status}). Final decisions are permanent.
                        </span>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground gap-1"
                      onClick={() => toggleHistory(app.id)}
                    >
                      <span>Audit History ({sortedHistory.length})</span>
                      {isHistoryOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>
                  </div>

                  <AnimatePresence>
                    {isHistoryOpen && (
                      <motion.div
                        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 p-3.5 bg-muted/30 rounded-xl border text-xs space-y-2">
                          <p className="font-semibold text-foreground text-[11px] uppercase tracking-wider">
                            Status Progression Audit Log:
                          </p>
                          {sortedHistory.length === 0 ? (
                            <p className="text-muted-foreground text-xs">No transition records logged.</p>
                          ) : (
                            <div className="space-y-2 divide-y divide-border/60">
                              {sortedHistory.map((item, idx) => (
                                <div key={item.id || idx} className="pt-2 first:pt-0">
                                  <div className="flex items-center justify-between text-muted-foreground">
                                    <span className="font-medium text-foreground">
                                      {item.from_status ? (
                                        <>
                                          <span className="uppercase">{item.from_status}</span> →{" "}
                                          <span className="uppercase font-bold text-primary">{item.to_status}</span>
                                        </>
                                      ) : (
                                        <>
                                          Initial submission as{" "}
                                          <span className="uppercase font-bold text-primary">{item.to_status}</span>
                                        </>
                                      )}
                                    </span>
                                    <span className="text-[11px]">
                                      {new Date(item.created_at).toLocaleString()}
                                    </span>
                                  </div>
                                  {item.note && (
                                    <p className="mt-1 text-muted-foreground italic bg-background/60 p-2 rounded-lg border text-[11px]">
                                      Recruiter note: &ldquo;{item.note}&rdquo;
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </PageTransition>
  )
}
