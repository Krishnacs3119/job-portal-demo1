import { useEffect, useState } from "react"
import { useReducedMotion, animate } from "framer-motion"

export function AnimatedCounter({ value = 0, duration = 0.3, prefix = "", suffix = "" }) {
  const shouldReduceMotion = useReducedMotion()
  const numericValue = typeof value === "number" ? value : parseFloat(value) || 0
  const [displayValue, setDisplayValue] = useState(numericValue)

  useEffect(() => {
    if (shouldReduceMotion) return

    const controls = animate(0, numericValue, {
      duration: Math.min(0.3, duration),
      ease: "easeOut",
      onUpdate: (latest) => setDisplayValue(Math.floor(latest)),
    })

    return () => controls.stop()
  }, [numericValue, duration, shouldReduceMotion])

  const output = shouldReduceMotion ? numericValue : displayValue

  return (
    <span>
      {prefix}
      {output.toLocaleString()}
      {suffix}
    </span>
  )
}
