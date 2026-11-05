# Production Setup & Deployment Guide

This guide provides a step-by-step walkthrough for deploying the Job Portal on a **fresh, clean Supabase project** from scratch.

---

## 1. Prerequisites

1. **Supabase Account & Project**: Create a new project at [supabase.com](https://supabase.com).
2. **Supabase CLI**: Install the Supabase CLI (`npm install -g supabase` or use `npx supabase`).
3. **Brevo Account**: (Optional but recommended for transactional candidate selection emails) [brevo.com](https://www.brevo.com).
4. **Cloudflare Turnstile**: (Optional for bot protection) [cloudflare.com](https://www.cloudflare.com/products/turnstile/).

---

## 2. Database Migrations (Run in Supabase SQL Editor)

In your Supabase Dashboard, open the **SQL Editor** (**SQL** icon in the left sidebar).
Execute the migration scripts in the **exact numerical order** listed below. Copy and paste each file's entire content into a new query tab and click **Run**.

| Step | Migration File | Description |
|---|---|---|
| **01** | `supabase/migrations/20261030000000_part2_auth_and_lockout.sql` | Profiles, lockout tracking, and login attempts schema |
| **02** | `supabase/migrations/20261030000001_part3_jobs.sql` | Jobs table, categories, salary validations, and bookmarks |
| **03** | `supabase/migrations/20261030000002_part4_credits_and_apply.sql` | Company credits, credit ledger, and application charging |
| **04** | `supabase/migrations/20261030000003_part4_security_fixes.sql` | Search path security and permission hardening |
| **05** | `supabase/migrations/20261030000004_part4_fix2.sql` | Storage bucket setup and resume isolation RLS policies |
| **06** | `supabase/migrations/20261030000005_part5_application_status.sql` | Application status workflow, state transitions, and audit logs |
| **07** | `supabase/migrations/20261030000006_part5_fix.sql` | Status transition RPC refinements |
| **08** | `supabase/migrations/20261030000007_part6_notifications.sql` | In-app notifications and trigger on application selection |
| **09** | `supabase/migrations/20261030000008_part7_admin_dashboard.sql` | Admin verification, credit allocation, and directory RPCs |
| **10** | `supabase/migrations/20261030000009_part8_phone_auth.sql` | Phone OTP authentication support and profile schemas |
| **11** | `supabase/migrations/20261030000010_part6_to_8_security_and_verification_fixes.sql` | RLS hardening, client notification restrictions, and status unification |
| **12** | `supabase/migrations/20261030000011_secure_selection_email_and_admin_profiles.sql` | Email claim locks and admin user directory SELECT policy |
| **13** | `supabase/migrations/20261030000012_nullable_applicant_email_and_hardened_release.sql` | Nullable email for phone OTP applicants & 2-minute release timeout |
| **14** | `supabase/migrations/20261030000013_fix_company_update_permissions_trigger.sql` | Fixed company ownership deletion cascade trigger |
| **15** | `supabase/migrations/20261030000014_fix_application_visibility_for_recruiters.sql` | Recruiter application visibility and company membership hierarchy |
| **16** | `supabase/migrations/20261030000015_credit_requests.sql` | Credit packages, recruiter credit requests workflow, and admin approval RPC |
| **17** | `supabase/migrations/20261030000016_credit_payment_proof.sql` | Screenshot proof uploads, payment_proofs storage bucket, and request_credits RPC update |

> [!NOTE]
> All migrations are idempotent and follow the strict security rule (`search_path = public, auth`, `auth.uid()`, and `is_admin()`).

---

## 3. Storage Bucket Verification

Check **Storage** in the Supabase Dashboard:
- Ensure the `resumes` bucket is created and marked **Private** (public downloads disabled).
- Ensure the `payment_proofs` bucket is created and marked **Private** (max 5MB, image formats only).
- RLS policies on `storage.objects` ensure candidates only access their own user directory, recruiters only access applicant resumes, and payment proofs are strictly visible only to company members and administrators.

---

## 4. Deploy Supabase Edge Functions

Authenticate the Supabase CLI and link your fresh project:

```bash
# Log in to Supabase CLI
npx supabase login

# Link your local repo to your remote project (find your Project Reference ID in Project Settings)
npx supabase link --project-ref <your-project-ref>
```

Deploy the three backend Edge Functions:

```bash
# 1. Login Function (Rate limiting, lockout protection, Turnstile CAPTCHA)
npx supabase functions deploy login

# 2. Unlock Function (Password-reset driven account unlocking)
npx supabase functions deploy unlock

# 3. Selection Email Function (Server-side transactional email dispatch)
npx supabase functions deploy send-selection-email
```

---

## 5. Configure Edge Function Secrets

Set runtime secrets for your Edge Functions using the Supabase CLI:

```bash
npx supabase secrets set \
  BREVO_API_KEY="your-brevo-api-key" \
  BREVO_SENDER_EMAIL="notifications@yourdomain.com" \
  TURNSTILE_SECRET_KEY="your-cloudflare-turnstile-secret-key" \
  REQUIRE_CAPTCHA="true"
```

### Secret Descriptions:
| Secret Name | Required | Description |
|---|---|---|
| `BREVO_API_KEY` | Optional | Transactional email REST API key from Brevo. If omitted, candidate selection succeeds with an in-app notice (`email_not_configured`). |
| `BREVO_SENDER_EMAIL` | Optional | Verified sender address configured in your Brevo account. |
| `TURNSTILE_SECRET_KEY` | Recommended | Cloudflare Turnstile secret key for server-side CAPTCHA verification. |
| `REQUIRE_CAPTCHA` | Production: `true` | When set to `"true"`, logins fail-closed if CAPTCHA is missing or invalid. Set to `"false"` or omit during local testing. |

---

## 6. Frontend Environment Variables

Create or update your `.env` file in the project root:

```env
# Supabase Project Credentials (from Project Settings -> API)
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Cloudflare Turnstile (Public Site Key)
VITE_TURNSTILE_SITE_KEY=your-turnstile-site-key
```

> [!CAUTION]
> **NEVER** expose `SUPABASE_SERVICE_ROLE_KEY` in the frontend `.env` or anywhere in client-side code. The frontend only requires `VITE_SUPABASE_ANON_KEY`.

---

## 7. Supabase Authentication Dashboard Settings

In your Supabase Dashboard, navigate to **Authentication**:

1. **URL Configuration** (`Authentication -> URL Configuration`):
   - **Site URL**: `https://your-domain.com` (or `http://localhost:5173` during development).
   - **Redirect URLs**: Add your production endpoints:
     - `https://your-domain.com/**`
     - `https://your-domain.com/reset-password`
2. **Email Provider** (`Authentication -> Providers -> Email`):
   - **Enable Email Provider**: ON
   - **Confirm email**: ON (enforce email confirmation before candidate or recruiter login)
3. **Phone Provider** (`Authentication -> Providers -> Phone`):
   - **Enable Phone Provider**: ON (for Phone OTP authentication via Twilio or MessageBird).
4. **Google OAuth** (`Authentication -> Providers -> Google` - Optional):
   - **Enable Google Provider**: Toggle ON and provide your Google Cloud Client ID and Client Secret.
5. **Custom SMTP** (`Project Settings -> Authentication -> SMTP Settings`):
   - Enable Custom SMTP using your transactional email provider (Brevo, AWS SES, Resend) to ensure reliable delivery of password reset and confirmation emails.

---

## 8. Creating the First Administrator

Once the database migrations are complete, create the initial administrative account:

1. Sign up on the platform with your admin email (e.g., `admin@yourdomain.com`) via the signup page (`/signup`) or via the Supabase Auth Dashboard (`Authentication -> Users -> Add User`).
2. Open the **SQL Editor** in the Supabase Dashboard and run:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'admin@yourdomain.com';
```

3. Confirm that the user now has administrative rights by visiting `/admin` after logging in.

---

## 9. Running Automated Verification Scripts (Staging Only)

> [!WARNING]
> **NEVER run verification test suites against a Production database.**
> Test scripts (`scripts/verify_part*.mjs`) create ephemeral users, jobs, applications, and simulate rate-limiting lockouts.

To run verification tests:
1. Create a separate **Staging/Test** Supabase project.
2. Apply the 17 migrations to the staging project.
3. In your local `.env`, point `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the staging project.
4. Add your staging admin credentials to `.env`:
   ```env
   ADMIN_EMAIL=staging-admin@yourdomain.com
   ADMIN_PASSWORD=your-secure-staging-password
   ```
5. Run the test suites:
   ```bash
   node scripts/verify_part6.mjs
   node scripts/verify_part7.mjs
   node scripts/verify_part8.mjs
   node scripts/verify_part6_to_8_fixes.mjs
   node scripts/verify_application_visibility.mjs
   ```

---

## 10. Production Go-Live Checklist

- [ ] All 17 database migrations applied successfully in order without errors.
- [ ] Edge Functions (`login`, `unlock`, `send-selection-email`) deployed and tested.
- [ ] `REQUIRE_CAPTCHA="true"` set in Edge Function secrets.
- [ ] `TURNSTILE_SECRET_KEY` and `VITE_TURNSTILE_SITE_KEY` configured.
- [ ] Custom SMTP configured and test email delivered.
- [ ] Email confirmation turned ON in Supabase Auth settings.
- [ ] Initial platform administrator role verified.
- [ ] Storage bucket `resumes` is private and RLS is active.
- [ ] Test accounts, dummy companies, and sample jobs removed from production database.
- [ ] `scripts/` folder is excluded from git/production build.
- [ ] Verified that `SUPABASE_SERVICE_ROLE_KEY` is NOT present in `.env` or client code.
