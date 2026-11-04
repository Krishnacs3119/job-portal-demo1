import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 space-y-6">
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
        Find Your Dream Job or Hire Top Talent
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        A streamlined job portal connecting ambitious candidates with world-class employers.
      </p>
      <div className="flex gap-4">
        <Link to="/jobs">
          <Button size="lg">Explore Jobs</Button>
        </Link>
        <Link to="/login">
          <Button variant="outline" size="lg">
            Post a Job
          </Button>
        </Link>
      </div>
    </div>
  )
}
