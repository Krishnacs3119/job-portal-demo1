import { useEffect, useState } from "react"
import { Link, Navigate } from "react-router-dom"
import { 
  User, 
  Briefcase, 
  Bookmark, 
  Coins, 
  PlusCircle, 
  TrendingUp, 
  ArrowRight
} from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AnimatedCounter } from "@/components/ui/animated-counter"
import PageTransition from "@/components/PageTransition"

export default function Dashboard() {
  const { user, profile } = useAuth()
  const role = profile?.role || "candidate"
  const shouldReduceMotion = useReducedMotion()

  const [creditBalance, setCreditBalance] = useState(null)
  const [companyName, setCompanyName] = useState("")
  const [ledgerEntries, setLedgerEntries] = useState([])
  const [loadingCredits, setLoadingCredits] = useState(false)

  const [metrics, setMetrics] = useState({
    total: 0,
    applied: 0,
    shortlisted: 0,
    selected: 0,
    rejected: 0,
    selectionRate: "0%",
    last7Days: 0,
    creditsSpent: 0,
  })

  useEffect(() => {
    async function loadRecruiterCredits() {
      if (!user?.id || role !== "recruiter") return

      setLoadingCredits(true)
      try {
        const { data: companies } = await supabase.rpc("get_my_companies")
        const currentComp = companies?.[0]

        if (currentComp) {
          setCompanyName(currentComp.name)

          const { data: credData } = await supabase
            .from("company_credits")
            .select("balance, updated_at")
            .eq("company_id", currentComp.id)
            .maybeSingle()

          setCreditBalance(credData ? credData.balance : 0)

          const { data: ledgerData } = await supabase
            .from("credit_ledger")
            .select("*")
            .eq("company_id", currentComp.id)
            .order("created_at", { ascending: false })
            .limit(20)

          setLedgerEntries(ledgerData || [])

          const { data: compApps } = await supabase
            .from("applications")
            .select("id, status, created_at, credits_charged")
            .eq("company_id", currentComp.id)

          if (compApps) {
            const total = compApps.length
            const applied = compApps.filter((a) => a.status === "applied").length
            const shortlisted = compApps.filter((a) => a.status === "shortlisted").length
            const selected = compApps.filter((a) => a.status === "selected").length
            const rejected = compApps.filter((a) => a.status === "rejected").length
            const selectionRate = total > 0 ? ((selected / total) * 100).toFixed(1) + "%" : "0%"

            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            const last7Days = compApps.filter((a) => new Date(a.created_at) >= sevenDaysAgo).length

            const creditsSpent = compApps.reduce((acc, a) => acc + (a.credits_charged || 10), 0)

            setMetrics({
              total,
              applied,
              shortlisted,
              selected,
              rejected,
              selectionRate,
              last7Days,
              creditsSpent,
            })
          }
        }
      } catch (err) {
        console.error("Error fetching credit balance:", err)
      } finally {
        setLoadingCredits(false)
      }
    }

    loadRecruiterCredits()
  }, [user, role])

  if (role === "admin") {
    return <Navigate to="/admin" replace />
  }

  const roleBadgeVariants = {
    admin: "bg-red-500/15 text-red-700 border border-red-500/30",
    recruiter: "bg-blue-600/15 text-blue-700 border border-blue-600/30",
    candidate: "bg-emerald-600/15 text-emerald-700 border border-emerald-600/30",
  }

  return (
    <PageTransition className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-foreground">
            Portal Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Welcome back, <span className="font-semibold text-foreground">{profile?.full_name || user?.email || "User"}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Account Role:</span>
          <Badge className={`uppercase text-[10px] font-bold tracking-wider ${roleBadgeVariants[role] || ""}`}>
            {role}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <User className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-heading font-bold">Account Profile</CardTitle>
                <CardDescription className="text-xs">Verified identity</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs pt-0">
            <div className="flex justify-between py-1 border-b">
              <span className="text-muted-foreground">Full Name</span>
              <span className="font-semibold text-foreground">{profile?.full_name || "—"}</span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium text-foreground truncate max-w-[160px]">{user?.email || "—"}</span>
            </div>
            {profile?.phone && (
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Phone</span>
                <span className="font-mono font-medium text-foreground">{profile.phone}</span>
              </div>
            )}
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">User ID</span>
              <span className="font-mono text-muted-foreground">{user?.id?.slice(0, 8)}...</span>
            </div>
          </CardContent>
        </Card>

        {role === "candidate" && (
          <>
            <motion.div whileHover={shouldReduceMotion ? {} : { y: -2 }} transition={{ duration: 0.15 }}>
              <Card className="shadow-sm h-full flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                      <Briefcase className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-heading font-bold">My Applications</CardTitle>
                      <CardDescription className="text-xs">Live application tracking</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-xs pt-0">
                  <p className="text-muted-foreground leading-relaxed">
                    Review positions you have submitted, check your resume link, and watch status progressions.
                  </p>
                  <Link to="/dashboard/my-applications" className="block">
                    <Button size="sm" className="w-full text-xs h-9 gap-1 font-semibold shadow-sm">
                      <span>View Applications</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div whileHover={shouldReduceMotion ? {} : { y: -2 }} transition={{ duration: 0.15 }}>
              <Card className="shadow-sm h-full flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                      <Bookmark className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-heading font-bold">Saved Jobs</CardTitle>
                      <CardDescription className="text-xs">Your bookmarked positions</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-xs pt-0">
                  <p className="text-muted-foreground leading-relaxed">
                    Quickly access jobs you have bookmarked for later review or submission.
                  </p>
                  <Link to="/saved" className="block">
                    <Button variant="outline" size="sm" className="w-full text-xs h-9 gap-1 font-semibold">
                      <span>View Saved Openings</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}

        {role === "recruiter" && (
          <>
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                      <Coins className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-heading font-bold">Company Credits</CardTitle>
                      <CardDescription className="text-xs truncate max-w-[140px]">
                        {companyName ? `For ${companyName}` : "Application balance"}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    10 cr / apply
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="text-3xl font-heading font-extrabold text-primary">
                  {loadingCredits ? (
                    <Skeleton className="h-9 w-24" />
                  ) : creditBalance !== null ? (
                    <AnimatedCounter value={creditBalance} suffix=" Credits" />
                  ) : (
                    "0 Credits"
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Credits are automatically deducted when candidates submit applications. Postings pause automatically if credits reach 0.
                </p>
                <div className="pt-1">
                  <Link to="/dashboard/credits">
                    <Button size="sm" className="w-full text-xs h-8 font-semibold gap-1.5">
                      <Coins className="h-3.5 w-3.5" /> Buy credits
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-heading font-bold">Manage Postings</CardTitle>
                    <CardDescription className="text-xs">Active and paused listings</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs pt-0">
                <p className="text-muted-foreground leading-relaxed">
                  Review applicant pipelines, toggle listing availability, and create new openings.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Link to="/jobs/new">
                    <Button size="sm" className="w-full text-xs h-9 gap-1 font-semibold">
                      <PlusCircle className="h-3.5 w-3.5" /> Post Job
                    </Button>
                  </Link>
                  <Link to="/dashboard/my-jobs">
                    <Button variant="outline" size="sm" className="w-full text-xs h-9 font-semibold">
                      My Jobs
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {role === "recruiter" && (
        <Card className="shadow-sm mt-6">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg font-heading font-bold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <span>Hiring Pipeline Metrics</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  {companyName ? `Company-level performance for ${companyName}` : "Company hiring overview"}
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-mono w-fit">
                Last 7 Days: <AnimatedCounter value={metrics.last7Days} />
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-muted/40 p-3.5 rounded-xl border text-center space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Applicants</span>
                <p className="text-2xl font-heading font-extrabold text-foreground">
                  <AnimatedCounter value={metrics.total} />
                </p>
              </div>
              <div className="bg-blue-500/10 p-3.5 rounded-xl border border-blue-500/20 text-center space-y-1">
                <span className="text-[10px] text-blue-700 uppercase font-bold tracking-wider">Applied</span>
                <p className="text-2xl font-heading font-extrabold text-blue-600">
                  <AnimatedCounter value={metrics.applied} />
                </p>
              </div>
              <div className="bg-amber-500/10 p-3.5 rounded-xl border border-amber-500/20 text-center space-y-1">
                <span className="text-[10px] text-amber-700 uppercase font-bold tracking-wider">Shortlisted</span>
                <p className="text-2xl font-heading font-extrabold text-amber-600">
                  <AnimatedCounter value={metrics.shortlisted} />
                </p>
              </div>
              <div className="bg-emerald-500/10 p-3.5 rounded-xl border border-emerald-500/20 text-center space-y-1">
                <span className="text-[10px] text-emerald-700 uppercase font-bold tracking-wider">Selected</span>
                <p className="text-2xl font-heading font-extrabold text-emerald-600">
                  <AnimatedCounter value={metrics.selected} />
                </p>
              </div>
              <div className="bg-rose-500/10 p-3.5 rounded-xl border border-rose-500/20 text-center space-y-1">
                <span className="text-[10px] text-rose-700 uppercase font-bold tracking-wider">Rejected</span>
                <p className="text-2xl font-heading font-extrabold text-rose-600">
                  <AnimatedCounter value={metrics.rejected} />
                </p>
              </div>
              <div className="bg-muted/40 p-3.5 rounded-xl border text-center space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Selection Rate</span>
                <p className="text-2xl font-heading font-extrabold text-foreground">{metrics.selectionRate}</p>
              </div>
            </div>

            <div className="pt-3 border-t flex flex-wrap justify-between items-center text-xs text-muted-foreground gap-2">
              <span>
                Total Credits Spent on Applications: <strong className="text-foreground"><AnimatedCounter value={metrics.creditsSpent} suffix=" cr" /></strong>
              </span>
              <span>
                Recent Applicants (Last 7 Days): <strong className="text-foreground"><AnimatedCounter value={metrics.last7Days} /></strong>
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {role === "recruiter" && (
        <Card className="shadow-sm mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-heading font-bold">Credit Ledger (Last 20 Transactions)</CardTitle>
            <CardDescription className="text-xs">
              Immutable audit log of credits added via admin topup and deducted for candidate applications.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingCredits ? (
              <div className="space-y-2 py-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : ledgerEntries.length === 0 ? (
              <div className="text-center py-8 border border-dashed rounded-xl text-xs text-muted-foreground">
                No credit transactions recorded yet for this company.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-muted/40 text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Change</th>
                      <th className="py-2.5 px-3">Balance After</th>
                      <th className="py-2.5 px-3">Reference / Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {ledgerEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                          {new Date(entry.created_at).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge
                            variant={entry.amount > 0 ? "default" : "secondary"}
                            className="text-[9px] uppercase font-mono"
                          >
                            {entry.type.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className={`py-2.5 px-3 font-bold font-mono ${entry.amount > 0 ? "text-emerald-600" : "text-destructive"}`}>
                          {entry.amount > 0 ? `+${entry.amount}` : entry.amount}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-medium">
                          {entry.balance_after}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {entry.reference ? (
                            <span className="font-mono font-semibold text-foreground mr-1.5">
                              [{entry.reference}]
                            </span>
                          ) : null}
                          {entry.note || ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </PageTransition>
  )
}