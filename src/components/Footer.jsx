import { Link } from "react-router-dom"
import { Phone, Mail, MapPin, ShieldCheck, Heart } from "lucide-react"

const CURRENT_YEAR = new Date().getFullYear()

export default function Footer() {
  return (
    <footer className="border-t bg-card/80 backdrop-blur-md mt-16 text-sm text-muted-foreground transition-colors">
      <div className="container mx-auto px-4 sm:px-6 py-12 max-w-7xl space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4 md:col-span-1">
            <Link to="/" className="inline-block group">
              <img
                src="/logo.png"
                alt="Job Pe Charcha"
                className="h-14 sm:h-16 md:h-20 w-auto object-contain transition-transform group-hover:scale-105"
              />
            </Link>
            <p className="text-xs font-bold tracking-wider text-brand-orange uppercase">
              Jobs | Career | Opportunities
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              India&apos;s verified career network connecting ambitious candidates with pre-screened employers without ghosting or fake listings.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
              <ShieldCheck className="h-4 w-4" />
              <span>100% Verified Employers</span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-foreground">
              Candidate Portal
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/jobs" className="hover:text-foreground hover:text-brand-orange transition-colors">
                  Explore Open Openings
                </Link>
              </li>
              <li>
                <Link to="/saved" className="hover:text-foreground hover:text-brand-orange transition-colors">
                  Saved Bookmarks
                </Link>
              </li>
              <li>
                <Link to="/dashboard/my-applications" className="hover:text-foreground hover:text-brand-orange transition-colors">
                  Application Timelines
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-foreground hover:text-brand-orange transition-colors">
                  Help & Candidate Support
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-foreground">
              Employer Solutions
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/jobs/new" className="hover:text-foreground hover:text-brand-orange transition-colors">
                  Post a Job Opening
                </Link>
              </li>
              <li>
                <Link to="/company/setup" className="hover:text-foreground hover:text-brand-orange transition-colors">
                  Register Your Organization
                </Link>
              </li>
              <li>
                <Link to="/dashboard/credits" className="hover:text-foreground hover:text-brand-orange transition-colors">
                  Recruiter Credit Packages
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-foreground hover:text-brand-orange transition-colors">
                  Recruiter Sign In
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-foreground">
              Reach Out & Support
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-brand-orange shrink-0" />
                <a href="tel:8655633170" className="hover:text-foreground hover:underline">
                  +91 8655633170
                </a>
                <span>/</span>
                <a href="tel:8655633173" className="hover:text-foreground hover:underline">
                  +91 8655633173
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-brand-orange shrink-0" />
                <a href="mailto:support@jobpecharcha.com" className="hover:text-foreground hover:underline">
                  support@jobpecharcha.com
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 text-brand-orange shrink-0 mt-0.5" />
                <span>Mumbai, Maharashtra, India</span>
              </li>
              <li className="pt-1">
                <a
                  href="https://www.instagram.com/aarvyacareertalentsolution?obrf=ZnhzMGkyZ2FmZjE1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-background hover:bg-muted font-medium text-xs text-foreground transition-colors"
                >
                  <svg className="h-3.5 w-3.5 text-brand-orange" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
                  </svg>
                  <span>@aarvyacareertalentsolution</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>
            &copy; {CURRENT_YEAR} Job Pe Charcha. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link to="/contact" className="hover:text-foreground transition-colors">
              Contact Us
            </Link>
            <Link to="/jobs" className="hover:text-foreground transition-colors">
              Jobs
            </Link>
            <span className="flex items-center gap-1">
              <span>Crafted for Indian Careers</span>
              <Heart className="h-3 w-3 text-brand-orange fill-brand-orange inline" />
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
