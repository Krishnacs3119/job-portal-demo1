import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Building2, MapPin, Briefcase, Bookmark, Trash2, Inbox, ArrowRight } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import PageTransition from "@/components/PageTransition"

export default function SavedJobs() {
  const { user } = useAuth()
  const shouldReduceMotion = useReducedMotion()
  const [savedList, setSavedList] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState("")
  const [unsavingId, setUnsavingId] = useState(null)

  const fetchSavedJobs = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("saved_jobs")
        .select(`
          id,
          created_at,
          job:jobs (
            id,
            title,
            location,
            job_type,
            salary_min,
            salary_max,
            experience_level,
            status,
            company:companies (
              id,
              name,
              location
            )
          )
        `)
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false })

      if (error) throw error
      setSavedList(data || [])
    } catch (err) {
      setErrorMsg(err.message || "Failed to load saved jobs.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.id) {
      fetchSavedJobs()
    }
  }, [user])

  const handleUnsave = async (savedRecordId, _jobId) => {
    setUnsavingId(savedRecordId)
    try {
      const { error } = await supabase
        .from("saved_jobs")
        .delete()
        .eq("id", savedRecordId)

      if (error) throw error
      setSavedList((prev) => prev.filter((item) => item.id !== savedRecordId))
    } catch (err) {
      alert(err.message || "Failed to remove job from saved list.")
    } finally {
      setUnsavingId(null)
    }
  }

  return (
    <PageTransition className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-foreground">
            Saved Opportunities
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Keep track of roles you find interesting and submit your applications when ready.
          </p>
        </div>
        <Link to="/jobs">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 font-medium">
            <span>Explore More Jobs</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      {errorMsg && (
        <Alert variant="destructive" className="text-xs py-2.5">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-5 space-y-3">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
            </Card>
          ))}
        </div>
      ) : savedList.length === 0 ? (
        <Card className="rounded-2xl border-dashed p-10 sm:p-14 text-center space-y-4 bg-card/40">
          <div className="h-12 w-12 rounded-2xl bg-muted/80 text-muted-foreground flex items-center justify-center mx-auto">
            <Inbox className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-heading font-semibold text-foreground">
              You haven&apos;t bookmarked any jobs yet
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
              Browse open positions and click the &quot;Save&quot; button to bookmark openings here.
            </p>
          </div>
          <Link to="/jobs">
            <Button size="sm" className="shadow-sm shadow-primary/20">Browse Jobs</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {savedList.map((item) => {
            const job = item.job
            if (!job) return null

            return (
              <motion.div
                key={item.id}
                whileHover={shouldReduceMotion ? {} : { y: -1 }}
                transition={{ duration: 0.15 }}
              >
                <Card className="p-4 sm:p-5 shadow-sm hover:border-primary/40 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/jobs/${job.id}`}
                          className="font-heading font-bold text-base sm:text-lg text-foreground hover:text-primary transition-colors line-clamp-1"
                        >
                          {job.title}
                        </Link>
                        <Badge variant={job.status === "open" ? "default" : "secondary"} className="text-[10px]">
                          {job.status === "open" ? "Open" : "Closed"}
                        </Badge>
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
                        <span className="capitalize">{job.job_type?.replace("_", " ")}</span>
                        {(job.salary_min || job.salary_max) && (
                          <>
                            <span>&bull;</span>
                            <span className="text-emerald-600  font-medium">
                              ₹{job.salary_min ? (job.salary_min / 100000).toFixed(1) : ""}
                              {job.salary_max ? ` - ${(job.salary_max / 100000).toFixed(1)}` : ""}L PA
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-muted-foreground hover:text-destructive gap-1"
                        onClick={() => handleUnsave(item.id, job.id)}
                        disabled={unsavingId === item.id}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Remove</span>
                      </Button>
                      <Link to={`/jobs/${job.id}`}>
                        <Button size="sm" className="h-8 text-xs font-semibold shadow-xs">
                          View & Apply →
                        </Button>
                      </Link>
                    </div>
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
