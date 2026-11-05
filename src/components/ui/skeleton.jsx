import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted/70 relative overflow-hidden",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
