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

    const { applicationId, candidateEmail, candidateName, jobTitle, companyName } = await req.json()

    if (!candidateEmail || !jobTitle) {
      return new Response(
        JSON.stringify({ error: "Missing required email payload fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const emailSubject = `Congratulations! You have been selected for ${jobTitle}`
    const emailContent = `Dear ${candidateName || "Candidate"},\n\nWe are pleased to inform you that you have been selected for the position of ${jobTitle} at ${companyName || "the company"}.\n\nPlease check your JobPortal dashboard for next steps.\n\nBest regards,\n${companyName || "Hiring Team"}`

    const resendApiKey = Deno.env.get("RESEND_API_KEY")
    let providerResult = null

    if (resendApiKey) {
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "JobPortal <notifications@resend.dev>",
          to: [candidateEmail],
          subject: emailSubject,
          text: emailContent,
        }),
      })
      providerResult = await resendResponse.json()
    } else {
      providerResult = {
        mocked: true,
        sent_at: new Date().toISOString(),
        to: candidateEmail,
        subject: emailSubject,
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Selection email notification processed successfully",
        details: providerResult,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal Server Error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
