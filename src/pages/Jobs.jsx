import { useEffect, useState, useCallback } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

export default function Jobs() {
  const { user, profile } = useAuth()

  const [jobs, setJobs] = useState([])
  const [companies, setCompanies] = useState([])
  const [savedJobIds, setSavedJobIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)

  // Search & Filters
  const [keyword, setKeyword] = useState("")
  const [selectedLocation, setSelectedLocation] = useState("")
  const [selectedJobType, setSelectedJobType] = useState("")
  const [selectedCompany, setSelectedCompany] = useState("")
  const [selectedExp, setSelectedExp] = useState("")
  const [minSalary, setMinSalary] = useState("")

  // Pagination (10 per page)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const PAGE_SIZE = 10

  // Load available companies for filter dropdown
  useEffect(() => {
    async function loadCompanies() {
      const { data } = await supabase
        .from("companies")
        .select("id, name")
        .eq("verification_status", "approved")
        .order("name")
      if (data) setCompanies(data)
    }
    loadCompanies()
  }, [])

  // Load user's saved job IDs if logged in candidate
  useEffect(() => {
    async function loadSavedJobs() {
      if (!user?.id || profile?.role !== "candidate") return
      const { data } = await supabase
        .from("saved_jobs")
        .select("job_id")
        .eq("user_id", user.id)

      if (data) {
        setSavedJobIds(new Set(data.map((item) => item.job_id)))
      }
    }
    loadSavedJobs()
  }, [user, profile])

  // Fetch jobs with filters and pagination
  const fetchJobs = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from("jobs")
        .select(
          `
          *,
          company:companies!inner(id, name, location, logo_url, verification_status)
        `,
          { count: "exact" }
        )
        .eq("status", "open")
        .eq("company.verification_status", "approved")
        .order("created_at", { ascending: false })

      // Keyword search in title or description
      if (keyword.trim()) {
        query = query.or(
          `title.ilike.%${keyword.trim()}%,description.ilike.%${keyword.trim()}%`
        )
      }

      // Location filter
      if (selectedLocation.trim()) {
        query = query.ilike("location", `%${selectedLocation.trim()}%`)
      }

      // Job Type filter
      if (selectedJobType) {
        query = query.eq("job_type", selectedJobType)
      }

      // Company filter
      if (selectedCompany) {
        query = query.eq("company_id", selectedCompany)
      }

      // Experience Level filter
      if (selectedExp) {
        query = query.eq("experience_level", selectedExp)
      }

      // Min Salary filter
      if (minSalary) {
        const salaryVal = parseInt(minSalary, 10)
        if (!isNaN(salaryVal) && salaryVal > 0) {
          query = query.gte("salary_max", salaryVal)
        }
      }

      // Range for pagination
      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      query = query.range(from, to)

      const { data, count, error } = await query
      if (error) throw error

      setJobs(data || [])
      setTotalCount(count || 0)
    } catch (err) {
      console.error("Error fetching jobs:", err)
    } finally {
      setLoading(false)
    }
  }, [keyword, selectedLocation, selectedJobType, selectedCompany, selectedExp, minSalary, page])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  // Save / Unsave handler for Candidates
  const handleToggleSave = async (jobId) => {
    if (!user) {
      alert("Please login as a candidate to bookmark jobs.")
      return
    }
    if (profile?.role !== "candidate") {
      alert("Only candidates can save jobs.")
      return
    }

    setSavingId(jobId)
    const isSaved = savedJobIds.has(jobId)

    try {
      if (isSaved) {
        const { error } = await supabase
          .from("saved_jobs")
          .delete()
          .eq("user_id", user.id)
          .eq("job_id", jobId)
        if (error) throw error

        setSavedJobIds((prev) => {
          const next = new Set(prev)
          next.delete(jobId)
          return next
        })
      } else {
        const { error } = await supabase
          .from("saved_jobs")
          .insert({ user_id: user.id, job_id: jobId })
        if (error) throw error

        setSavedJobIds((prev) => new Set(prev).add(jobId))
      }
    } catch (err) {
      alert(err.message || "Failed to update saved job.")
    } finally {
      setSavingId(null)
    }
  }

  // Clear all filters
  const handleResetFilters = () => {
    setKeyword("")
    setSelectedLocation("")
    setSelectedJobType("")
    setSelectedCompany("")
    setSelectedExp("")
    setMinSalary("")
    setPage(1)
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Explore Opportunities</h1>
        <p className="text-muted-foreground mt-1">
          Browse verified job openings and apply with confidence.
        </p>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input
            placeholder="Search by title, skill, or keyword..."
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value)
              setPage(1)
            }}
          />

          <Input
            placeholder="Filter by city / location (e.g. Remote, Bengaluru)..."
            value={selectedLocation}
            onChange={(e) => {
              setSelectedLocation(e.target.value)
              setPage(1)
            }}
          />

          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={selectedJobType}
            onChange={(e) => {
              setSelectedJobType(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All Job Types</option>
            <option value="full_time">Full-time</option>
            <option value="part_time">Part-time</option>
            <option value="internship">Internship</option>
            <option value="contract">Contract</option>
            <option value="remote">Remote</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={selectedCompany}
            onChange={(e) => {
              setSelectedCompany(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All Companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={selectedExp}
            onChange={(e) => {
              setSelectedExp(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All Experience Levels</option>
            <option value="fresher">Fresher</option>
            <option value="1-3">1 - 3 Years</option>
            <option value="3-5">3 - 5 Years</option>
            <option value="5+">5+ Years</option>
          </select>

          <Input
            type="number"
            placeholder="Min Salary (₹ INR, e.g. 500000)"
            value={minSalary}
            onChange={(e) => {
              setMinSalary(e.target.value)
              setPage(1)
            }}
          />

          <Button variant="outline" onClick={handleResetFilters}>
            Reset Filters
          </Button>
        </div>
      </Card>

      {/* Results Header */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Showing {jobs.length} of {totalCount} open positions</span>
        <span>Page {page} of {totalPages}</span>
      </div>

      {/* Jobs List */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm text-muted-foreground">Fetching latest jobs...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center space-y-3">
          <h3 className="text-lg font-medium">No jobs found matching your criteria</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Try adjusting your search terms, changing filters, or clearing filters to see more results.
          </p>
          <Button variant="outline" onClick={handleResetFilters}>
            Clear All Filters
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => {
            const isSaved = savedJobIds.has(job.id)
            return (
              <Card key={job.id} className="p-5 hover:border-primary/50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div>
                      <Link
                        to={`/jobs/${job.id}`}
                        className="text-xl font-bold hover:text-primary transition-colors hover:underline"
                      >
                        {job.title}
                      </Link>
                      <p className="text-sm font-medium text-muted-foreground mt-0.5">
                        {job.company?.name} • 📍 {job.location}
                      </p>
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {job.description}
                    </p>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Badge variant="secondary">💼 {job.job_type.replace("_", " ")}</Badge>
                      <Badge variant="outline">🎯 {job.experience_level} yrs exp</Badge>
                      {(job.salary_min || job.salary_max) && (
                        <Badge variant="outline">
                          💰 {job.salary_min ? `₹${(job.salary_min / 100000).toFixed(1)}L` : ""}
                          {job.salary_max ? ` - ₹${(job.salary_max / 100000).toFixed(1)}L` : ""}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {new Date(job.created_at).toLocaleDateString()}
                    </span>

                    <div className="flex gap-2">
                      {profile?.role === "candidate" && (
                        <Button
                          variant={isSaved ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => handleToggleSave(job.id)}
                          disabled={savingId === job.id}
                        >
                          {isSaved ? "★ Saved" : "☆ Save"}
                        </Button>
                      )}
                      <Link to={`/jobs/${job.id}`}>
                        <Button size="sm">View Details</Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
