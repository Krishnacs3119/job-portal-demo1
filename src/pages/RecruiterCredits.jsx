import { useState, useEffect, useCallback } from "react"
import { Link } from "react-router-dom"
import { Coins, Zap, Shield, CheckCircle2, Clock, XCircle, ArrowLeft, AlertCircle, CreditCard, Sparkles, Building2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { AnimatedCounter } from "@/components/ui/animated-counter"
import PageTransition from "@/components/PageTransition"

export default function RecruiterCredits() {
  const { user, profile } = useAuth()
  const [company, setCompany] = useState(null)
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [packs, setPacks] = useState([])
  const [requests, setRequests] = useState([])
  const [selectedPack, setSelectedPack] = useState(null)
  const [paymentRef, setPaymentRef] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [successMsg, setSuccessMsg] = useState("")

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const { data: companies, error: compErr } = await supabase.rpc("get_my_companies")
      if (compErr) throw compErr

      const currentComp = companies?.[0]
      if (!currentComp) {
        setCompany(null)
        setLoading(false)
        return
      }

      setCompany(currentComp)

      const [credRes, packsRes, reqsRes] = await Promise.all([
        supabase
          .from("company_credits")
          .select("balance")
          .eq("company_id", currentComp.id)
          .maybeSingle(),
        supabase
          .from("credit_packs")
          .select("*")
          .eq("active", true)
          .order("sort", { ascending: true }),
        supabase
          .from("credit_requests")
          .select(`
            id,
            company_id,
            credits,
            price_inr,
            payment_reference,
            status,
            admin_note,
            created_at,
            resolved_at,
            credit_packs (name)
          `)
          .eq("company_id", currentComp.id)
          .order("created_at", { ascending: false }),
      ])

      setBalance(credRes.data ? credRes.data.balance : 0)
      setPacks(packsRes.data || [])
      setRequests(reqsRes.data || [])
    } catch (err) {
      setErrorMsg(err.message || "Failed to load credits information.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!company?.id) return

    const channel = supabase
      .channel(`recruiter-credits-${company.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "credit_requests",
          filter: `company_id=eq.${company.id}`,
        },
        () => {
          loadData()
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "company_credits",
          filter: `company_id=eq.${company.id}`,
        },
        () => {
          loadData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [company?.id, loadData])

  const handleOpenModal = (pack) => {
    setErrorMsg("")
    setSuccessMsg("")
    setSelectedPack(pack)
    setPaymentRef("")
  }

  const handleCloseModal = () => {
    if (submitting) return
    setSelectedPack(null)
    setPaymentRef("")
  }

  const handleSubmitRequest = async (e) => {
    e.preventDefault()
    if (!company?.id || !selectedPack?.id) return

    const cleanRef = paymentRef.trim()
    if (cleanRef.length < 6 || cleanRef.length > 40) {
      setErrorMsg("Payment reference must be between 6 and 40 characters.")
      return
    }

    try {
      setSubmitting(true)
      setErrorMsg("")

      const { data, error } = await supabase.rpc("request_credits", {
        p_company_id: company.id,
        p_pack_id: selectedPack.id,
        p_payment_reference: cleanRef,
      })

      if (error) throw error

      setSuccessMsg(`Your request for ${selectedPack.credits} credits has been submitted. Our team will verify the payment reference shortly.`)
      setSelectedPack(null)
      setPaymentRef("")
      await loadData()
    } catch (err) {
      setErrorMsg(err.message || "Failed to submit credit request.")
    } finally {
      setSubmitting(false)
    }
  }

  if (profile?.role === "admin") {
    return (
      <PageTransition className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <Card className="shadow-sm p-8 space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Shield className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-heading font-bold">Admin Management Portal</h2>
          <p className="text-sm text-muted-foreground">
            Admins manage platform credit allocations and approve recruiter requests from the Admin Panel.
          </p>
          <div className="pt-2">
            <Link to="/admin">
              <Button className="font-semibold">Open Admin Panel</Button>
            </Link>
          </div>
        </Card>
      </PageTransition>
    )
  }

  if (!loading && !company) {
    return (
      <PageTransition className="max-w-xl mx-auto py-12 text-center space-y-4">
        <Card className="shadow-sm p-8 space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
            <Building2 className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-heading font-bold">No Company Registered</h2>
          <p className="text-sm text-muted-foreground">
            You must register or join an employer company before requesting or managing recruitment credits.
          </p>
          <div className="pt-2">
            <Link to="/company/setup">
              <Button className="font-semibold">Register Company</Button>
            </Link>
          </div>
        </Card>
      </PageTransition>
    )
  }

  const applicationsCovered = balance !== null ? Math.floor(balance / 10) : 0
  const isApproved = company?.verification_status === "approved"

  return (
    <PageTransition className="max-w-5xl mx-auto py-6 sm:py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium mb-2 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
          </Link>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight">
            Company Credits & Packages
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Fuel your candidate pipeline. Credits are automatically deducted when candidates submit applications.
          </p>
        </div>

        {company && (
          <div className="flex items-center gap-2 self-start sm:self-auto bg-muted/50 border rounded-xl px-3.5 py-2">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold">{company.name}</span>
            <Badge
              variant={isApproved ? "default" : "secondary"}
              className={`text-[10px] uppercase font-bold ${
                isApproved ? "bg-emerald-600/15 text-emerald-700 border-emerald-600/30" : ""
              }`}
            >
              {company.verification_status}
            </Badge>
          </div>
        )}
      </div>

      {successMsg && (
        <Alert className="border-emerald-500/40 bg-emerald-500/10 text-emerald-900 text-xs py-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="flex items-center justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg("")} className="text-xs font-semibold hover:underline">
              Dismiss
            </button>
          </AlertDescription>
        </Alert>
      )}

      {errorMsg && (
        <Alert variant="destructive" className="text-xs py-3">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg("")} className="text-xs font-semibold hover:underline">
              Dismiss
            </button>
          </AlertDescription>
        </Alert>
      )}

      {!isApproved && company && (
        <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 text-xs py-3">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            Your organization is pending administrative verification. Credit requests can only be placed once your company is approved.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-sm border-primary/20 bg-gradient-to-br from-card to-primary/5 md:col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Current Balance
              </span>
              <Badge variant="outline" className="text-[10px] font-mono">
                10 cr / application
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-4xl font-heading font-extrabold text-primary">
              {loading ? (
                <Skeleton className="h-10 w-28" />
              ) : (
                <AnimatedCounter value={balance ?? 0} suffix=" Credits" />
              )}
            </div>
            <div className="p-3 bg-background/80 rounded-lg border text-xs space-y-1">
              <div className="flex justify-between font-medium">
                <span className="text-muted-foreground">Applications Covered:</span>
                <span className="font-bold text-foreground">
                  {loading ? "--" : `${applicationsCovered} candidates`}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                When balance reaches 0, your job postings pause automatically until credits are added.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {loading ? (
            [1, 2, 3].map((i) => (
              <Card key={i} className="p-4 space-y-3">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-9 w-full" />
              </Card>
            ))
          ) : packs.length === 0 ? (
            <Card className="col-span-3 p-8 text-center text-xs text-muted-foreground border-dashed">
              No active credit packs configured.
            </Card>
          ) : (
            packs.map((pack) => {
              const packApps = Math.floor(pack.credits / 10)
              const isPopular = pack.name.toLowerCase().includes("growth")

              return (
                <Card
                  key={pack.id}
                  className={`flex flex-col justify-between shadow-sm relative transition-all duration-200 hover:shadow-md ${
                    isPopular ? "border-primary ring-1 ring-primary/20" : ""
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0 shadow-sm flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> Most Popular
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="pb-2 pt-5">
                    <CardTitle className="text-base font-heading font-bold">{pack.name}</CardTitle>
                    <CardDescription className="text-xs">
                      Covers ~{packApps} candidate applications
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <div className="space-y-0.5">
                      <div className="text-2xl font-extrabold font-heading text-foreground">
                        &#8377;{pack.price_inr.toLocaleString("en-IN")}
                      </div>
                      <div className="text-xs font-semibold text-primary flex items-center gap-1">
                        <Coins className="h-3.5 w-3.5" />
                        <span>{pack.credits} Credits</span>
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground border-t pt-2 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                        <span>Immediate activation upon review</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                        <span>Unpauses all active job listings</span>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="pt-2 flex flex-col gap-2">
                    <Button
                      className="w-full text-xs font-semibold"
                      variant={isPopular ? "default" : "outline"}
                      disabled={!isApproved}
                      onClick={() => handleOpenModal(pack)}
                    >
                      Request credits
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled
                      className="w-full text-[10px] h-7 text-muted-foreground cursor-not-allowed opacity-60"
                    >
                      Pay online with Razorpay (coming soon)
                    </Button>
                  </CardFooter>
                </Card>
              )
            })
          )}
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg font-heading font-bold">Credit Requests History</CardTitle>
              <CardDescription className="text-xs">
                Log of credit package requests submitted for manual verification.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              className="h-8 text-xs font-medium self-start sm:self-auto"
            >
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2 py-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-xl text-xs text-muted-foreground space-y-1">
              <Coins className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="font-semibold text-foreground text-sm">No Credit Requests</p>
              <p>You have not placed any credit requests yet. Choose a package above to request credits.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 text-muted-foreground border-b text-[11px] uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-2.5 px-3 text-left">Date</th>
                    <th className="py-2.5 px-3 text-left">Package</th>
                    <th className="py-2.5 px-3 text-left">Credits</th>
                    <th className="py-2.5 px-3 text-left">Amount</th>
                    <th className="py-2.5 px-3 text-left">Payment Ref</th>
                    <th className="py-2.5 px-3 text-left">Status</th>
                    <th className="py-2.5 px-3 text-left">Admin Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {requests.map((req) => (
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
                            Pending Review
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground max-w-xs truncate">
                        {req.admin_note || "--"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedPack && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background border rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b space-y-1 bg-muted/20">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs font-bold uppercase tracking-wider text-primary">
                  Offline Payment Request
                </Badge>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={submitting}
                  className="text-muted-foreground hover:text-foreground p-1 text-sm rounded-lg"
                >
                  &#x2715;
                </button>
              </div>
              <h3 className="text-xl font-heading font-extrabold text-foreground">
                Request {selectedPack.credits} Credits ({selectedPack.name})
              </h3>
              <p className="text-xs text-muted-foreground">
                Total Payable Amount: <strong className="text-foreground">&#8377;{selectedPack.price_inr.toLocaleString("en-IN")}</strong>
              </p>
            </div>

            <form onSubmit={handleSubmitRequest} className="p-6 space-y-4">
              <div className="bg-muted/40 border rounded-xl p-3.5 space-y-2 text-xs">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4 text-primary" />
                  <span>Transfer & Payment Details</span>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Please transfer <strong className="text-foreground">&#8377;{selectedPack.price_inr.toLocaleString("en-IN")}</strong> via UPI or NEFT/IMPS:
                </p>
                <div className="bg-background border rounded-lg p-2.5 font-mono text-[11px] space-y-1">
                  <div><strong>UPI ID:</strong> payments@jobportal.in</div>
                  <div><strong>Account Name:</strong> JobPortal Technologies Pvt Ltd</div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Once payment is completed, submit the transaction UTR or reference ID below. The administrator will credit your account after verification.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="payment_ref" className="text-xs font-semibold">
                  Payment Reference / UTR Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="payment_ref"
                  placeholder="e.g. UTR1234567890 or PAY_123456"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  required
                  minLength={6}
                  maxLength={40}
                  disabled={submitting}
                  className="font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Must be between 6 and 40 characters and unique.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCloseModal}
                  disabled={submitting}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting || paymentRef.trim().length < 6}
                  className="text-xs font-semibold gap-1.5"
                >
                  {submitting ? "Submitting..." : "Submit Credit Request"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageTransition>
  )
}
