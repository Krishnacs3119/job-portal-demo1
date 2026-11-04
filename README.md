# Full Stack Job Portal

A modern full-stack Job Portal built with React (Vite), Tailwind CSS, shadcn/ui, and Supabase.

---

## Part 2: Authentication, Roles, and Lockout Architecture

### Known Limitation: Server-Side Lockout vs Auth Hooks
In Supabase, custom **Password Verification Hooks** (which execute inside the core Auth GoTrue engine right before or after password evaluation) are only available on **Teams and Enterprise** plans. 

On the Free and Pro tiers:
- The server-side lockout policy is implemented via Supabase Edge Functions (`/login` and `/unlock`).
- The frontend client is strictly configured to **never** call `supabase.auth.signInWithPassword` directly; all password logins route through the `login` Edge Function, which tracks attempts in the `login_attempts` table, locks accounts for 15 minutes upon 5 failed attempts, and unlocks immediately upon password reset.
- **Limitation**: An attacker with knowledge of the Supabase project URL and public anon key could theoretically send direct HTTP requests to `POST /auth/v1/token?grant_type=password` bypassing the Edge Function.
- **Mitigations in place**:
  1. Cloudflare Turnstile CAPTCHA enforced on login and signup endpoints.
  2. Supabase built-in global rate limiting (e.g., maximum 30 auth requests per hour per IP on Free tier).
  3. No exposure of service role keys anywhere on the client.

---

## Database Migrations
SQL migration file is located at:
`supabase/migrations/20261030000000_part2_auth_and_lockout.sql`

Run this script in your **Supabase Dashboard -> SQL Editor**.

---

## Edge Functions
- `login`: Validates CAPTCHA, checks 5-attempt lockout, authenticates against Supabase Auth, and tracks failed counts in `login_attempts`.
- `unlock`: Validates user JWT and immediately clears lockout after password reset.
