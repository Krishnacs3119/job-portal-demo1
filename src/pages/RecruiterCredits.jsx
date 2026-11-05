import { useState, useEffect, useCallback } from "react"
import { Link } from "react-router-dom"
import { Coins, Shield, CheckCircle2, XCircle, ArrowLeft, AlertCircle, Sparkles, Building2, Copy, Check, UploadCloud, Clock, Eye, Trash2 } from "lucide-react"
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
  const [screenshotFile, setScreenshotFile] = useState(null)
  const [screenshotPreview, setScreenshotPreview] = useState(null)
  const [copiedUpi, setCopiedUpi] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitStatusText, setSubmitStatusText] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [successMsg, setSuccessMsg] = useState("")
  const [previewModalUrl, setPreviewModalUrl] = useState(null)

  const upiId = "payments@jobportal.in"
  const payeeName = "Job Pe Charcha Technologies Pvt Ltd"

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
            screenshot_url,
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
    setScreenshotFile(null)
    setScreenshotPreview(null)
    setCopiedUpi(false)
  }

  const handleCloseModal = () => {
    if (submitting) return
    setSelectedPack(null)
    setPaymentRef("")
    if (screenshotPreview) {
      URL.revokeObjectURL(screenshotPreview)
    }
    setScreenshotFile(null)
    setScreenshotPreview(null)
    setCopiedUpi(false)
  }

  const handleCopyUpi = async () => {
    try {
      await navigator.clipboard.writeText(upiId)
      setCopiedUpi(true)
      setTimeout(() => setCopiedUpi(false), 2000)
    } catch (_) {
      const el = document.createElement("textarea")
      el.value = upiId
      document.body.appendChild(el)
      el.select()
      document.execCommand("copy")
      document.body.removeChild(el)
      setCopiedUpi(true)
      setTimeout(() => setCopiedUpi(false), 2000)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please upload a valid image file (PNG, JPG, JPEG, WEBP).")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("Screenshot file size must be less than 5MB.")
      return
    }

    setErrorMsg("")
    if (screenshotPreview) {
      URL.revokeObjectURL(screenshotPreview)
    }
    setScreenshotFile(file)
    setScreenshotPreview(URL.createObjectURL(file))
  }

  const handleRemoveScreenshot = () => {
    if (screenshotPreview) {
      URL.revokeObjectURL(screenshotPreview)
    }
    setScreenshotFile(null)
    setScreenshotPreview(null)
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

      let uploadedScreenshotPath = null

      if (screenshotFile) {
        setSubmitStatusText("Uploading payment proof...")
        const fileExt = screenshotFile.name.split(".").pop().toLowerCase()
        const randomId = Math.random().toString(36).substring(2, 9)
        const filePath = `${user.id}/${Date.now()}_${randomId}.${fileExt}`

        const { error: uploadErr } = await supabase.storage
          .from("payment_proofs")
          .upload(filePath, screenshotFile, {
            contentType: screenshotFile.type,
            upsert: false,
          })

        if (uploadErr) {
          throw new Error(`Failed to upload payment screenshot: ${uploadErr.message}`)
        }

        uploadedScreenshotPath = filePath
      }

      setSubmitStatusText("Submitting credit request...")

      const { error } = await supabase.rpc("request_credits", {
        p_company_id: company.id,
        p_pack_id: selectedPack.id,
        p_payment_reference: cleanRef,
        p_screenshot_url: uploadedScreenshotPath,
      })

      if (error) throw error

      setSuccessMsg(`Your request for ${selectedPack.credits} credits has been submitted. Credits will be added within 24 hours after admin verification.`)
      handleCloseModal()
      await loadData()
    } catch (err) {
      setErrorMsg(err.message || "Failed to submit credit request.")
    } finally {
      setSubmitting(false)
      setSubmitStatusText("")
    }
  }

  const handleOpenProofPreview = async (path) => {
    if (!path) return
    try {
      const { data, error } = await supabase.storage
        .from("payment_proofs")
        .createSignedUrl(path, 3600)

      if (error) throw error
      if (data?.signedUrl) {
        setPreviewModalUrl(data.signedUrl)
      }
    } catch (err) {
      setErrorMsg(err.message || "Unable to open screenshot preview.")
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

  const upiDeepLink = selectedPack
    ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${selectedPack.price_inr}&cu=INR&tn=${encodeURIComponent(`CreditPack-${selectedPack.name}`)}`
    : ""

  const qrImageUrl = selectedPack
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiDeepLink)}`
    : ""

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
                    <th className="py-2.5 px-3 text-left">Proof</th>
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
                        {req.screenshot_url ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenProofPreview(req.screenshot_url)}
                            className="h-6 text-[11px] px-2 text-primary hover:text-primary gap-1"
                          >
                            <Eye className="h-3 w-3" /> View
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">None</span>
                        )}
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-background border rounded-2xl shadow-2xl max-w-md w-full overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b space-y-1 bg-muted/20">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs font-bold uppercase tracking-wider text-primary">
                  UPI Payment & Verification
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
              <h3 className="text-lg font-heading font-extrabold text-foreground">
                Request {selectedPack.credits} Credits ({selectedPack.name})
              </h3>
              <p className="text-xs text-muted-foreground">
                Payable Amount: <strong className="text-foreground">&#8377;{selectedPack.price_inr.toLocaleString("en-IN")}</strong>
              </p>
            </div>

            <form onSubmit={handleSubmitRequest} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="bg-muted/40 border rounded-xl p-4 text-center space-y-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary font-bold text-sm">
                  <span>Pay &#8377;{selectedPack.price_inr.toLocaleString("en-IN")}</span>
                </div>

                <div className="flex flex-col items-center justify-center pt-1">
                  <div className="p-2 bg-white rounded-xl shadow-md border inline-block">
                    <img
                      src={qrImageUrl}
                      alt={`UPI QR Code for ${selectedPack.name}`}
                      className="w-44 h-44 object-contain rounded-lg"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2 font-medium">
                    Scan with GPay, PhonePe, Paytm, or any UPI app
                  </p>
                </div>

                <div className="bg-background border rounded-xl p-3 text-xs space-y-2 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">UPI ID</div>
                      <div className="font-mono font-bold text-foreground text-xs">{upiId}</div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopyUpi}
                      className="h-7 px-2.5 text-[11px] gap-1 font-semibold"
                    >
                      {copiedUpi ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span className="text-emerald-600">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="border-t pt-1.5">
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold">Account Name</div>
                    <div className="font-semibold text-foreground text-xs">{payeeName}</div>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-950 text-xs">
                <Clock className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-semibold text-blue-900">24-Hour Verification: </span>
                  Credits will be credited to your account within 24 hours once payment is verified by the admin.
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="payment_ref" className="text-xs font-semibold">
                  Payment Reference / UTR Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="payment_ref"
                  placeholder="e.g. 12-digit UTR number or UPI ref"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  required
                  minLength={6}
                  maxLength={40}
                  disabled={submitting}
                  className="font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Found in your UPI payment receipt (typically 12 digits).
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Payment Screenshot / Receipt (Proof)
                </Label>

                {screenshotPreview ? (
                  <div className="relative border rounded-xl p-2 bg-muted/20 flex items-center gap-3">
                    <img
                      src={screenshotPreview}
                      alt="Proof Preview"
                      className="h-16 w-16 object-cover rounded-lg border bg-background"
                    />
                    <div className="flex-1 min-w-0 text-xs space-y-0.5">
                      <p className="font-medium text-foreground truncate">{screenshotFile?.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {screenshotFile?.size ? (screenshotFile.size / 1024).toFixed(1) + " KB" : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleRemoveScreenshot}
                      disabled={submitting}
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-muted/10 hover:bg-muted/20 transition-colors">
                    <UploadCloud className="h-6 w-6 text-muted-foreground" />
                    <span className="text-xs font-semibold text-foreground">Click to upload screenshot</span>
                    <span className="text-[10px] text-muted-foreground">PNG, JPG, JPEG up to 5MB</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={handleFileChange}
                      disabled={submitting}
                      className="hidden"
                    />
                  </label>
                )}
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
                  {submitting ? (submitStatusText || "Submitting...") : "Submit Credit Request"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewModalUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background border rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Payment Screenshot
              </span>
              <button
                type="button"
                onClick={() => setPreviewModalUrl(null)}
                className="text-muted-foreground hover:text-foreground p-1 text-sm rounded-lg"
              >
                &#x2715;
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-muted/20 max-h-[70vh] overflow-auto">
              <img
                src={previewModalUrl}
                alt="Payment proof"
                className="max-h-[60vh] max-w-full rounded-lg object-contain shadow-sm border"
              />
            </div>
            <div className="p-3 border-t flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPreviewModalUrl(null)}
                className="text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  )
}
