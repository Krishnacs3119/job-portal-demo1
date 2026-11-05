import React from "react"
import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === "function"
          ? this.props.fallback(this.state.error, this.handleReset)
          : this.props.fallback
      }

      if (this.props.compact) {
        return (
          <span
            className="inline-flex items-center text-xs text-muted-foreground/60 p-1"
            title="Widget temporarily unavailable"
            aria-label="Widget unavailable"
          >
            ⚠️
          </span>
        )
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] p-6 text-center space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div className="space-y-1 max-w-md">
            <h2 className="text-lg font-heading font-bold text-foreground">Something went wrong</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              An unexpected error occurred while rendering this section.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={this.handleReset} className="text-xs gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Try Again
            </Button>
            <Button size="sm" onClick={() => (window.location.href = "/")} className="text-xs">
              Back to Home
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
