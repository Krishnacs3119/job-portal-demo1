import { useEffect, useRef } from "react"

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY

export default function Turnstile({ onVerify, onError }) {
  const containerRef = useRef(null)
  const widgetIdRef = useRef(null)

  useEffect(() => {
    // If no site key is configured (e.g. local testing before setup), skip seamlessly
    if (!SITE_KEY) {
      if (onVerify) onVerify("bypass-local-dev")
      return
    }

    const scriptId = "cf-turnstile-script"
    let script = document.getElementById(scriptId)

    const renderWidget = () => {
      if (window.turnstile && containerRef.current && widgetIdRef.current === null) {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          callback: (token) => {
            if (onVerify) onVerify(token)
          },
          "error-callback": () => {
            if (onError) onError()
          },
        })
      }
    }

    if (!script) {
      script = document.createElement("script")
      script.id = scriptId
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
      script.async = true
      script.defer = true
      script.onload = renderWidget
      document.head.appendChild(script)
    } else if (window.turnstile) {
      renderWidget()
    }

    return () => {
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [onVerify, onError])

  if (!SITE_KEY) return null

  return <div ref={containerRef} className="my-2 flex justify-center" />
}
