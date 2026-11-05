import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { motion, useReducedMotion } from "framer-motion"
import { 
  Briefcase, 
  Search, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  Building2, 
  ShieldCheck, 
  Sparkles,
  Users,
  FileCheck
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import PageTransition from "@/components/PageTransition"
import { supabase } from "@/lib/supabase"

export default function Home() {
  const shouldReduceMotion = useReducedMotion()
  const [featuredJobs, setFeaturedJobs] = useState([])
  const [loadingJobs, setLoadingJobs] = useState(true)

  useEffect(() => {
    async function fetchFeatured() {
      try {
        const { data } = await supabase
          .from("jobs")
          .select(`
            id,
            title,
            location,
            job_type,
            salary_min,
            salary_max,
            experience_level,
            created_at,
            company:companies!inner(name, location, verification_status)
          `)
          .eq("status", "open")
          .eq("company.verification_status", "approved")
          .order("created_at", { ascending: false })
          .limit(3)

        if (data) setFeaturedJobs(data)
      } catch (err) {
        console.error("Error loading featured jobs:", err)
      } finally {
        setLoadingJobs(false)
      }
    }

    fetchFeatured()
  }, [])

  const candidateSteps = [
    {
      icon: Search,
      title: "1. Discover Verified Roles",
      desc: "Browse curated listings with explicit salary bands, remote flexibility, and zero spam recruiters.",
    },
    {
      icon: FileCheck,
      title: "2. One-Click PDF Application",
      desc: "Apply cleanly with your formatted resume stored securely in your private candidate vault.",
    },
    {
      icon: Clock,
      title: "3. Live Timeline Tracking",
      desc: "See every status transition — from Applied to Shortlisted or Selected — updated live with zero ghosting.",
    },
  ]

  const recruiterSteps = [
    {
      icon: Building2,
      title: "1. Verified Company Profile",
      desc: "Fast admin review ensures genuine companies and protects candidate trust across the portal.",
    },
    {
      icon: Users,
      title: "2. Targeted Candidate Inflow",
      desc: "Reach motivated developers, designers, and managers with filterable location and tech skill criteria.",
    },
    {
      icon: Sparkles,
      title: "3. Fair Credit System",
      desc: "Transparent 10-credit per candidate model with instant email updates for selected applicants.",
    },
  ]

  return (
    <PageTransition className="space-y-16 sm:space-y-24 py-4 sm:py-8 px-4 sm:px-6">
      <section className="relative overflow-hidden pt-4 pb-8 sm:py-12 text-center max-w-4xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-orange/30 bg-brand-orange/10 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-brand-orange shadow-sm backdrop-blur-sm">
          <Sparkles className="h-4 w-4 animate-pulse text-brand-orange" />
          <span>JOBS | CAREER | OPPORTUNITIES</span>
          <span className="hidden sm:inline text-muted-foreground">•</span>
          <span className="hidden sm:inline text-muted-foreground">Zero Ghosting Policy</span>
        </div>

        <h1 className="font-heading text-2xl sm:text-4xl md:text-6xl font-extrabold tracking-tight text-foreground leading-tight pb-1">
          Connecting Ambitious Talent With{" "}
          <span className="inline-block pb-1 leading-snug break-words bg-gradient-to-r from-primary via-blue-800 to-brand-orange bg-clip-text text-transparent">
            Transparent Career Roles
          </span>
        </h1>

        <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Skip outdated job portals. Explore verified positions across India on Job Pe Charcha, submit direct applications, and track your recruitment timeline in real time.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link to="/jobs" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto h-12 px-8 text-base shadow-md shadow-primary/25 gap-2 group">
              <Search className="h-4 w-4" />
              <span>Explore Open Jobs</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
          <Link to="/login" className="w-full sm:w-auto">
            <Button variant="outline" size="lg" className="w-full sm:w-auto h-12 px-6 text-base gap-2">
              <Building2 className="h-4 w-4" />
              <span>Post a Job as Employer</span>
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-8 text-left">
          {[
            { label: "100% Verified", sub: "Approved employers" },
            { label: "Live Timeline", sub: "Real-time status updates" },
            { label: "Fair Hiring", sub: "Credit-based model" },
            { label: "Direct Resumes", sub: "Secure private PDF vault" },
          ].map((item, idx) => (
            <div key={idx} className="p-3 sm:p-4 rounded-xl border bg-card/60 backdrop-blur-sm space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-600 ">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="text-xs sm:text-sm font-bold text-foreground">{item.label}</span>
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground">{item.sub}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <Badge variant="outline" className="mb-2 text-primary border-primary/20">
              Top Verified Openings
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight">
              Featured Opportunities
            </h2>
          </div>
          <Link to="/jobs" className="text-sm font-semibold text-primary hover:underline flex items-center gap-1">
            View all open positions <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {loadingJobs ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-5 space-y-3 animate-pulse">
                <div className="h-5 bg-muted rounded w-2/3" />
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-12 bg-muted/60 rounded" />
                <div className="h-8 bg-muted rounded w-1/3" />
              </Card>
            ))}
          </div>
        ) : featuredJobs.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <p className="text-muted-foreground text-sm">
              New job listings are being verified. Check back shortly or view all available listings.
            </p>
            <Link to="/jobs" className="inline-block mt-3">
              <Button variant="outline" size="sm">
                Browse Jobs
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {featuredJobs.map((job) => (
              <motion.div
                key={job.id}
                whileHover={shouldReduceMotion ? {} : { y: -3 }}
                transition={{ duration: 0.18 }}
              >
                <Card className="h-full flex flex-col justify-between p-5 hover:border-primary/50 hover:shadow-md transition-all duration-200">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                        {job.company?.name?.slice(0, 2).toUpperCase() || "CO"}
                      </div>
                      <Badge variant="secondary" className="capitalize text-[11px]">
                        {job.job_type.replace("_", " ")}
                      </Badge>
                    </div>

                    <div>
                      <h3 className="font-bold text-base line-clamp-1 hover:text-primary transition-colors">
                        <Link to={`/jobs/${job.id}`}>{job.title}</Link>
                      </h3>
                      <p className="text-xs font-medium text-muted-foreground mt-0.5">
                        {job.company?.name} • 📍 {job.location}
                      </p>
                    </div>

                    {(job.salary_min || job.salary_max) && (
                      <div className="text-xs font-semibold text-emerald-600  bg-emerald-500/10 px-2 py-1 rounded w-fit">
                        💰 ₹{job.salary_min ? (job.salary_min / 100000).toFixed(1) : ""}
                        {job.salary_max ? ` - ₹${(job.salary_max / 100000).toFixed(1)}L` : "L"} PA
                      </div>
                    )}
                  </div>

                  <div className="pt-4 mt-4 border-t flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      Exp: {job.experience_level} yrs
                    </span>
                    <Link to={`/jobs/${job.id}`}>
                      <Button size="sm" variant="outline" className="h-8 text-xs">
                        Details →
                      </Button>
                    </Link>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-10">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <Badge variant="outline" className="text-primary border-primary/20">
            Simple & Transparent
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight">
            How Job Pe Charcha Works
          </h2>
          <p className="text-sm text-muted-foreground">
            A frictionless experience built for both job seekers and hiring teams in modern tech.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-6 sm:p-8 rounded-2xl border bg-card/60 backdrop-blur-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600  flex items-center justify-center font-bold">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-lg">For Job Seekers</h3>
                <p className="text-xs text-muted-foreground">Find verified roles & track applications</p>
              </div>
            </div>

            <div className="space-y-4">
              {candidateSteps.map((s, idx) => (
                <div key={idx} className="flex gap-3.5 items-start">
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-primary shrink-0 mt-0.5">
                    <s.icon className="h-4 w-4" />
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-semibold text-foreground">{s.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link to="/jobs" className="block pt-2">
              <Button variant="outline" className="w-full text-xs">
                Browse Candidates Roles →
              </Button>
            </Link>
          </div>

          <div className="p-6 sm:p-8 rounded-2xl border bg-card/60 backdrop-blur-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600  flex items-center justify-center font-bold">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-lg">For Employers</h3>
                <p className="text-xs text-muted-foreground">List openings & hire qualified applicants</p>
              </div>
            </div>

            <div className="space-y-4">
              {recruiterSteps.map((s, idx) => (
                <div key={idx} className="flex gap-3.5 items-start">
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
                    <s.icon className="h-4 w-4" />
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-semibold text-foreground">{s.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link to="/company/setup" className="block pt-2">
              <Button variant="outline" className="w-full text-xs">
                Register Your Company →
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 p-8 sm:p-12 text-center space-y-6">
        <div className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center mx-auto shadow-lg shadow-primary/30">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div className="max-w-xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-foreground">
            Ready to Take the Next Step in Your Career?
          </h2>
          <p className="text-sm text-muted-foreground">
            Join thousands of developers and tech professionals finding real roles without the noise.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link to="/signup" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto h-11 px-8 text-sm">
              Create Free Account
            </Button>
          </Link>
          <Link to="/jobs" className="w-full sm:w-auto">
            <Button variant="outline" size="lg" className="w-full sm:w-auto h-11 px-6 text-sm">
              Search Open Positions
            </Button>
          </Link>
        </div>
      </section>
    </PageTransition>
  )
}
