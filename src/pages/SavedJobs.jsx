import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function SavedJobs() {
  const { user } = useAuth()
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

  const handleUnsave = async (savedRecordId, jobId) => {
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Saved Jobs</h1>
        <p className="text-muted-foreground mt-1">
          Keep track of positions you find interesting and apply when ready.
        </p>
      </div>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading saved positions...</p>
        </div>
      ) : savedList.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center space-y-3">
          <h3 className="text-lg font-medium">You haven&apos;t bookmarked any jobs yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Browse open opportunities and click the &quot;Save&quot; button to bookmark roles here.
          </p>
          <Link to="/jobs">
            <Button>Explore Jobs</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {savedList.map((item) => {
            const job = item.job
            if (!job) return null
            return (
              <Card key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Link to={`/jobs/${job.id}`} className="font-semibold text-lg hover:underline">
                      {job.title}
                    </Link>
                    <Badge variant={job.status === "open" ? "default" : "secondary"}>
                      {job.status === "open" ? "Active" : "Closed"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    <span>🏢 {job.company?.name}</span>
                    <span>📍 {job.location}</span>
                    <span>💼 {job.job_type.replace("_", " ")}</span>
                    {(job.salary_min || job.salary_max) && (
                      <span>
                        💰 {job.salary_min ? `₹${(job.salary_min / 100000).toFixed(1)}L` : ""}
                        {job.salary_max ? ` - ₹${(job.salary_max / 100000).toFixed(1)}L` : ""}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link to={`/jobs/${job.id}`}>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => handleUnsave(item.id, job.id)}
                    disabled={unsavingId === item.id}
                  >
                    {unsavingId === item.id ? "Removing..." : "Remove"}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
