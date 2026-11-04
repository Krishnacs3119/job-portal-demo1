import { useEffect, useState, useCallback } from "react"
import { Users, Building2, Briefcase, FileText, Coins, CheckCircle2, XCircle, Shield, RefreshCw } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview")
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [successMsg, setSuccessMsg] = useState("")

  const [metrics, setMetrics] = useState({
    users: 0,
    companies: 0,
    jobs: 0,
    applications: 0,
    credits: 0,
  })

  const [companies, setCompanies] = useState([])
  const [verifyingId, setVerifyingId] = useState(null)
  const [verificationFilter, setVerificationFilter] = useState("pending")

  const [topupCompanyId, setTopupCompanyId] = useState("")
  const [topupAmount, setTopupAmount] = useState(50)
  const [topupPaymentRef, setTopupPaymentRef] = useState("")
  const [topupNote, setTopupNote] = useState("")
  const [topupLoading, setTopupLoading] = useState(false)

  const [ledgerEntries, setLedgerEntries] = useState([])
  const [loadingLedger, setLoadingLedger] = useState(false)

  const [usersList, setUsersList] = useState([])
  const [userSearch, setUserSearch] = useState("")
  const [userRoleFilter, setUserRoleFilter] = useState("all")
  const [loadingUsers, setLoadingUsers] = useState(false)

  const loadOverviewMetrics = useCallback(async () => {
    try {
      const [
        { count: userCount },
        { count: companyCount },
        { count: jobCount },
        { count: appCount },
        { data: creditRows },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("companies").select("*", { count: "exact", head: true }),
        supabase.from("jobs").select("*", { count: "exact", head: true }),
        supabase.from("applications").select("*", { count: "exact", head: true }),
        supabase.from("company_credits").select("balance"),
      ])

      const totalCreditsSum = (creditRows || []).reduce((acc, row) => acc + (row.balance || 0), 0)

      setMetrics({
        users: userCount || 0,
        companies: companyCount || 0,
        jobs: jobCount || 0,
        applications: appCount || 0,
        credits: totalCreditsSum,
      })
    } catch (err) {
      console.error("Failed to load platform metrics:", err.message)
    }
  }, [])

  const loadCompanies = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("companies")
        .select(`
          id,
          name,
          website,
          location,
          verification_status,
          created_at,
          created_by,
          credits:company_credits(balance)
        `)
        .order("created_at", { ascending: false })

      if (error) throw error
      setCompanies(data || [])
      if (!topupCompanyId && data && data.length > 0) {
        setTopupCompanyId(data[0].id)
      }
    } catch (err) {
      console.error("Failed to load companies:", err.message)
    } finally {
      setLoading(false)
    }
  }, [topupCompanyId])

  const loadLedger = useCallback(async () => {
    try {
      setLoadingLedger(true)
      const { data, error } = await supabase
        .from("credit_ledger")
        .select(`
          id,
          company_id,
          type,
          amount,
          balance_after,
          reference,
          note,
          created_at,
          company:companies(name)
        `)
        .order("created_at", { ascending: false })
        .limit(50)

      if (error) throw error
      setLedgerEntries(data || [])
    } catch (err) {
      console.error("Failed to load credit ledger:", err.message)
    } finally {
      setLoadingLedger(false)
    }
  }, [])

  const loadUsers = useCallback(async () => {
    try {
      setLoadingUsers(true)
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, created_at")
        .order("created_at", { ascending: false })
        .limit(100)

      if (error) throw error
      setUsersList(data || [])
    } catch (err) {
      console.error("Failed to load users:", err.message)
    } finally {
      setLoadingUsers(false)
    }
  }, [])

  useEffect(() => {
    loadOverviewMetrics()
    loadCompanies()
  }, [loadOverviewMetrics, loadCompanies])

  useEffect(() => {
    if (activeTab === "ledger") {
      loadLedger()
    } else if (activeTab === "users") {
      loadUsers()
    } else if (activeTab === "verification") {
      loadCompanies()
    } else if (activeTab === "overview") {
      loadOverviewMetrics()
    }
  }, [activeTab, loadLedger, loadUsers, loadCompanies, loadOverviewMetrics])

  const handleVerifyCompany = async (companyId, newStatus) => {
    setErrorMsg("")
    setSuccessMsg("")
    setVerifyingId(companyId)

    try {
      const { error: rpcErr } = await supabase.rpc("admin_verify_company", {
        p_company_id: companyId,
        p_status: newStatus,
      })

      if (rpcErr) {
        const { error: updateErr } = await supabase
          .from("companies")
          .update({ verification_status: newStatus })
          .eq("id", companyId)
        if (updateErr) throw updateErr
      }

      setSuccessMsg(`Company status updated to ${newStatus.toUpperCase()}.`)
      await loadCompanies()
      await loadOverviewMetrics()
    } catch (err) {
      setErrorMsg(err.message || "Failed to update company verification status.")
    } finally {
      setVerifyingId(null)
    }
  }

  const handleTopupSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg("")
    setSuccessMsg("")

    if (!topupCompanyId) {
      setErrorMsg("Please select a target company.")
      return
    }

    const amountNum = parseInt(topupAmount, 10)
    if (isNaN(amountNum) || amountNum <= 0) {
      setErrorMsg("Credit amount must be greater than zero.")
      return
    }

    if (!topupPaymentRef.trim()) {
      setErrorMsg("Razorpay Payment Reference ID is required.")
      return
    }

    setTopupLoading(true)
    try {
      const { data: newBalance, error } = await supabase.rpc("admin_add_credits", {
        p_company_id: topupCompanyId,
        p_amount: amountNum,
        p_reference: topupPaymentRef.trim(),
        p_note: topupNote.trim() || null,
      })

      if (error) throw error

      setSuccessMsg(`Successfully added ${amountNum} credits. New balance: ${newBalance} credits.`)
      setTopupPaymentRef("")
      setTopupNote("")
      await loadCompanies()
      await loadOverviewMetrics()
      if (activeTab === "ledger") await loadLedger()
    } catch (err) {
      setErrorMsg(err.message || "Failed to add company credits.")
    } finally {
      setTopupLoading(false)
    }
  }

  const filteredCompanies = companies.filter((c) => {
    if (verificationFilter === "all") return true
    return c.verification_status === verificationFilter
  })

  const filteredUsers = usersList.filter((u) => {
    const matchesRole = userRoleFilter === "all" || u.role === userRoleFilter
    const term = userSearch.toLowerCase().trim()
    const matchesSearch =
      term === "" ||
      (u.full_name && u.full_name.toLowerCase().includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term))
    return matchesRole && matchesSearch
  })

  const verificationBadgeVariant = (status) => {
    switch (status) {
      case "verified":
      case "approved":
        return "bg-emerald-600 text-white"
      case "rejected":
        return "bg-red-600 text-white"
      default:
        return "bg-amber-600 text-white"
    }
  }

  const roleBadgeVariant = (role) => {
    switch (role) {
      case "admin":
        return "bg-red-600 text-white"
      case "recruiter":
        return "bg-blue-600 text-white"
      default:
        return "bg-emerald-600 text-white"
    }
  }

  const selectedCompanyForTopup = companies.find((c) => c.id === topupCompanyId)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-red-600" />
            <h1 className="text-3xl font-bold tracking-tight">Admin Control Panel</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Platform governance, employer verification, credit management, and system auditing.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            loadOverviewMetrics()
            loadCompanies()
            if (activeTab === "ledger") loadLedger()
            if (activeTab === "users") loadUsers()
          }}
          className="flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg("")} className="text-xs font-semibold hover:underline">
              Dismiss
            </button>
          </AlertDescription>
        </Alert>
      )}

      {successMsg && (
        <Alert className="border-emerald-600 bg-emerald-50 text-emerald-900">
          <AlertDescription className="flex items-center justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg("")} className="text-xs font-semibold hover:underline">
              Dismiss
            </button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap border-b gap-1">
        {[
          { id: "overview", label: "Platform Overview" },
          { id: "verification", label: `Employer Verification (${companies.filter((c) => c.verification_status === "pending").length})` },
          { id: "credits", label: "Manual Credit Top-Up" },
          { id: "ledger", label: "Credit Ledger View" },
          { id: "users", label: "User Management" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id)
              setErrorMsg("")
              setSuccessMsg("")
            }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center justify-between text-xs">
                  <span>Total Users</span>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardDescription>
                <CardTitle className="text-2xl font-bold">{metrics.users}</CardTitle>
              </CardHeader>
              <CardContent className="text-[11px] text-muted-foreground">
                Registered profiles
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center justify-between text-xs">
                  <span>Companies</span>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardDescription>
                <CardTitle className="text-2xl font-bold">{metrics.companies}</CardTitle>
              </CardHeader>
              <CardContent className="text-[11px] text-muted-foreground">
                {companies.filter((c) => c.verification_status === "verified" || c.verification_status === "approved").length} verified
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center justify-between text-xs">
                  <span>Total Jobs</span>
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                </CardDescription>
                <CardTitle className="text-2xl font-bold">{metrics.jobs}</CardTitle>
              </CardHeader>
              <CardContent className="text-[11px] text-muted-foreground">
                Platform-wide openings
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center justify-between text-xs">
                  <span>Applications</span>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardDescription>
                <CardTitle className="text-2xl font-bold">{metrics.applications}</CardTitle>
              </CardHeader>
              <CardContent className="text-[11px] text-muted-foreground">
                Total submissions
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center justify-between text-xs">
                  <span>Active Credits</span>
                  <Coins className="h-4 w-4 text-muted-foreground" />
                </CardDescription>
                <CardTitle className="text-2xl font-bold">{metrics.credits}</CardTitle>
              </CardHeader>
              <CardContent className="text-[11px] text-muted-foreground">
                Cumulative balance
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pending Employer Verifications</CardTitle>
                <CardDescription>Companies awaiting administrator approval to post active jobs</CardDescription>
              </CardHeader>
              <CardContent>
                {companies.filter((c) => c.verification_status === "pending").length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No pending verifications at this time.</p>
                ) : (
                  <div className="space-y-3">
                    {companies
                      .filter((c) => c.verification_status === "pending")
                      .slice(0, 5)
                      .map((c) => (
                        <div key={c.id} className="flex items-center justify-between p-3 border rounded-md text-sm">
                          <div>
                            <p className="font-semibold">{c.name}</p>
                            <p className="text-xs text-muted-foreground">{c.location || "Location not set"}</p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => {
                              setActiveTab("verification")
                              setVerificationFilter("pending")
                            }}
                          >
                            Review
                          </Button>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
                <CardDescription>Common administrator workflows</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start text-left"
                  onClick={() => setActiveTab("verification")}
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  Review Employer Verifications
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left"
                  onClick={() => setActiveTab("credits")}
                >
                  <Coins className="mr-2 h-4 w-4" />
                  Manual Credit Top-Up (Razorpay)
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left"
                  onClick={() => setActiveTab("ledger")}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Inspect Global Credit Ledger
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left"
                  onClick={() => setActiveTab("users")}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Manage User Directory
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "verification" && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl">Employer Company Verifications</CardTitle>
                <CardDescription>
                  Review and verify employer organizations. Only verified companies are permitted to post active job openings.
                </CardDescription>
              </div>

              <div className="flex items-center gap-1.5">
                {["pending", "verified", "rejected", "all"].map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant={verificationFilter === status ? "default" : "outline"}
                    className="h-8 text-xs capitalize"
                    onClick={() => setVerificationFilter(status)}
                  >
                    {status}
                    {status !== "all" && (
                      <span className="ml-1 opacity-70">
                        ({companies.filter((c) => (status === "verified" ? c.verification_status === "verified" || c.verification_status === "approved" : c.verification_status === status)).length})
                      </span>
                    )}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="text-center py-12 text-sm text-muted-foreground">Loading companies...</div>
            ) : filteredCompanies.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-md text-sm text-muted-foreground">
                No companies found in &apos;{verificationFilter}&apos; status.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2.5 px-3">Company Name</th>
                      <th className="py-2.5 px-3">Website</th>
                      <th className="py-2.5 px-3">Location</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Credits</th>
                      <th className="py-2.5 px-3">Registered</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredCompanies.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/10">
                        <td className="py-3 px-3 font-medium text-foreground">{c.name}</td>
                        <td className="py-3 px-3 text-xs text-muted-foreground">
                          {c.website ? (
                            <a
                              href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline"
                            >
                              {c.website}
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-3 px-3 text-xs text-muted-foreground">{c.location || "—"}</td>
                        <td className="py-3 px-3">
                          <Badge className={`uppercase text-[10px] ${verificationBadgeVariant(c.verification_status)}`}>
                            {c.verification_status}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 font-mono text-xs font-semibold">
                          {c.credits?.balance ?? 0} cr
                        </td>
                        <td className="py-3 px-3 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(c.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {c.verification_status !== "verified" && c.verification_status !== "approved" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-emerald-600 text-emerald-700 hover:bg-emerald-50 flex items-center gap-1"
                                onClick={() => handleVerifyCompany(c.id, "verified")}
                                disabled={verifyingId === c.id}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Approve
                              </Button>
                            )}

                            {c.verification_status !== "rejected" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-red-600 text-red-700 hover:bg-red-50 flex items-center gap-1"
                                onClick={() => handleVerifyCompany(c.id, "rejected")}
                                disabled={verifyingId === c.id}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Reject
                              </Button>
                            )}
                          </div>
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

      {activeTab === "credits" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-xl">Manual Razorpay Credit Allocation</CardTitle>
              <CardDescription>
                Allocate application credits to a verified company after confirming payment receipt.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleTopupSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="topup-company">Select Company</Label>
                  <select
                    id="topup-company"
                    value={topupCompanyId}
                    onChange={(e) => setTopupCompanyId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={topupLoading}
                    required
                  >
                    <option value="" disabled>
                      Choose a company...
                    </option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.verification_status.toUpperCase()}) — Balance: {c.credits?.balance ?? 0} cr
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="topup-amount">Credit Amount</Label>
                    <Input
                      id="topup-amount"
                      type="number"
                      min="1"
                      step="1"
                      placeholder="e.g. 50"
                      value={topupAmount}
                      onChange={(e) => setTopupAmount(e.target.value)}
                      disabled={topupLoading}
                      required
                    />
                    <p className="text-[11px] text-muted-foreground">Each application requires 10 credits</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="topup-payment-ref">Razorpay Payment Reference ID</Label>
                    <Input
                      id="topup-payment-ref"
                      placeholder="e.g. pay_Nabc12345678"
                      value={topupPaymentRef}
                      onChange={(e) => setTopupPaymentRef(e.target.value)}
                      disabled={topupLoading}
                      required
                    />
                    <p className="text-[11px] text-muted-foreground">Verified transaction identifier</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="topup-note">Internal Audit Note (Optional)</Label>
                  <Input
                    id="topup-note"
                    placeholder="e.g. Bank transfer confirmed via Razorpay dashboard"
                    value={topupNote}
                    onChange={(e) => setTopupNote(e.target.value)}
                    disabled={topupLoading}
                  />
                </div>

                <Button type="submit" disabled={topupLoading} className="flex items-center gap-2">
                  <Coins className="h-4 w-4" />
                  {topupLoading ? "Allocating Credits..." : "Allocate Credits"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Company Details</CardTitle>
              <CardDescription>Selected employer profile</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {selectedCompanyForTopup ? (
                <>
                  <div>
                    <span className="text-muted-foreground text-xs block">Company Name</span>
                    <span className="font-semibold text-base">{selectedCompanyForTopup.name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Verification Status</span>
                    <Badge className={`uppercase text-[10px] mt-0.5 ${verificationBadgeVariant(selectedCompanyForTopup.verification_status)}`}>
                      {selectedCompanyForTopup.verification_status}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Current Credit Balance</span>
                    <span className="font-mono font-bold text-2xl text-primary block mt-0.5">
                      {selectedCompanyForTopup.credits?.balance ?? 0} cr
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Location</span>
                    <span>{selectedCompanyForTopup.location || "Not specified"}</span>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">Select a company on the left to view current balance.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "ledger" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Global Credit Ledger</CardTitle>
            <CardDescription>
              Platform-wide immutable transaction log of admin topups and application charges.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingLedger ? (
              <div className="text-center py-12 text-sm text-muted-foreground">Loading ledger transactions...</div>
            ) : ledgerEntries.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-md text-sm text-muted-foreground">
                No ledger transactions recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Company</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Balance After</th>
                      <th className="py-2.5 px-3">Reference / Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {ledgerEntries.map((row) => (
                      <tr key={row.id} className="hover:bg-muted/10">
                        <td className="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(row.created_at).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-foreground">
                          {row.company?.name || row.company_id}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge
                            variant={row.amount > 0 ? "default" : "secondary"}
                            className="text-[10px] uppercase font-mono"
                          >
                            {row.type.replace("_", " ")}
                          </Badge>
                        </td>
                        <td
                          className={`py-2.5 px-3 font-semibold ${
                            row.amount > 0 ? "text-emerald-600" : "text-destructive"
                          }`}
                        >
                          {row.amount > 0 ? `+${row.amount}` : row.amount}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-medium">{row.balance_after}</td>
                        <td className="py-2.5 px-3 text-xs text-muted-foreground">
                          {row.reference && (
                            <span className="font-mono font-medium text-foreground mr-1.5">
                              [{row.reference}]
                            </span>
                          )}
                          {row.note || "—"}
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

      {activeTab === "users" && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl">Platform User Directory</CardTitle>
                <CardDescription>All registered candidates, recruiters, and platform administrators.</CardDescription>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <Input
                  placeholder="Search user by name or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="h-8 text-xs w-full sm:w-56"
                />

                <div className="flex items-center gap-1">
                  {["all", "candidate", "recruiter", "admin"].map((r) => (
                    <Button
                      key={r}
                      size="sm"
                      variant={userRoleFilter === r ? "default" : "outline"}
                      className="h-8 text-xs capitalize"
                      onClick={() => setUserRoleFilter(r)}
                    >
                      {r}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {loadingUsers ? (
              <div className="text-center py-12 text-sm text-muted-foreground">Loading users directory...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-md text-sm text-muted-foreground">
                No users match the search criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2.5 px-3">Full Name</th>
                      <th className="py-2.5 px-3">Email Address</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Member Since</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-muted/10">
                        <td className="py-2.5 px-3 font-medium text-foreground">{u.full_name || "—"}</td>
                        <td className="py-2.5 px-3 text-xs text-muted-foreground">{u.email}</td>
                        <td className="py-2.5 px-3">
                          <Badge className={`uppercase text-[10px] tracking-wider ${roleBadgeVariant(u.role)}`}>
                            {u.role || "Unassigned"}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
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
