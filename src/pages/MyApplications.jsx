import { useEffect, useState, useCallback } from "react"
import { Link } from "react-router-dom"
import { 
  FileText, 
  Clock, 
  Building2, 
  MapPin, 
  Briefcase, 
  CheckCircle2, 
  ArrowRight, 
  Inbox, 
  Sparkles,
  ExternalLink,
  XCircle,
  Award
} from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import PageTransition from "@/components/PageTransition"

export default function MyApplications() {
  const { user } = useAuth()
  const shouldReduceMotion = useReducedMotion()
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState("")
  const [resumeLoadingId, setResumeLoadingId] = useState(null)

  const fetchTimeline = useCallback(async (applicationId) => {
    const { data, error } = await supabase.rpc("get_my_application_timeline", {
      p_application_id: applicationId,
    })
    if (error) return []
    return data || []
  }, [])

  const loadApplications = useCallback(async (isCancelled = () => false) => {
    try {
      const { data, error } = await supabase
        .from("applications")
        .select(`
          id,
          status,
          credits_charged,
          created_at,
          resume_path,
          job:jobs (
            id,
            title,
            location,
            job_type,
            company:companies (
              id,
              name,
              location
            )
          )
        `)
        .eq("candidate_id", user?.id)
        .order("created_at", { ascending: false })

      if (error) throw error

      const appsWithTimeline = await Promise.all(
        (data || []).map(async (app) => {
          const timeline = await fetchTimeline(app.id)
          return { ...app, timeline }
        })
      )

      if (!isCancelled()) {
        setApplications(appsWithTimeline)
      }
    } catch (err) {
      if (!isCancelled()) {
        setErrorMsg(err.message || "Failed to load applications.")
      }
    } finally {
      if (!isCancelled()) {
        setLoading(false)
      }
    }
  }, [user?.id, fetchTimeline])

  useEffect(() => {
    if (!user?.id) return

    let cancelled = false
    const isCancelled = () => cancelled

    loadApplications(isCancelled)

    const channelName = `candidate-applications-${user.id}-${Math.random().toString(36).slice(2)}`
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "applications",
          filter: `candidate_id=eq.${user.id}`,
        },
        async (payload) => {
          if (cancelled) return
          if (payload.eventType === "UPDATE" && payload.new?.id) {
            const updatedId = payload.new.id
            const freshTimeline = await fetchTimeline(updatedId)
            if (!cancelled) {
              setApplications((prev) =>
                prev.map((app) =>
                  app.id === updatedId
                    ? { ...app, status: payload.new.status, timeline: freshTimeline }
                    : app
                )
              )
            }
          } else {
            loadApplications(isCancelled)
          }
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [user?.id, loadApplications, fetchTimeline])

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
      alert("Failed to access resume: " + (err.message || "File unavailable"))
    } finally {
      setResumeLoadingId(null)
    }
  }

  const statusBadgeVariants = {
    applied: "bg-blue-600/15 text-blue-700  border border-blue-600/30",
    shortlisted: "bg-amber-600/15 text-amber-700  border border-amber-600/30",
    selected: "bg-emerald-600/15 text-emerald-700  border border-emerald-600/30",
    rejected: "bg-rose-600/15 text-rose-700  border border-rose-600/30",
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case "applied":
        return <Clock className="h-3.5 w-3.5 text-blue-600 " />
      case "shortlisted":
        return <Sparkles className="h-3.5 w-3.5 text-amber-600 " />
      case "selected":
        return <Award className="h-3.5 w-3.5 text-emerald-600 " />
      case "rejected":
        return <XCircle className="h-3.5 w-3.5 text-rose-600 " />
      default:
        return <CheckCircle2 className="h-3.5 w-3.5" />
    }
  }

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-foreground">
            My Job Applications
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Track your recruitment progress, view uploaded resumes, and see live timeline updates.
          </p>
        </div>
        <Badge variant="outline" className="text-xs gap-1.5 py-1 px-3 w-fit border-emerald-500/30 text-emerald-700  bg-emerald-500/5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping inline-block" />
          Live Real-time Feed
        </Badge>
      </div>

      {errorMsg && (
        <Alert variant="destructive" className="text-xs">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {/* Skeletons while loading */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-6 w-1/3" />
                  <Skeleton className="h-4 w-1/4" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
              <Skeleton className="h-10 w-full" />
            </Card>
          ))}
        </div>
      ) : applications.length === 0 ? (
        /* Empty state */
        <Card className="rounded-2xl border-dashed p-10 sm:p-14 text-center space-y-4 bg-card/40">
          <div className="h-12 w-12 rounded-2xl bg-muted/80 text-muted-foreground flex items-center justify-center mx-auto">
            <Inbox className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-heading font-semibold text-foreground">
              You haven&apos;t submitted any applications yet
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
              Explore verified roles matching your skills and apply with a single click.
            </p>
          </div>
          <Link to="/jobs">
            <Button size="sm" className="gap-1.5 shadow-sm shadow-primary/20">
              <Briefcase className="h-3.5 w-3.5" />
              <span>Explore Open Jobs</span>
            </Button>
          </Link>
        </Card>
      ) : (
        /* Applications List */
        <div className="space-y-4">
          {applications.map((app) => {
            const timeline = app.timeline || []

            return (
              <motion.div
                key={app.id}
                whileHover={shouldReduceMotion ? {} : { y: -2 }}
                transition={{ duration: 0.15 }}
              >
                <Card className="p-5 space-y-4 shadow-sm hover:border-primary/40 hover:shadow-md transition-all duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/jobs/${app.job?.id}`}
                          className="font-heading font-bold text-lg text-foreground hover:text-primary transition-colors line-clamp-1"
                        >
                          {app.job?.title || "Position"}
                        </Link>
                        <Badge
                          className={`uppercase text-[10px] font-bold tracking-wider flex items-center gap-1 ${
                            statusBadgeVariants[app.status] || ""
                          }`}
                        >
                          {getStatusIcon(app.status)}
                          <span>{app.status}</span>
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5 text-primary" />
                          {app.job?.company?.name || "Company"}
                        </span>
                        <span>&bull;</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {app.job?.location || "Location"}
                        </span>
                        <span>&bull;</span>
                        <span className="capitalize">{app.job?.job_type?.replace("_", " ")}</span>
                        <span>&bull;</span>
                        <span>Submitted {new Date(app.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1"
                        onClick={() => handleViewResume(app.id, app.resume_path)}
                        disabled={resumeLoadingId === app.id}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>{resumeLoadingId === app.id ? "Opening..." : "View Resume"}</span>
                      </Button>
                      <Link to={`/jobs/${app.job?.id}`}>
                        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1">
                          <span>Job Details</span>
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </Link>
                    </div>
                  </div>

                  {/* Animated Status Timeline */}
                  <div className="pt-3 border-t">
                    <p className="text-[11px] font-semibold text-muted-foreground mb-2.5 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Application Timeline:</span>
                    </p>

                    {timeline.length === 0 ? (
                      <div className="flex items-center gap-1.5 bg-muted/60 px-3 py-1.5 rounded-lg border text-foreground w-fit text-xs">
                        {getStatusIcon(app.status)}
                        <span className="font-bold uppercase tracking-wider text-[10px]">{app.status}</span>
                        <span className="text-muted-foreground text-[10px]">
                          ({new Date(app.created_at).toLocaleDateString()})
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {timeline.map((h, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <motion.div
                              initial={shouldReduceMotion ? {} : { scale: 0.95, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="flex items-center gap-1.5 bg-card px-2.5 py-1.5 rounded-lg border shadow-xs"
                            >
                              {getStatusIcon(h.to_status)}
                              <span className="font-bold uppercase tracking-wider text-[10px] text-foreground">
                                {h.to_status}
                              </span>
                              <span className="text-muted-foreground text-[10px]">
                                {new Date(h.created_at).toLocaleDateString()}
                              </span>
                            </motion.div>
                            {idx < timeline.length - 1 && (
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </PageTransition>
  )
}
