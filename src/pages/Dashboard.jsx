import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import AdminAnnouncement from "@/components/AdminAnnouncement"

export default function Dashboard() {
  const { user, profile } = useAuth()
  const role = profile?.role || "candidate"

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
      if (!user?.id || (role !== "recruiter" && role !== "admin")) return

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

  const roleBadgeVariants = {
    admin: "bg-red-500 hover:bg-red-600 text-white",
    recruiter: "bg-blue-600 hover:bg-blue-700 text-white",
    candidate: "bg-emerald-600 hover:bg-emerald-700 text-white",
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {profile?.full_name || user?.email || "User"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Active Role:</span>
          <Badge className={`uppercase text-xs tracking-wider ${roleBadgeVariants[role] || ""}`}>
            {role}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Account Profile</CardTitle>
            <CardDescription>Verified account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Full Name: </span>
              <span className="font-medium">{profile?.full_name || "Not set"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Email: </span>
              <span className="font-medium">{profile?.email || user?.email}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Member Since: </span>
              <span className="font-medium">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "Today"}
              </span>
            </div>
          </CardContent>
        </Card>

        {role === "candidate" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">My Applications</CardTitle>
                <CardDescription>Track status and review submissions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  Review the positions you have applied for and access your uploaded resumes.
                </p>
                <Link to="/dashboard/my-applications">
                  <Button size="sm">View My Applications</Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Saved Jobs</CardTitle>
                <CardDescription>Review your bookmarked opportunities</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  Manage the openings you have bookmarked for quick access.
                </p>
                <Link to="/saved">
                  <Button variant="outline" size="sm">
                    View Saved Jobs
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </>
        )}

        {(role === "recruiter" || role === "admin") && (
          <>
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">Company Credits</CardTitle>
                    <CardDescription>
                      {companyName ? `For ${companyName}` : "Application balance"}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    10 cr / apply
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-3xl font-extrabold text-primary">
                  {loadingCredits ? "..." : creditBalance !== null ? `${creditBalance} Credits` : "0 Credits"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Credits are automatically deducted when candidates submit applications. Postings pause automatically when credits reach 0.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Manage Postings</CardTitle>
                <CardDescription>Active and paused listings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  Review applicant pipelines, toggle listing availability, and post new openings.
                </p>
                <div className="flex gap-2">
                  <Link to="/jobs/new">
                    <Button size="sm">+ Post Job</Button>
                  </Link>
                  <Link to="/dashboard/my-jobs">
                    <Button variant="outline" size="sm">
                      My Jobs
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {role === "admin" && (
        <div className="mt-6">
          <AdminAnnouncement />
        </div>
      )}

      {(role === "recruiter" || role === "admin") && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-xl">Hiring Pipeline Metrics</CardTitle>
                <CardDescription>
                  {companyName ? `Company-level performance for ${companyName}` : "Company hiring overview"}
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-mono">
                Last 7 Days: {metrics.last7Days}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-muted/40 p-3 rounded-lg border text-center space-y-1">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">Total Applicants</span>
                <p className="text-2xl font-bold text-foreground">{metrics.total}</p>
              </div>
              <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-200 text-center space-y-1">
                <span className="text-[11px] text-blue-700 uppercase font-semibold">Applied</span>
                <p className="text-2xl font-bold text-blue-700">{metrics.applied}</p>
              </div>
              <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-200 text-center space-y-1">
                <span className="text-[11px] text-amber-700 uppercase font-semibold">Shortlisted</span>
                <p className="text-2xl font-bold text-amber-700">{metrics.shortlisted}</p>
              </div>
              <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-200 text-center space-y-1">
                <span className="text-[11px] text-emerald-700 uppercase font-semibold">Selected</span>
                <p className="text-2xl font-bold text-emerald-700">{metrics.selected}</p>
              </div>
              <div className="bg-red-50/50 p-3 rounded-lg border border-red-200 text-center space-y-1">
                <span className="text-[11px] text-red-700 uppercase font-semibold">Rejected</span>
                <p className="text-2xl font-bold text-red-700">{metrics.rejected}</p>
              </div>
              <div className="bg-muted/40 p-3 rounded-lg border text-center space-y-1">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">Selection Rate</span>
                <p className="text-2xl font-bold text-foreground">{metrics.selectionRate}</p>
              </div>
            </div>

            <div className="pt-2 border-t flex flex-wrap justify-between items-center text-xs text-muted-foreground gap-2">
              <span>
                Total Credits Spent on Applications: <strong className="text-foreground">{metrics.creditsSpent} cr</strong>
              </span>
              <span>
                Recent Applicants (Last 7 Days): <strong className="text-foreground">{metrics.last7Days}</strong>
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {(role === "recruiter" || role === "admin") && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-xl">Credit Ledger (Last 20 Transactions)</CardTitle>
            <CardDescription>
              Immutable audit log of credits added via admin topup and deducted for candidate applications.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingCredits ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Loading transaction history...</p>
            ) : ledgerEntries.length === 0 ? (
              <div className="text-center py-6 border border-dashed rounded-md text-sm text-muted-foreground">
                No credit transactions recorded yet for this company.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Change</th>
                      <th className="py-2.5 px-3">Balance After</th>
                      <th className="py-2.5 px-3">Reference / Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {ledgerEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-muted/10">
                        <td className="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(entry.created_at).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge
                            variant={entry.amount > 0 ? "default" : "secondary"}
                            className="text-[10px] uppercase font-mono"
                          >
                            {entry.type.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className={`py-2.5 px-3 font-semibold ${entry.amount > 0 ? "text-emerald-600" : "text-destructive"}`}>
                          {entry.amount > 0 ? `+${entry.amount}` : entry.amount}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-medium">
                          {entry.balance_after}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-muted-foreground">
                          {entry.reference ? (
                            <span className="font-mono font-medium text-foreground mr-1.5">
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
    </div>
  )
}
