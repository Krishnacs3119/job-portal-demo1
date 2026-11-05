import { useEffect, useState, useCallback } from "react"
import { 
  Users, 
  Building2, 
  Briefcase, 
  FileText, 
  Coins, 
  CheckCircle2, 
  XCircle, 
  Shield, 
  RefreshCw,
  Search,
  ExternalLink,
  ShieldCheck,
  CreditCard
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { AnimatedCounter } from "@/components/ui/animated-counter"
import PageTransition from "@/components/PageTransition"

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
  const [confirmTopup, setConfirmTopup] = useState(null)

  const [creditRequests, setCreditRequests] = useState([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [requestsFilter, setRequestsFilter] = useState("all")
  const [confirmResolveRequest, setConfirmResolveRequest] = useState(null)
  const [resolveLoading, setResolveLoading] = useState(false)

  const [ledgerEntries, setLedgerEntries] = useState([])
  const [loadingLedger, setLoadingLedger] = useState(false)

  const [usersList, setUsersList] = useState([])
  const [userSearch, setUserSearch] = useState("")
  const [userRoleFilter, setUserRoleFilter] = useState("all")
  const [userPage, setUserPage] = useState(1)
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
      const [{ data, error }, { data: profilesData }] = await Promise.all([
        supabase
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
          .order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, email"),
      ])

      if (error) throw error
      const profileMap = new Map((profilesData || []).map((p) => [p.id, p.email]))
      const enriched = (data || []).map((c) => ({
        ...c,
        owner_email: profileMap.get(c.created_by) || "No owner email",
      }))
      setCompanies(enriched)
      const approved = enriched.filter((c) => c.verification_status === "approved")
      if (!topupCompanyId && approved.length > 0) {
        setTopupCompanyId(approved[0].id)
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
        .select("id, full_name, email, phone, role, created_at")
        .order("created_at", { ascending: false })

      if (error) throw error
      setUsersList(data || [])
    } catch (err) {
      console.error("Failed to load users:", err.message)
    } finally {
      setLoadingUsers(false)
    }
  }, [])

  const loadCreditRequests = useCallback(async () => {
    try {
      setLoadingRequests(true)
      const [{ data: reqsData, error: reqsErr }, { data: profilesData }] = await Promise.all([
        supabase
          .from("credit_requests")
          .select(`
            id,
            company_id,
            requested_by,
            pack_id,
            credits,
            price_inr,
            payment_reference,
            status,
            admin_note,
            resolved_by,
            resolved_at,
            created_at,
            companies:company_id (id, name, created_by),
            credit_packs:pack_id (name, credits, price_inr)
          `)
          .order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, email, full_name"),
      ])

      if (reqsErr) throw reqsErr

      const profilesMap = new Map((profilesData || []).map((p) => [p.id, p]))

      const formatted = (reqsData || []).map((r) => {
        const ownerEmail =
          profilesMap.get(r.companies?.created_by)?.email ||
          profilesMap.get(r.requested_by)?.email ||
          "N/A"
        return {
          ...r,
          owner_email: ownerEmail,
        }
      })

      formatted.sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1
        if (a.status !== "pending" && b.status === "pending") return 1
        return new Date(b.created_at) - new Date(a.created_at)
      })

      setCreditRequests(formatted)
    } catch (err) {
      console.error("Failed to load credit requests:", err.message)
    } finally {
      setLoadingRequests(false)
    }
  }, [])

  useEffect(() => {
    loadOverviewMetrics()
    loadCompanies()
    loadUsers()
    loadCreditRequests()
  }, [loadOverviewMetrics, loadCompanies, loadUsers, loadCreditRequests])

  useEffect(() => {
    if (activeTab === "ledger") {
      loadLedger()
    } else if (activeTab === "users") {
      loadUsers()
    } else if (activeTab === "verification") {
      loadCompanies()
    } else if (activeTab === "requests") {
      loadCreditRequests()
    } else if (activeTab === "overview") {
      loadOverviewMetrics()
      loadCreditRequests()
    }
  }, [activeTab, loadLedger, loadUsers, loadCompanies, loadOverviewMetrics, loadCreditRequests])

  useEffect(() => {
    const channel = supabase
      .channel("admin-credit-requests")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "credit_requests",
        },
        () => {
          loadCreditRequests()
          loadOverviewMetrics()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadCreditRequests, loadOverviewMetrics])

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

  const handleTopupInitiate = (e) => {
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

    const targetCompany = companies.find((c) => c.id === topupCompanyId)
    if (!targetCompany) {
      setErrorMsg("Selected company not found.")
      return
    }

    setConfirmTopup({
      company: targetCompany,
      amount: amountNum,
      reference: topupPaymentRef.trim(),
      note: topupNote.trim() || null,
    })
  }

  const handleConfirmTopupSubmit = async () => {
    if (!confirmTopup) return

    setTopupLoading(true)
    setErrorMsg("")
    setSuccessMsg("")

    try {
      const { data: newBalance, error } = await supabase.rpc("admin_add_credits", {
        p_company_id: confirmTopup.company.id,
        p_amount: confirmTopup.amount,
        p_reference: confirmTopup.reference,
        p_note: confirmTopup.note,
      })

      if (error) throw error

      setSuccessMsg(
        `Successfully added ${confirmTopup.amount} credits to ${confirmTopup.company.name}. New balance: ${newBalance} credits.`
      )
      setTopupPaymentRef("")
      setTopupNote("")
      setConfirmTopup(null)
      await loadCompanies()
      await loadOverviewMetrics()
      if (activeTab === "ledger") await loadLedger()
    } catch (err) {
      setErrorMsg(err.message || "Failed to add company credits.")
      setConfirmTopup(null)
    } finally {
      setTopupLoading(false)
    }
  }

  const filteredCompanies = companies.filter((c) => {
    if (verificationFilter === "all") return true
    return c.verification_status === verificationFilter
  })

  const handleResolveRequestSubmit = async () => {
    if (!confirmResolveRequest) return
    setResolveLoading(true)
    setErrorMsg("")
    setSuccessMsg("")

    try {
      const { error } = await supabase.rpc("admin_resolve_credit_request", {
        p_request_id: confirmResolveRequest.request.id,
        p_approve: confirmResolveRequest.approve,
        p_note: confirmResolveRequest.note.trim() || null,
      })

      if (error) throw error

      setSuccessMsg(
        confirmResolveRequest.approve
          ? `Approved ${confirmResolveRequest.request.credits} credits for ${confirmResolveRequest.request.companies?.name}. Company balance has been updated.`
          : `Rejected credit request for ${confirmResolveRequest.request.companies?.name}.`
      )
      setConfirmResolveRequest(null)
      await loadCreditRequests()
      await loadCompanies()
      await loadOverviewMetrics()
      if (activeTab === "ledger") await loadLedger()
    } catch (err) {
      setErrorMsg(err.message || "Failed to resolve credit request.")
      setConfirmResolveRequest(null)
    } finally {
      setResolveLoading(false)
    }
  }

  const filteredRequests = creditRequests.filter((r) => {
    if (requestsFilter === "all") return true
    return r.status === requestsFilter
  })

  const filteredUsers = usersList.filter((u) => {
    const matchesRole = userRoleFilter === "all" || u.role === userRoleFilter
    const term = userSearch.toLowerCase().trim()
    const matchesSearch =
      term === "" ||
      (u.full_name && u.full_name.toLowerCase().includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term)) ||
      (u.phone && u.phone.toLowerCase().includes(term))
    return matchesRole && matchesSearch
  })

  const USERS_PAGE_SIZE = 25
  const totalUserPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PAGE_SIZE))
  const paginatedUsers = filteredUsers.slice((userPage - 1) * USERS_PAGE_SIZE, userPage * USERS_PAGE_SIZE)

  const verificationBadgeVariant = (status) => {
    switch (status) {
      case "approved":
        return "bg-emerald-600/15 text-emerald-700  border border-emerald-600/30"
      case "rejected":
        return "bg-rose-600/15 text-rose-700  border border-rose-600/30"
      default:
        return "bg-amber-600/15 text-amber-700  border border-amber-600/30"
    }
  }

  const roleBadgeVariant = (role) => {
    switch (role) {
      case "admin":
        return "bg-rose-600/15 text-rose-700  border border-rose-600/30"
      case "recruiter":
        return "bg-blue-600/15 text-blue-700  border border-blue-600/30"
      default:
        return "bg-emerald-600/15 text-emerald-700  border border-emerald-600/30"
    }
  }

  const approvedCompanies = companies.filter((c) => c.verification_status === "approved")
  const selectedCompanyForTopup = approvedCompanies.find((c) => c.id === topupCompanyId) || companies.find((c) => c.id === topupCompanyId)

  return (
    <PageTransition className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-rose-500/10 text-rose-600  flex items-center justify-center font-bold">
              <Shield className="h-5 w-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-foreground">
              Admin Control Panel
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Platform governance, employer verification, credit management, and system auditing.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            loadOverviewMetrics()
            loadCompanies()
            loadCreditRequests()
            if (activeTab === "ledger") loadLedger()
            if (activeTab === "users") loadUsers()
            if (activeTab === "requests") loadCreditRequests()
          }}
          className="h-8 text-xs gap-1.5 self-start sm:self-auto font-medium"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh Data</span>
        </Button>
      </div>

      {errorMsg && (
        <Alert variant="destructive" className="text-xs py-2.5">
          <AlertDescription className="flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg("")} className="text-xs font-semibold hover:underline">
              Dismiss
            </button>
          </AlertDescription>
        </Alert>
      )}

      {successMsg && (
        <Alert className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800  text-xs py-2.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 " />
          <AlertDescription className="flex items-center justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg("")} className="text-xs font-semibold hover:underline">
              Dismiss
            </button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex overflow-x-auto border-b gap-1 pb-px scrollbar-none">
        {[
          { id: "overview", label: "Platform Overview", icon: ShieldCheck },
          { id: "verification", label: `Verifications (${companies.filter((c) => c.verification_status === "pending").length})`, icon: Building2 },
          { id: "requests", label: `Credit Requests (${creditRequests.filter((r) => r.status === "pending").length})`, icon: Coins },
          { id: "credits", label: "Credit Top-Up", icon: CreditCard },
          { id: "ledger", label: "Global Ledger", icon: FileText },
          { id: "users", label: "User Directory", icon: Users },
        ].map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                setErrorMsg("")
                setSuccessMsg("")
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap -mb-px ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            <Card className="p-4 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[10px] font-bold uppercase tracking-wider">Total Users</span>
                <Users className="h-4 w-4 text-primary" />
              </div>
              <p className="text-2xl font-heading font-extrabold text-foreground">
                <AnimatedCounter value={metrics.users} />
              </p>
              <p className="text-[10px] text-muted-foreground">Registered profiles</p>
            </Card>

            <Card className="p-4 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[10px] font-bold uppercase tracking-wider">Companies</span>
                <Building2 className="h-4 w-4 text-blue-600 " />
              </div>
              <p className="text-2xl font-heading font-extrabold text-foreground">
                <AnimatedCounter value={metrics.companies} />
              </p>
              <p className="text-[10px] text-muted-foreground">
                {companies.filter((c) => c.verification_status === "approved").length} approved
              </p>
            </Card>

            <Card className="p-4 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[10px] font-bold uppercase tracking-wider">Total Jobs</span>
                <Briefcase className="h-4 w-4 text-amber-600 " />
              </div>
              <p className="text-2xl font-heading font-extrabold text-foreground">
                <AnimatedCounter value={metrics.jobs} />
              </p>
              <p className="text-[10px] text-muted-foreground">Open listings</p>
            </Card>

            <Card className="p-4 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[10px] font-bold uppercase tracking-wider">Applications</span>
                <FileText className="h-4 w-4 text-emerald-600 " />
              </div>
              <p className="text-2xl font-heading font-extrabold text-foreground">
                <AnimatedCounter value={metrics.applications} />
              </p>
              <p className="text-[10px] text-muted-foreground">Candidate submissions</p>
            </Card>

            <Card className="p-4 shadow-sm space-y-1 col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[10px] font-bold uppercase tracking-wider">Active Credits</span>
                <Coins className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-heading font-extrabold text-foreground">
                <AnimatedCounter value={metrics.credits} />
              </p>
              <p className="text-[10px] text-muted-foreground">Total platform balance</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-heading font-bold">Pending Employer Verifications</CardTitle>
                <CardDescription className="text-xs">Companies awaiting approval to publish open listings</CardDescription>
              </CardHeader>
              <CardContent>
                {companies.filter((c) => c.verification_status === "pending").length === 0 ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">No pending verifications at this time.</p>
                ) : (
                  <div className="space-y-2.5">
                    {companies
                      .filter((c) => c.verification_status === "pending")
                      .slice(0, 5)
                      .map((c) => (
                        <div key={c.id} className="flex items-center justify-between p-3 border rounded-xl text-xs bg-muted/20">
                          <div>
                            <p className="font-semibold text-foreground">{c.name}</p>
                            <p className="text-[11px] text-muted-foreground">{c.location || "Location not set"}</p>
                          </div>
                          <Button
                            size="sm"
                            className="h-7 text-xs font-medium"
                            onClick={() => {
                              setActiveTab("verification")
                              setVerificationFilter("pending")
                            }}
                          >
                            Review &rarr;
                          </Button>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-heading font-bold">Quick Administrative Actions</CardTitle>
                <CardDescription className="text-xs">Jump directly to specific governance tools</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start text-xs h-9 gap-2 font-medium"
                  onClick={() => setActiveTab("verification")}
                >
                  <Building2 className="h-4 w-4 text-blue-600" />
                  Review Employer Verifications
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-xs h-9 gap-2 font-medium"
                  onClick={() => setActiveTab("requests")}
                >
                  <Coins className="h-4 w-4 text-primary" />
                  Review Credit Requests ({creditRequests.filter((r) => r.status === "pending").length})
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-xs h-9 gap-2 font-medium"
                  onClick={() => setActiveTab("credits")}
                >
                  <Coins className="h-4 w-4 text-emerald-600" />
                  Manual Credit Top-Up (Razorpay)
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-xs h-9 gap-2 font-medium"
                  onClick={() => setActiveTab("ledger")}
                >
                  <FileText className="h-4 w-4 text-primary" />
                  Inspect Global Credit Ledger
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-xs h-9 gap-2 font-medium"
                  onClick={() => setActiveTab("users")}
                >
                  <Users className="h-4 w-4 text-amber-600" />
                  Manage User Directory
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "verification" && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-heading font-bold">Employer Company Verifications</CardTitle>
                <CardDescription className="text-xs">
                  Review and verify employer organizations. Only verified companies are permitted to post active job openings.
                </CardDescription>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {["pending", "approved", "rejected", "all"].map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant={verificationFilter === status ? "default" : "outline"}
                    className="h-8 text-xs capitalize"
                    onClick={() => setVerificationFilter(status)}
                  >
                    {status}
                    {status !== "all" && (
                      <span className="ml-1 opacity-75 font-mono text-[10px]">
                        ({companies.filter((c) => (status === "approved" ? c.verification_status === "approved" : c.verification_status === status)).length})
                      </span>
                    )}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="space-y-2 py-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : filteredCompanies.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-xl text-xs text-muted-foreground">
                No companies found in &apos;{verificationFilter}&apos; status.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-muted/40 text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                    <tr>
                      <th className="py-2.5 px-3">Company Name</th>
                      <th className="py-2.5 px-3">Owner</th>
                      <th className="py-2.5 px-3">Website</th>
                      <th className="py-2.5 px-3">Location</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Credits</th>
                      <th className="py-2.5 px-3">Registered</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredCompanies.map((c) => {
                      const owner = usersList.find((u) => u.id === c.created_by)
                      return (
                        <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-3 font-semibold text-foreground">{c.name}</td>
                          <td className="py-3 px-3 text-muted-foreground">
                            {owner ? (
                              <div className="space-y-0.5">
                                <span className="font-medium text-foreground block">{owner.full_name || "—"}</span>
                                <span className="text-[10px] text-muted-foreground block truncate max-w-[130px]" title={owner.email || owner.phone || ""}>
                                  {owner.email || owner.phone || "—"}
                                </span>
                              </div>
                            ) : (
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {c.created_by ? `${c.created_by.slice(0, 8)}...` : "—"}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-muted-foreground">
                          {c.website ? (
                            <a
                              href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              <span>{c.website}</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-3 px-3 text-muted-foreground">{c.location || "—"}</td>
                        <td className="py-3 px-3">
                          <Badge className={`uppercase text-[9px] font-bold ${verificationBadgeVariant(c.verification_status)}`}>
                            {c.verification_status}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 font-mono font-semibold">
                          {c.credits?.balance ?? 0} cr
                        </td>
                        <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                          {new Date(c.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {c.verification_status !== "approved" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-emerald-600/40 text-emerald-700  hover:bg-emerald-500/10 flex items-center gap-1"
                                onClick={() => handleVerifyCompany(c.id, "approved")}
                                disabled={verifyingId === c.id}
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Approve
                              </Button>
                            )}

                            {c.verification_status !== "rejected" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-rose-600/40 text-rose-700  hover:bg-rose-500/10 flex items-center gap-1"
                                onClick={() => handleVerifyCompany(c.id, "rejected")}
                                disabled={verifyingId === c.id}
                              >
                                <XCircle className="h-3 w-3" />
                                Reject
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "requests" && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-heading font-bold">Recruiter Credit Requests</CardTitle>
                <CardDescription className="text-xs">
                  Review and resolve offline payment credit requests submitted by verified employers.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border bg-muted/40 p-0.5 text-xs">
                  {["all", "pending", "approved", "rejected"].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setRequestsFilter(f)}
                      className={`px-3 py-1 rounded-md capitalize font-medium transition-colors ${
                        requestsFilter === f
                          ? "bg-background text-foreground shadow-sm font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {f}
                      {f === "pending" && (
                        <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-800 font-bold">
                          {creditRequests.filter((r) => r.status === "pending").length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadCreditRequests}
                  className="h-8 text-xs font-medium"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingRequests ? (
              <div className="space-y-2 py-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-xl text-xs text-muted-foreground space-y-1">
                <Coins className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="font-semibold text-foreground text-sm">No Credit Requests Found</p>
                <p>No credit requests match the selected filter criteria.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 text-muted-foreground border-b text-[11px] uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-2.5 px-3 text-left">Date</th>
                      <th className="py-2.5 px-3 text-left">Company</th>
                      <th className="py-2.5 px-3 text-left">Owner Email</th>
                      <th className="py-2.5 px-3 text-left">Pack</th>
                      <th className="py-2.5 px-3 text-left">Credits</th>
                      <th className="py-2.5 px-3 text-left">Amount</th>
                      <th className="py-2.5 px-3 text-left">Payment Ref</th>
                      <th className="py-2.5 px-3 text-left">Status</th>
                      <th className="py-2.5 px-3 text-left">Admin Note</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground">
                          {new Date(req.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-foreground whitespace-nowrap">
                          <div>{req.companies?.name || "Company"}</div>
                          <div className="text-[10px] font-mono text-muted-foreground">ID: {req.company_id.slice(0, 8)}</div>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                          {req.owner_email}
                        </td>
                        <td className="py-2.5 px-3 font-medium whitespace-nowrap">
                          {req.credit_packs?.name || "Credit Pack"}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-primary">
                          +{req.credits} cr
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap font-semibold">
                          &#8377;{req.price_inr.toLocaleString("en-IN")}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                          {req.payment_reference}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {req.status === "approved" ? (
                            <Badge className="bg-emerald-600/15 text-emerald-700 border border-emerald-600/30 text-[10px] font-bold">
                              Approved
                            </Badge>
                          ) : req.status === "rejected" ? (
                            <Badge className="bg-red-500/15 text-red-700 border border-red-500/30 text-[10px] font-bold">
                              Rejected
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-500/15 text-amber-700 border border-amber-500/30 text-[10px] font-bold">
                              Pending
                            </Badge>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground max-w-xs truncate">
                          {req.admin_note || "--"}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          {req.status === "pending" ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                className="h-7 text-xs px-2.5 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() =>
                                  setConfirmResolveRequest({
                                    request: req,
                                    approve: true,
                                    note: "",
                                  })
                                }
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs px-2.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                                onClick={() =>
                                  setConfirmResolveRequest({
                                    request: req,
                                    approve: false,
                                    note: "",
                                  })
                                }
                              >
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">
                              Resolved {req.resolved_at ? new Date(req.resolved_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : ""}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>

          {confirmResolveRequest && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
              <Card className="w-full max-w-md p-6 shadow-2xl border-2 space-y-4 bg-card">
                <div className="space-y-2">
                  <h3 className="font-heading font-bold text-lg text-foreground">
                    {confirmResolveRequest.approve ? "Approve Credit Request" : "Reject Credit Request"}
                  </h3>
                  <p className="text-sm text-foreground">
                    {confirmResolveRequest.approve
                      ? `Add ${confirmResolveRequest.request.credits} credits to ${confirmResolveRequest.request.companies?.name} (${confirmResolveRequest.request.owner_email})? Reference: ${confirmResolveRequest.request.payment_reference}`
                      : `Reject credit request for ${confirmResolveRequest.request.companies?.name} (${confirmResolveRequest.request.owner_email})?`}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="resolve-note" className="text-xs font-semibold">
                    {confirmResolveRequest.approve ? "Admin Note (Optional)" : "Reason for Rejection *"}
                  </Label>
                  <Input
                    id="resolve-note"
                    placeholder={confirmResolveRequest.approve ? "e.g. Verified via bank statement" : "e.g. Invalid transaction reference"}
                    value={confirmResolveRequest.note}
                    onChange={(e) =>
                      setConfirmResolveRequest((prev) => ({ ...prev, note: e.target.value }))
                    }
                    className="text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmResolveRequest(null)}
                    disabled={resolveLoading}
                    className="text-xs h-9"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={confirmResolveRequest.approve ? "default" : "destructive"}
                    onClick={handleResolveRequestSubmit}
                    disabled={
                      resolveLoading ||
                      (!confirmResolveRequest.approve && !confirmResolveRequest.note.trim())
                    }
                    className="text-xs h-9 font-semibold"
                  >
                    {resolveLoading
                      ? "Processing..."
                      : confirmResolveRequest.approve
                      ? "Confirm Approval"
                      : "Confirm Rejection"}
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </Card>
      )}

      {activeTab === "credits" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-heading font-bold">Manual Razorpay Credit Allocation</CardTitle>
              <CardDescription className="text-xs">
                Allocate application credits to a verified company after confirming payment receipt.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleTopupInitiate} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="topup-company" className="text-xs font-semibold">Select Company *</Label>
                  <select
                    id="topup-company"
                    value={topupCompanyId}
                    onChange={(e) => setTopupCompanyId(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    disabled={topupLoading}
                    required
                  >
                    <option value="" disabled>
                      Choose an approved company...
                    </option>
                    {approvedCompanies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} • {c.owner_email} • {c.id.slice(0, 8)} • {c.verification_status.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="topup-amount" className="text-xs font-semibold">Credit Amount *</Label>
                    <Input
                      id="topup-amount"
                      type="number"
                      min="1"
                      step="1"
                      placeholder="e.g. 50"
                      value={topupAmount}
                      onChange={(e) => setTopupAmount(e.target.value)}
                      disabled={topupLoading}
                      className="h-10 text-xs"
                      required
                    />
                    <p className="text-[10px] text-muted-foreground">Each application requires 10 credits</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="topup-payment-ref" className="text-xs font-semibold">Razorpay Payment Reference ID *</Label>
                    <Input
                      id="topup-payment-ref"
                      placeholder="e.g. pay_Nabc12345678"
                      value={topupPaymentRef}
                      onChange={(e) => setTopupPaymentRef(e.target.value)}
                      disabled={topupLoading}
                      className="h-10 text-xs font-mono"
                      required
                    />
                    <p className="text-[10px] text-muted-foreground">Verified transaction identifier</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="topup-note" className="text-xs font-semibold">Internal Audit Note (Optional)</Label>
                  <Input
                    id="topup-note"
                    placeholder="e.g. Bank transfer confirmed via Razorpay dashboard"
                    value={topupNote}
                    onChange={(e) => setTopupNote(e.target.value)}
                    disabled={topupLoading}
                    className="h-10 text-xs"
                  />
                </div>

                <Button type="submit" disabled={topupLoading} className="h-10 text-xs font-semibold gap-2 shadow-sm">
                  <Coins className="h-4 w-4" />
                  {topupLoading ? "Allocating Credits..." : "Allocate Credits &rarr;"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading font-bold">Target Company Details</CardTitle>
              <CardDescription className="text-xs">Selected employer preview</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {selectedCompanyForTopup ? (
                <>
                  <div className="pb-2 border-b">
                    <span className="text-muted-foreground block text-[11px]">Company Name</span>
                    <span className="font-bold text-sm text-foreground">{selectedCompanyForTopup.name}</span>
                  </div>
                  <div className="pb-2 border-b">
                    <span className="text-muted-foreground block text-[11px]">Owner Email</span>
                    <span className="font-medium text-xs text-foreground">{selectedCompanyForTopup.owner_email}</span>
                  </div>
                  <div className="pb-2 border-b">
                    <span className="text-muted-foreground block text-[11px]">Company ID</span>
                    <span className="font-mono text-xs text-foreground">{selectedCompanyForTopup.id.slice(0, 8)}</span>
                  </div>
                  <div className="pb-2 border-b">
                    <span className="text-muted-foreground block text-[11px]">Verification Status</span>
                    <Badge className={`uppercase text-[9px] mt-1 font-bold ${verificationBadgeVariant(selectedCompanyForTopup.verification_status)}`}>
                      {selectedCompanyForTopup.verification_status}
                    </Badge>
                  </div>
                  <div className="pb-2 border-b">
                    <span className="text-muted-foreground block text-[11px]">Current Balance</span>
                    <span className="font-mono font-extrabold text-2xl text-primary block mt-0.5">
                      {selectedCompanyForTopup.credits?.balance ?? 0} cr
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Location</span>
                    <span className="font-medium text-foreground">{selectedCompanyForTopup.location || "Not specified"}</span>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground py-4 text-center">Select an approved company on the left to view profile.</p>
              )}
            </CardContent>
          </Card>

          {confirmTopup && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
              <Card className="w-full max-w-md p-6 shadow-2xl border-2 border-primary space-y-4 bg-card">
                <div className="space-y-2">
                  <h3 className="font-heading font-bold text-lg text-foreground">
                    Confirm Credit Top-Up
                  </h3>
                  <p className="text-sm text-foreground">
                    Add {confirmTopup.amount} credits to {confirmTopup.company.name} ({confirmTopup.company.owner_email})? Reference: {confirmTopup.reference}
                  </p>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmTopup(null)}
                    disabled={topupLoading}
                    className="text-xs h-9"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleConfirmTopupSubmit}
                    disabled={topupLoading}
                    className="text-xs h-9 font-semibold"
                  >
                    {topupLoading ? "Adding Credits..." : "Confirm"}
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {activeTab === "ledger" && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-heading font-bold">Global Credit Ledger</CardTitle>
            <CardDescription className="text-xs">
              Platform-wide immutable transaction log of admin topups and application charges.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingLedger ? (
              <div className="space-y-2 py-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : ledgerEntries.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-xl text-xs text-muted-foreground">
                No ledger transactions recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-muted/40 text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Company</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Balance After</th>
                      <th className="py-2.5 px-3">Reference / Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {ledgerEntries.map((row) => (
                      <tr key={row.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                          {new Date(row.created_at).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-foreground">
                          {row.company?.name || row.company_id}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge
                            variant={row.amount > 0 ? "default" : "secondary"}
                            className="text-[9px] uppercase font-mono"
                          >
                            {row.type.replace("_", " ")}
                          </Badge>
                        </td>
                        <td
                          className={`py-2.5 px-3 font-bold font-mono ${
                            row.amount > 0 ? "text-emerald-600 " : "text-destructive"
                          }`}
                        >
                          {row.amount > 0 ? `+${row.amount}` : row.amount}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-medium">{row.balance_after}</td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {row.reference && (
                            <span className="font-mono font-semibold text-foreground mr-1.5">
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
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-heading font-bold">Platform User Directory</CardTitle>
                <CardDescription className="text-xs">All registered candidates, recruiters, and platform administrators.</CardDescription>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search name, email, phone..."
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value)
                      setUserPage(1)
                    }}
                    className="pl-8 h-8 text-xs w-full sm:w-60"
                  />
                </div>

                <div className="flex items-center gap-1">
                  {["all", "candidate", "recruiter", "admin"].map((r) => (
                    <Button
                      key={r}
                      size="sm"
                      variant={userRoleFilter === r ? "default" : "outline"}
                      className="h-8 text-xs capitalize"
                      onClick={() => {
                        setUserRoleFilter(r)
                        setUserPage(1)
                      }}
                    >
                      {r}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {loadingUsers ? (
              <div className="space-y-2 py-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-xl text-xs text-muted-foreground">
                No users match the search criteria.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b bg-muted/40 text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                      <tr>
                        <th className="py-2.5 px-3">Full Name</th>
                        <th className="py-2.5 px-3">Email Address</th>
                        <th className="py-2.5 px-3">Phone Number</th>
                        <th className="py-2.5 px-3">Role</th>
                        <th className="py-2.5 px-3">Member Since</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {paginatedUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-foreground">{u.full_name || "—"}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{u.email || "—"}</td>
                          <td className="py-2.5 px-3 text-muted-foreground font-mono text-[11px]">{u.phone || "—"}</td>
                          <td className="py-2.5 px-3">
                            <Badge className={`uppercase text-[9px] font-bold ${roleBadgeVariant(u.role)}`}>
                              {u.role || "Unassigned"}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                            {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
                  <div>
                    Showing{" "}
                    <span className="font-semibold text-foreground">
                      {filteredUsers.length === 0 ? 0 : (userPage - 1) * USERS_PAGE_SIZE + 1}
                    </span>{" "}
                    to{" "}
                    <span className="font-semibold text-foreground">
                      {Math.min(userPage * USERS_PAGE_SIZE, filteredUsers.length)}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-foreground">{filteredUsers.length}</span> users
                  </div>

                  {totalUserPages > 1 && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                        disabled={userPage <= 1}
                      >
                        Previous
                      </Button>
                      <span className="text-xs font-medium">
                        Page {userPage} of {totalUserPages}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => setUserPage((p) => Math.min(totalUserPages, p + 1))}
                        disabled={userPage >= totalUserPages}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </PageTransition>
  )
}
