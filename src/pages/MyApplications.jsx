import { useEffect, useState, useCallback } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function MyApplications() {
  const { user } = useAuth()
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

  const loadApplications = useCallback(async () => {
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

      setApplications(appsWithTimeline)
    } catch (err) {
      setErrorMsg(err.message || "Failed to load applications.")
    } finally {
      setLoading(false)
    }
  }, [user?.id, fetchTimeline])

  useEffect(() => {
    if (user?.id) {
      loadApplications()
    }
  }, [user?.id, loadApplications])

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`candidate-applications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "applications",
          filter: `candidate_id=eq.${user.id}`,
        },
        async (payload) => {
          if (payload.eventType === "UPDATE" && payload.new?.id) {
            const updatedId = payload.new.id
            const freshTimeline = await fetchTimeline(updatedId)
            setApplications((prev) =>
              prev.map((app) =>
                app.id === updatedId
                  ? { ...app, status: payload.new.status, timeline: freshTimeline }
                  : app
              )
            )
          } else {
            loadApplications()
          }
        }
      )
      .subscribe()

    return () => {
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
    applied: "bg-blue-600 text-white",
    shortlisted: "bg-amber-600 text-white",
    selected: "bg-emerald-600 text-white",
    rejected: "bg-red-600 text-white",
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Job Applications</h1>
          <p className="text-muted-foreground mt-1">
            Track the status of applications you have submitted to hiring companies.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          Live Updates Active
        </Badge>
      </div>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading your applications...</p>
        </div>
      ) : applications.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center space-y-3">
          <h3 className="text-lg font-medium">You haven&apos;t submitted any applications yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Discover verified openings and submit your resume directly to hiring teams.
          </p>
          <Link to="/jobs">
            <Button>Explore Open Jobs</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => {
            const timeline = app.timeline || []

            return (
              <Card key={app.id} className="p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Link to={`/jobs/${app.job?.id}`} className="font-semibold text-lg hover:underline">
                        {app.job?.title || "Position"}
                      </Link>
                      <Badge className={`uppercase text-[11px] tracking-wide ${statusBadgeVariants[app.status] || ""}`}>
                        {app.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                      <span>Company: {app.job?.company?.name || "Company"}</span>
                      <span>Location: {app.job?.location || "Location"}</span>
                      <span>Type: {app.job?.job_type?.replace("_", " ")}</span>
                      <span>Submitted: {new Date(app.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewResume(app.id, app.resume_path)}
                      disabled={resumeLoadingId === app.id}
                    >
                      {resumeLoadingId === app.id ? "Opening..." : "View Resume"}
                    </Button>
                    <Link to={`/jobs/${app.job?.id}`}>
                      <Button variant="ghost" size="sm">
                        View Job
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="pt-3 border-t">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Status Timeline:</p>
                  {timeline.length === 0 ? (
                    <div className="flex items-center gap-1.5 bg-muted/60 px-2.5 py-1 rounded-md border text-foreground w-fit text-xs">
                      <span className="font-bold uppercase tracking-wider text-[10px]">{app.status}</span>
                      <span className="text-muted-foreground text-[10px]">
                        {new Date(app.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {timeline.map((h, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 bg-muted/60 px-2.5 py-1 rounded-md border text-foreground">
                            <span className="font-bold uppercase tracking-wider text-[10px]">{h.to_status}</span>
                            <span className="text-muted-foreground text-[10px]">
                              {new Date(h.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {idx < timeline.length - 1 && (
                            <span className="text-muted-foreground font-bold">&rarr;</span>
                          )}
                        </div>
                      ))}
                    </div>
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
