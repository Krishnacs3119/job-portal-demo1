import { useState } from "react"
import { Phone, Mail, MapPin, CheckCircle2, Send, HelpCircle, Sparkles, Clock, MessageSquare, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import PageTransition from "@/components/PageTransition"

export default function ContactUs() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    inquiryType: "Candidate Help",
    message: "",
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setErrorMsg("")

    if (!formData.fullName.trim()) {
      setErrorMsg("Please enter your full name.")
      return
    }
    if (!formData.email.trim() || !formData.email.includes("@")) {
      setErrorMsg("Please enter a valid email address.")
      return
    }
    if (!formData.message.trim()) {
      setErrorMsg("Please write your message.")
      return
    }

    setSubmitting(true)

    setTimeout(() => {
      setSubmitting(false)
      setSubmitted(true)
      setFormData({
        fullName: "",
        email: "",
        phone: "",
        inquiryType: "Candidate Help",
        message: "",
      })
    }, 600)
  }

  const faqs = [
    {
      q: "How do candidate applications work?",
      a: "Candidates can browse verified job openings, upload a clean resume in PDF format, and submit direct applications with zero intermediaries. Status updates (Applied, Shortlisted, Selected) are tracked in real-time.",
    },
    {
      q: "How can recruiters purchase credits to post jobs?",
      a: "Employers can navigate to the Credits portal (/dashboard/credits) and select Starter, Growth, or Scale packages. Each application costs 10 credits. You can pay seamlessly via our dynamic UPI QR code.",
    },
    {
      q: "What is the turnaround time for offline UPI verification?",
      a: "Once you submit your 12-digit UTR reference and payment screenshot receipt, our administration team verifies and approves the credit pack within 24 business hours.",
    },
    {
      q: "How does employer company verification work?",
      a: "To maintain 100% genuine postings and protect candidate trust, every new employer organization is reviewed by platform administrators before job listings are activated.",
    },
  ]

  return (
    <PageTransition className="space-y-12 sm:space-y-16 py-6 sm:py-10 max-w-6xl mx-auto px-4 sm:px-6">
      <section className="text-center space-y-4 max-w-3xl mx-auto px-2 sm:px-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-orange/30 bg-brand-orange/10 px-3.5 py-1.5 text-xs font-bold text-brand-orange uppercase tracking-wider shadow-sm">
          <Sparkles className="h-3.5 w-3.5 text-brand-orange" />
          <span>Jobs | Career | Opportunities</span>
        </div>

        <h1 className="text-2xl sm:text-3xl md:text-5xl font-heading font-extrabold tracking-tight leading-tight text-foreground pb-1">
          Get in Touch with{" "}
          <span className="inline-block pb-1 leading-snug break-words bg-gradient-to-r from-primary via-blue-800 to-brand-orange bg-clip-text text-transparent">
            Job Pe Charcha
          </span>
        </h1>

        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
          Have questions about recruitment, job listings, corporate credit packs, or platform partnership? Our dedicated advisory team is here to support you.
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-sm border hover:shadow-md transition-shadow relative overflow-hidden group w-full">
          <div className="h-1.5 w-full bg-brand-navy" />
          <CardHeader className="pb-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold mb-1">
              <Phone className="h-5 w-5" />
            </div>
            <CardTitle className="text-lg font-heading font-bold">Direct Phone Support</CardTitle>
            <CardDescription className="text-xs">
              Immediate telephonic assistance for candidates & recruiters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="space-y-2 font-medium">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 min-h-[44px]">
                <span className="text-muted-foreground">Primary Line:</span>
                <a href="tel:8655633170" className="font-bold text-foreground hover:text-brand-orange transition-colors py-1 px-1">
                  +91 8655633170
                </a>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 min-h-[44px]">
                <span className="text-muted-foreground">Secondary Line:</span>
                <a href="tel:8655633173" className="font-bold text-foreground hover:text-brand-orange transition-colors py-1 px-1">
                  +91 8655633173
                </a>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1">
              <Clock className="h-3.5 w-3.5 text-brand-orange shrink-0" />
              <span>Mon – Sat, 9:30 AM – 6:30 PM IST</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border hover:shadow-md transition-shadow relative overflow-hidden group w-full">
          <div className="h-1.5 w-full bg-brand-orange" />
          <CardHeader className="pb-3">
            <div className="h-10 w-10 rounded-xl bg-brand-orange/10 text-brand-orange flex items-center justify-center font-bold mb-1">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
              </svg>
            </div>
            <CardTitle className="text-lg font-heading font-bold">Instagram Community</CardTitle>
            <CardDescription className="text-xs">
              Daily job alerts, hiring tips & career updates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="p-3 rounded-lg bg-muted/40 space-y-1 min-h-[44px]">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Official Channel</div>
              <div className="font-bold text-foreground text-sm">@aarvyacareertalentsolution</div>
            </div>
            <a
              href="https://www.instagram.com/aarvyacareertalentsolution?obrf=ZnhzMGkyZ2FmZjE1"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-block"
            >
              <Button className="w-full text-xs font-semibold gap-2 bg-gradient-to-r from-brand-orange to-pink-600 hover:opacity-95 text-white min-h-[44px]">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
                </svg>
                <span>Follow us on Instagram</span>
              </Button>
            </a>
          </CardContent>
        </Card>

        <Card className="shadow-sm border hover:shadow-md transition-shadow relative overflow-hidden group w-full">
          <div className="h-1.5 w-full bg-blue-600" />
          <CardHeader className="pb-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold mb-1">
              <Mail className="h-5 w-5" />
            </div>
            <CardTitle className="text-lg font-heading font-bold">Corporate Desk</CardTitle>
            <CardDescription className="text-xs">
              Official electronic inquiries & corporate alliances
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-muted/40 space-y-1 min-h-[44px]">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Official Email</div>
              <a href="mailto:support@jobpecharcha.com" className="font-bold text-foreground text-sm hover:text-brand-orange transition-colors inline-block py-0.5">
                support@jobpecharcha.com
              </a>
            </div>
            <div className="space-y-1 text-muted-foreground">
              <div className="flex items-center gap-1.5 text-foreground font-semibold">
                <MapPin className="h-3.5 w-3.5 text-brand-orange" />
                <span>Headquarters: Mumbai, India</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                We typically respond within 24 business hours to verified queries.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-2">
            <Badge variant="outline" className="border-primary/20 text-primary font-semibold">
              Direct Communication
            </Badge>
            <h2 className="text-2xl font-heading font-bold text-foreground">
              Send Us a Message
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Fill out the query form and our recruitment experts will review your request and get back to you promptly.
            </p>
          </div>

          <div className="space-y-3 border rounded-2xl p-5 bg-card/60 backdrop-blur-sm text-xs">
            <div className="flex items-start gap-3">
              <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground">100% Human Support</h4>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  No automated chatbots. Real talent specialists answering your career and hiring queries.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-7 w-7 rounded-lg bg-brand-orange/10 text-brand-orange flex items-center justify-center font-bold shrink-0">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground">Fast Verification</h4>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Credit allocations and company approval requests resolved in less than 24 hours.
                </p>
              </div>
            </div>
          </div>
        </div>

        <Card className="lg:col-span-7 shadow-lg border">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-heading font-bold">Inquiry & Support Form</CardTitle>
            <CardDescription className="text-xs">
              Provide complete details so we can direct your query to the correct department.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="py-8 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-heading font-bold text-foreground">
                    Message Dispatched Successfully!
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Thank you for reaching out! Our team will contact you shortly via email or phone.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSubmitted(false)}
                  className="text-xs"
                >
                  Send Another Message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMsg && (
                  <Alert variant="destructive" className="text-xs py-2.5">
                    <AlertDescription>{errorMsg}</AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName" className="text-xs font-semibold">
                      Full Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="fullName"
                      name="fullName"
                      placeholder="e.g. Rahul Sharma"
                      value={formData.fullName}
                      onChange={handleChange}
                      required
                      className="text-base sm:text-xs h-11 sm:h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-semibold">
                      Email Address <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="e.g. rahul@example.com"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="text-base sm:text-xs h-11 sm:h-10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs font-semibold">
                      Phone Number
                    </Label>
                    <Input
                      id="phone"
                      name="phone"
                      placeholder="e.g. +91 9876543210"
                      value={formData.phone}
                      onChange={handleChange}
                      className="text-base sm:text-xs font-mono h-11 sm:h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="inquiryType" className="text-xs font-semibold">
                      Inquiry Category <span className="text-destructive">*</span>
                    </Label>
                    <select
                      id="inquiryType"
                      name="inquiryType"
                      value={formData.inquiryType}
                      onChange={handleChange}
                      className="flex h-11 sm:h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="Candidate Help">Candidate Application Help</option>
                      <option value="Recruiter / Credit Purchase">Recruiter / Credit Purchase</option>
                      <option value="Company Verification">Company Verification Inquiry</option>
                      <option value="Business Partnership">Corporate Partnership</option>
                      <option value="Other">Other Query</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="message" className="text-xs font-semibold">
                    Message Details <span className="text-destructive">*</span>
                  </Label>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    placeholder="Describe your inquiry, question, or requirement in detail..."
                    value={formData.message}
                    onChange={handleChange}
                    required
                    className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-ring resize-y min-h-[100px]"
                  />
                </div>

                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting}
                  className="w-full text-xs sm:text-sm font-semibold gap-1.5 h-11 sm:h-10 min-h-[44px]"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{submitting ? "Transmitting..." : "Transmit Message to Support"}</span>
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-6 pt-4 border-t">
        <div className="text-center space-y-1">
          <Badge variant="outline" className="border-primary/20 text-primary">
            Frequently Asked Questions
          </Badge>
          <h2 className="text-2xl font-heading font-bold text-foreground">
            Clear Answers to Common Queries
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {faqs.map((faq, i) => (
            <Card key={i} className="shadow-sm border p-4 space-y-2">
              <div className="flex items-start gap-2.5">
                <HelpCircle className="h-4 w-4 text-brand-orange shrink-0 mt-0.5" />
                <h4 className="font-heading font-bold text-xs text-foreground leading-snug">
                  {faq.q}
                </h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed pl-6.5">
                {faq.a}
              </p>
            </Card>
          ))}
        </div>
      </section>
    </PageTransition>
  )
}
