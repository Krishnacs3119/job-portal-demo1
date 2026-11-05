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
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Initialize Supabase client strictly scoped to the authenticated caller's JWT
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized user" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Accept ONLY applicationId from client. Never accept email, name, or titles from untrusted body.
    const body = await req.json().catch(() => ({}))
    const applicationId = body?.applicationId

    if (!applicationId) {
      return new Response(
        JSON.stringify({ error: "applicationId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 1. Atomically claim selection email authorization from the database
    const { data: claimData, error: claimError } = await supabaseClient.rpc(
      "claim_selection_email",
      { p_application_id: applicationId }
    )

    if (claimError) {
      return new Response(
        JSON.stringify({ error: claimError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // If already sent, claim_selection_email returns no rows
    if (!claimData || claimData.length === 0) {
      return new Response(
        JSON.stringify({ sent: false, reason: "already_sent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Extract verified data strictly from the database record
    const { email, full_name, job_title, company_name } = claimData[0]

    // If candidate has no email address (e.g. phone-only account), do not call Brevo
    if (!email || !String(email).trim()) {
      return new Response(
        JSON.stringify({ sent: false, reason: "no_email" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 2. Validate Brevo API Configuration
    const brevoApiKey = Deno.env.get("BREVO_API_KEY")
    const brevoSenderEmail = Deno.env.get("BREVO_SENDER_EMAIL")

    if (!brevoApiKey || !brevoSenderEmail) {
      // Configuration missing: release claim so subsequent attempts can proceed once configured
      await supabaseClient.rpc("release_selection_email", { p_application_id: applicationId })

      return new Response(
        JSON.stringify({ sent: false, reason: "email_not_configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 3. Dispatch transactional email via Brevo REST API (Plain-Text Only)
    const emailSubject = `Congratulations! You have been selected for ${job_title}`
    const textContent = `Dear ${full_name || "Candidate"},\n\nWe are pleased to inform you that you have been selected for the position of ${job_title} at ${company_name || "the company"}.\n\nPlease check your JobPortal dashboard for next steps.\n\nBest regards,\n${company_name || "Hiring Team"}`

    const brevoPayload = {
      sender: {
        email: brevoSenderEmail,
        name: company_name || "JobPortal Hiring Team",
      },
      to: [
        {
          email: email,
          name: full_name || "Candidate",
        },
      ],
      subject: emailSubject,
      textContent: textContent,
    }

    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(brevoPayload),
    })

    if (!brevoResponse.ok) {
      // Provider call failed: release database timestamp
      await supabaseClient.rpc("release_selection_email", { p_application_id: applicationId })

      return new Response(
        JSON.stringify({ sent: false, reason: "provider_error" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    return new Response(
      JSON.stringify({ sent: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal Server Error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
