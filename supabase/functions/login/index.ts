import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { email, password, captchaToken } = await req.json()

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const normalizedEmail = email.trim().toLowerCase()

    // 1. Cloudflare Turnstile CAPTCHA verification
    const requireCaptcha = Deno.env.get("REQUIRE_CAPTCHA")?.toLowerCase() === "true"
    const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY")

    if (requireCaptcha) {
      // Fail closed: reject if TURNSTILE_SECRET_KEY is missing, captchaToken is missing, or verification fails
      if (!turnstileSecret || !captchaToken) {
        return new Response(
          JSON.stringify({ error: "CAPTCHA verification is required. Please try again." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: turnstileSecret,
          response: captchaToken,
        }),
      })

      const verifyData = await verifyRes.json().catch(() => ({ success: false }))
      if (!verifyData?.success) {
        return new Response(
          JSON.stringify({ error: "CAPTCHA verification failed. Please try again." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
    } else if (turnstileSecret) {
      // If REQUIRE_CAPTCHA is not 'true', behave as before (skip when unset, verify if secret is set)
      if (!captchaToken) {
        return new Response(
          JSON.stringify({ error: "CAPTCHA token is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: turnstileSecret,
          response: captchaToken,
        }),
      })

      const verifyData = await verifyRes.json().catch(() => ({ success: false }))
      if (!verifyData?.success) {
        return new Response(
          JSON.stringify({ error: "CAPTCHA verification failed. Please try again." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
    }

    // 2. Initialize Supabase Admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 3. Check login attempts for this email
    const { data: attempt } = await supabaseAdmin
      .from("login_attempts")
      .select("*")
      .eq("email", normalizedEmail)
      .maybeSingle()

    const now = new Date()

    if (attempt?.locked_until) {
      const lockTime = new Date(attempt.locked_until)
      if (lockTime > now) {
        const remainingMinutes = Math.max(1, Math.ceil((lockTime.getTime() - now.getTime()) / (60 * 1000)))
        return new Response(
          JSON.stringify({
            error: `Account is temporarily locked due to 5 consecutive failed login attempts. Please try again in ${remainingMinutes} minute${remainingMinutes > 1 ? "s" : ""} or reset your password to unlock immediately.`,
            isLocked: true,
            remainingMinutes,
          }),
          { status: 423, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
    }

    // 4. Attempt authentication with Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })

    if (authError) {
      // Increment failed count (tracked by email string even if account doesn't exist)
      const currentFailed = (attempt?.failed_count || 0) + 1
      const isFifthOrMore = currentFailed >= 5
      const newLockedUntil = isFifthOrMore
        ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
        : null

      await supabaseAdmin.from("login_attempts").upsert({
        email: normalizedEmail,
        failed_count: currentFailed,
        locked_until: newLockedUntil,
        updated_at: new Date().toISOString(),
      })

      if (isFifthOrMore) {
        return new Response(
          JSON.stringify({
            error: "Account has been locked for 15 minutes due to 5 consecutive failed login attempts. You can reset your password to unlock immediately.",
            isLocked: true,
            remainingMinutes: 15,
          }),
          { status: 423, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      // Always return generic error to prevent email enumeration
      return new Response(
        JSON.stringify({
          error: "Invalid email or password",
          attemptsLeft: Math.max(0, 5 - currentFailed),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 5. Login successful: reset failed attempts & lockout
    await supabaseAdmin.from("login_attempts").upsert({
      email: normalizedEmail,
      failed_count: 0,
      locked_until: null,
      updated_at: new Date().toISOString(),
    })

    return new Response(
      JSON.stringify({
        session: authData.session,
        user: authData.user,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
