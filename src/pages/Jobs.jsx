import { useEffect, useState, useCallback } from "react"
import { Link } from "react-router-dom"
import { motion, useReducedMotion } from "framer-motion"
import { 
  Search, 
  MapPin, 
  Briefcase, 
  Filter, 
  RotateCcw, 
  Bookmark, 
  BookmarkCheck, 
  Building2, 
  Calendar,
  Inbox
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import PageTransition from "@/components/PageTransition"

export default function Jobs() {
  const { user, profile } = useAuth()
  const shouldReduceMotion = useReducedMotion()

  const [jobs, setJobs] = useState([])
  const [companies, setCompanies] = useState([])
  const [savedJobIds, setSavedJobIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [showMobileFilters, setShowMobileFilters] = useState(false)

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

  // Count active filters
  const activeFilterCount = [
    keyword,
    selectedLocation,
    selectedJobType,
    selectedCompany,
    selectedExp,
    minSalary,
  ].filter(Boolean).length

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

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.04,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 8 },
    show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: "easeOut" } },
  }

  return (
    <PageTransition className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight">
            Explore Tech Opportunities
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Browse verified openings, review explicit salary bands, and apply directly.
          </p>
        </div>

        {/* Mobile toggle button */}
        <Button
          variant="outline"
          size="sm"
          className="sm:hidden flex items-center justify-between gap-2 h-9 text-xs"
          onClick={() => setShowMobileFilters((prev) => !prev)}
        >
          <span className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5" />
            {showMobileFilters ? "Hide Filters" : "Show Filters"}
          </span>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="px-1.5 py-0 h-4 text-[10px] bg-primary text-primary-foreground">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Filter Section */}
      <Card className={`p-4 sm:p-5 space-y-4 shadow-sm border bg-card/80 backdrop-blur-sm ${showMobileFilters ? "block" : "hidden sm:block"}`}>
        {/* Main Search & Location Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9 text-sm h-10"
              placeholder="Title, skill, or role keyword..."
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value)
                setPage(1)
              }}
            />
          </div>

          <div className="relative">
            <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9 text-sm h-10"
              placeholder="City or location (e.g. Remote, Bengaluru)..."
              value={selectedLocation}
              onChange={(e) => {
                setSelectedLocation(e.target.value)
                setPage(1)
              }}
            />
          </div>

          <select
            className="w-full rounded-lg border border-input bg-background px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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

        {/* Second Row: Company, Experience, Salary, Clear */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          <select
            className="w-full rounded-lg border border-input bg-background px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
            className="w-full rounded-lg border border-input bg-background px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={selectedExp}
            onChange={(e) => {
              setSelectedExp(e.target.value)
              setPage(1)
            }}
          >
            <option value="">Any Experience Level</option>
            <option value="0-1">Entry Level (0-1 yrs)</option>
            <option value="1-3">Junior / Mid (1-3 yrs)</option>
            <option value="3-5">Mid-Senior (3-5 yrs)</option>
            <option value="5+">Lead / Senior (5+ yrs)</option>
          </select>

          <Input
            className="text-sm h-10"
            type="number"
            placeholder="Min Salary (e.g. 600000)"
            value={minSalary}
            onChange={(e) => {
              setMinSalary(e.target.value)
              setPage(1)
            }}
          />

          <Button
            variant="outline"
            onClick={handleResetFilters}
            className="h-10 text-xs font-semibold gap-1.5"
            disabled={activeFilterCount === 0}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Filters
          </Button>
        </div>
      </Card>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground px-1">
        <span className="font-medium text-foreground">
          Showing <span className="text-primary font-semibold">{jobs.length}</span> of {totalCount} open positions
        </span>
        <span>
          Page {page} of {totalPages}
        </span>
      </div>

      {/* Skeletons while loading */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-6 w-1/3" />
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-12 w-full mt-2" />
                  <div className="flex gap-2 pt-1">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-28" />
                  </div>
                </div>
                <Skeleton className="h-9 w-24 shrink-0" />
              </div>
            </Card>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        /* Empty State */
        <Card className="rounded-2xl border-dashed p-10 sm:p-14 text-center space-y-4 bg-card/40">
          <div className="h-12 w-12 rounded-2xl bg-muted/80 text-muted-foreground flex items-center justify-center mx-auto">
            <Inbox className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-heading font-semibold text-foreground">No openings match your search</h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
              We couldn&apos;t find any roles matching your current filters. Try expanding your keyword or resetting your filter options.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleResetFilters} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset All Filters
          </Button>
        </Card>
      ) : (
        /* Staggered Jobs List */
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-3"
        >
          {jobs.map((job) => {
            const isSaved = savedJobIds.has(job.id)
            return (
              <motion.div key={job.id} variants={itemVariants}>
                <Card className="p-4 sm:p-5 hover:border-primary/40 hover:shadow-md transition-all duration-200 group">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/jobs/${job.id}`}
                            className="text-lg sm:text-xl font-heading font-bold text-foreground hover:text-primary transition-colors group-hover:text-primary line-clamp-1"
                          >
                            {job.title}
                          </Link>
                          {job.company?.verification_status === "approved" && (
                            <span title="Verified Employer" className="text-emerald-600  text-xs shrink-0 font-medium">
                              ✓
                            </span>
                          )}
                        </div>

                        <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2">
                          <span className="font-semibold text-foreground/80 flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            {job.company?.name}
                          </span>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                            {job.location}
                          </span>
                        </p>
                      </div>

                      <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                        {job.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <Badge variant="secondary" className="capitalize text-[11px] font-medium gap-1">
                          <Briefcase className="h-3 w-3" />
                          {job.job_type.replace("_", " ")}
                        </Badge>
                        <Badge variant="outline" className="text-[11px]">
                          🎯 {job.experience_level} yrs exp
                        </Badge>
                        {(job.salary_min || job.salary_max) && (
                          <Badge variant="outline" className="text-[11px] font-semibold text-emerald-600  border-emerald-500/20 bg-emerald-500/5">
                            💰 ₹{job.salary_min ? (job.salary_min / 100000).toFixed(1) : ""}
                            {job.salary_max ? ` - ₹${(job.salary_max / 100000).toFixed(1)}L` : "L"} PA
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(job.created_at).toLocaleDateString()}
                      </span>

                      <div className="flex items-center gap-2">
                        {profile?.role === "candidate" && (
                          <Button
                            variant={isSaved ? "secondary" : "outline"}
                            size="sm"
                            className="h-8 text-xs gap-1"
                            onClick={() => handleToggleSave(job.id)}
                            disabled={savingId === job.id}
                            title={isSaved ? "Remove from saved" : "Bookmark this job"}
                          >
                            {isSaved ? (
                              <>
                                <BookmarkCheck className="h-3.5 w-3.5 text-primary fill-primary" />
                                <span className="hidden sm:inline">Saved</span>
                              </>
                            ) : (
                              <>
                                <Bookmark className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Save</span>
                              </>
                            )}
                          </Button>
                        )}
                        <Link to={`/jobs/${job.id}`}>
                          <Button size="sm" className="h-8 text-xs font-semibold shadow-sm">
                            View Details →
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 pt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPage((p) => Math.max(1, p - 1))
              window.scrollTo({ top: 0, behavior: "smooth" })
            }}
            disabled={page === 1 || loading}
            className="text-xs h-8"
          >
            ← Previous
          </Button>
          <span className="text-xs font-medium text-muted-foreground px-2">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPage((p) => Math.min(totalPages, p + 1))
              window.scrollTo({ top: 0, behavior: "smooth" })
            }}
            disabled={page === totalPages || loading}
            className="text-xs h-8"
          >
            Next →
          </Button>
        </div>
      )}
    </PageTransition>
  )
}
